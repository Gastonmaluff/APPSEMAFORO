#!/usr/bin/env node
/**
 * simulate-agent-events.mjs
 *
 * Simula secuencias de eventos de agentes contra la Cloud Function `agentHook`
 * (o en modo --dry, sin red) para verificar los escenarios del spec sin tener
 * que lanzar tareas reales de Claude/Codex.
 *
 * Uso:
 *   node simulate-agent-events.mjs <escenario> [--dry]
 *
 * Escenarios:
 *   claude       Claude: start -> (pausa) -> stop
 *   codex        Codex:  start -> (pausa) -> stop
 *   both         Ambos start (split), Codex stop primero (verde), Claude sigue azul
 *   multi        Dos sesiones de Claude; sigue azul hasta que terminan ambas
 *   fail-claude  Claude start -> failure (rojo), Codex intacto
 *   duplicate    Envía el mismo eventId dos veces (el backend deduplica)
 *   idle         Un stop suelto para volver a idle
 *
 * Config: AGENT_HOOK_URL / AGENT_HOOK_SECRET por env o
 *         %USERPROFILE%\.agent-hook\config.json  { "url":"...", "secret":"..." }
 */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CONFIG_FILE = join(homedir(), ".agent-hook", "config.json");
const DRY = process.argv.includes("--dry");
const scenario = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "both";

function loadConfig() {
  let url = process.env.AGENT_HOOK_URL || "";
  let secret = process.env.AGENT_HOOK_SECRET || "";
  if (!url || !secret) {
    try {
      const cfg = JSON.parse(readFileSync(CONFIG_FILE, "utf8"));
      url = url || cfg.url || "";
      secret = secret || cfg.secret || "";
    } catch {
      /* ignore */
    }
  }
  return { url, secret };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let seq = 0;

function evt(source, event, over = {}) {
  return {
    source,
    event,
    sessionId: over.sessionId ?? `sim-${source}`,
    cwd: over.cwd ?? `C:/proj/${source}-demo`,
    timestamp: new Date().toISOString(),
    eventId: over.eventId ?? `sim-${source}-${event}-${Date.now()}-${seq++}`,
  };
}

async function send(url, secret, payload) {
  if (DRY) {
    console.log("DRY →", JSON.stringify(payload));
    return;
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Agent-Secret": secret },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    console.log(`${res.status}  ${payload.source}/${payload.event}  →`, JSON.stringify(body));
  } catch (err) {
    console.error("error:", String(err));
  }
}

const SCENARIOS = {
  claude: [["claude", "start"], "PAUSE", ["claude", "stop"]],
  codex: [["codex", "start"], "PAUSE", ["codex", "stop"]],
  both: [
    ["codex", "start"],
    ["claude", "start"],
    "PAUSE",
    ["codex", "stop"], // Codex verde, Claude sigue azul
    "PAUSE",
    ["claude", "stop"],
  ],
  multi: [
    ["claude", "start", { sessionId: "sim-claude-A" }],
    ["claude", "start", { sessionId: "sim-claude-B" }],
    "PAUSE",
    ["claude", "stop", { sessionId: "sim-claude-A" }], // sigue azul (queda B)
    "PAUSE",
    ["claude", "stop", { sessionId: "sim-claude-B" }],
  ],
  "fail-claude": [["codex", "start"], ["claude", "start"], "PAUSE", ["claude", "failure"]],
  duplicate: (() => {
    const id = `sim-dup-${Date.now()}`;
    return [
      ["claude", "start", { eventId: id }],
      ["claude", "start", { eventId: id }], // duplicado: debe responder duplicate:true
    ];
  })(),
  idle: [["claude", "stop", { sessionId: "sim-claude" }]],
};

async function main() {
  const steps = SCENARIOS[scenario];
  if (!steps) {
    console.error(`Escenario desconocido: ${scenario}. Opciones: ${Object.keys(SCENARIOS).join(", ")}`);
    process.exit(1);
  }
  const { url, secret } = loadConfig();
  if (!DRY && (!url || !secret)) {
    console.error("Falta AGENT_HOOK_URL/AGENT_HOOK_SECRET. Usá --dry o configurá el forwarder.");
    process.exit(1);
  }
  console.log(`Escenario: ${scenario}${DRY ? " (dry)" : ""}\n`);
  for (const step of steps) {
    if (step === "PAUSE") {
      await sleep(1500);
      continue;
    }
    const [source, event, over] = step;
    await send(url, secret, evt(source, event, over));
    await sleep(250);
  }
  console.log("\nListo.");
}

main();
