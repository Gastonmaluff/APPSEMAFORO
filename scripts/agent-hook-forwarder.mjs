#!/usr/bin/env node
/**
 * agent-hook-forwarder.mjs
 *
 * Reenvía eventos de los hooks locales de Claude Code / Codex a la Cloud
 * Function `agentHook`. Diseñado para NO bloquear al agente:
 *   - timeout corto,
 *   - un único reintento para fallos transitorios,
 *   - falla en silencio (siempre exit 0) y registra en un log local mínimo.
 *
 * Uso (invocado por un hook, recibe el payload del hook por stdin):
 *   node agent-hook-forwarder.mjs --source claude --event start
 *   node agent-hook-forwarder.mjs --source codex  --event stop
 *   node agent-hook-forwarder.mjs --source claude --event failure
 *   node agent-hook-forwarder.mjs --source claude --event session_end
 *   node agent-hook-forwarder.mjs --source codex  --event heartbeat
 *
 * Modo prueba (no hace red, imprime el payload que enviaría):
 *   echo '{"session_id":"s1","cwd":"C:/proj/x"}' | node agent-hook-forwarder.mjs \
 *     --source claude --event start --test
 *
 * Configuración (nunca en git):
 *   - Variables de entorno AGENT_HOOK_URL y AGENT_HOOK_SECRET, o
 *   - archivo JSON en %USERPROFILE%\.agent-hook\config.json:
 *       { "url": "https://...cloudfunctions.net/agentHook", "secret": "..." }
 */

import { readFileSync, appendFileSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const VALID_SOURCES = ["claude", "codex"];
const VALID_EVENTS = ["start", "stop", "failure", "session_end", "heartbeat"];
const TIMEOUT_MS = 1500;
/** No enviar más de un heartbeat por sesión cada X ms (evita spam en PostToolUse). */
const HEARTBEAT_THROTTLE_MS = 90_000;

const CONFIG_DIR = join(homedir(), ".agent-hook");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");
const LOG_FILE = join(CONFIG_DIR, "forwarder.log");
const HB_DIR = join(CONFIG_DIR, "hb");

/** Log local mínimo; nunca lanza. */
function logLine(msg) {
  try {
    mkdirSync(CONFIG_DIR, { recursive: true });
    appendFileSync(LOG_FILE, `${new Date().toISOString()} ${msg}\n`);
  } catch {
    /* sin log disponible: se ignora */
  }
}

/**
 * Throttle de heartbeats por sesión: devuelve true si ya se envió uno hace menos
 * de HEARTBEAT_THROTTLE_MS (hay que saltearlo). Usa un archivo marcador por sesión.
 * Ante cualquier error, no throttlea (mejor enviar de más que perder actividad).
 */
function heartbeatThrottled(source, sessionId) {
  try {
    const key = `${source}-${String(sessionId).replace(/[^a-zA-Z0-9_-]/g, "_")}`.slice(0, 120);
    const marker = join(HB_DIR, `${key}.ts`);
    try {
      const age = Date.now() - statSync(marker).mtimeMs;
      if (age < HEARTBEAT_THROTTLE_MS) return true;
    } catch {
      /* no existe el marcador: primer heartbeat */
    }
    mkdirSync(HB_DIR, { recursive: true });
    writeFileSync(marker, "");
    return false;
  } catch {
    return false;
  }
}

/** Parsea argumentos --key value y flags --test. */
function parseArgs(argv) {
  const out = { test: false, emitContinue: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--test") out.test = true;
    else if (a === "--emit-continue") out.emitContinue = true;
    else if (a === "--source") out.source = argv[++i];
    else if (a === "--event") out.event = argv[++i];
  }
  return out;
}

/** Lee todo el stdin (payload del hook). Devuelve "" si no hay. */
async function readStdin() {
  try {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    return Buffer.concat(chunks).toString("utf8");
  } catch {
    return "";
  }
}

/** Carga { url, secret } desde env o el archivo de config local. */
function loadConfig() {
  let url = process.env.AGENT_HOOK_URL || "";
  let secret = process.env.AGENT_HOOK_SECRET || "";
  if (!url || !secret) {
    try {
      const raw = readFileSync(CONFIG_FILE, "utf8");
      const cfg = JSON.parse(raw);
      url = url || cfg.url || "";
      secret = secret || cfg.secret || "";
    } catch {
      /* sin archivo: se usa lo que haya en env */
    }
  }
  return { url, secret };
}

const first = (...vals) => vals.find((v) => typeof v === "string" && v.trim()) || null;

/**
 * Normaliza el payload del hook (Claude y Codex usan snake_case) a los campos
 * mínimos. NO se reenvía el texto del prompt ni contenido de archivos.
 */
function buildPayload(hook, source, event) {
  return {
    source,
    event,
    sessionId: first(hook.session_id, hook.sessionId) || "unknown-session",
    turnId: first(hook.turn_id, hook.turnId),
    promptId: first(hook.prompt_id, hook.promptId),
    cwd: first(hook.cwd, hook.workspace, hook.project_dir),
    timestamp: new Date().toISOString(),
    // Mismo eventId en el reintento -> el backend deduplica de verdad.
    eventId: `${source}-${event}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
}

/** POST con timeout. Devuelve true si 2xx. Lanza en error de red/timeout. */
async function postOnce(url, secret, payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Agent-Secret": secret },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    return res.ok;
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const { source, event, test, emitContinue } = parseArgs(process.argv.slice(2));

  // Respuesta neutral para Codex: se emite SIEMPRE y primero, de modo que aunque
  // falle la config/red/forwarder, Codex reciba un JSON válido y no se bloquee.
  if (emitContinue && !test) process.stdout.write('{"continue":true}\n');

  if (!VALID_SOURCES.includes(source) || !VALID_EVENTS.includes(event)) {
    logLine(`args inválidos: source=${source} event=${event}`);
    return; // exit 0: nunca bloquear al agente
  }

  const raw = await readStdin();
  let hook = {};
  if (raw.trim()) {
    try {
      hook = JSON.parse(raw);
    } catch {
      hook = {};
    }
  }

  const payload = buildPayload(hook, source, event);

  if (test) {
    process.stdout.write(JSON.stringify(payload, null, 2) + "\n");
    return;
  }

  // Heartbeats muy seguidos (PostToolUse) se saltean para no spamear la función.
  if (event === "heartbeat" && heartbeatThrottled(source, payload.sessionId)) {
    return;
  }

  const { url, secret } = loadConfig();
  if (!url || !secret) {
    logLine("falta AGENT_HOOK_URL o AGENT_HOOK_SECRET (config.json/env)");
    return;
  }

  // Intento + un reintento breve para fallos transitorios.
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const ok = await postOnce(url, secret, payload);
      if (ok) return;
      logLine(`respuesta no-2xx (intento ${attempt}) ${source}/${event}`);
      if (attempt === 2) return;
    } catch (err) {
      logLine(`error de red (intento ${attempt}) ${source}/${event}: ${String(err)}`);
      if (attempt === 2) return;
    }
  }
}

// Cualquier error inesperado se traga: el agente nunca debe verse afectado.
main().catch((err) => {
  logLine(`excepción no controlada: ${String(err)}`);
  process.exit(0);
});
