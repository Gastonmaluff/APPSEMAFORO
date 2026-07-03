import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import { getDatabase } from "firebase-admin/database";
import { timingSafeEqual } from "crypto";

import { AGENT_HOOK_SECRET_NAME } from "./config";
import {
  applyEvent,
  normalizeEvent,
  sanitizeKey,
  type AgentRecord,
} from "./agents";

const AGENT_SECRET = defineSecret(AGENT_HOOK_SECRET_NAME);

/** TTL de registros de idempotencia de eventos de agentes (24 h). */
const EVENT_TTL_MS = 24 * 60 * 60 * 1000;

/** Comparación de tiempo constante entre el secreto recibido y el esperado. */
function secretMatches(received: string | undefined, expected: string): boolean {
  if (!received || !expected) return false;
  const a = Buffer.from(received, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Endpoint HTTPS que reciben los hooks locales de Claude Code / Codex a través
 * del forwarder. Autentica con un secreto compartido, valida y normaliza el
 * evento, aplica idempotencia y actualiza `agents/{source}` con una transacción.
 *
 * Solo persiste metadatos mínimos: contadores, timestamps, sessionId y el
 * basename del cwd. Nunca prompts, archivos, tokens ni secretos.
 */
export const agentHook = onRequest(
  {
    region: "us-central1",
    secrets: [AGENT_SECRET],
    cors: false,
    maxInstances: 5,
    invoker: "public",
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "method_not_allowed" });
      return;
    }

    // 1) Autenticación por secreto compartido (tiempo constante).
    const provided = req.get("X-Agent-Secret") ?? undefined;
    if (!secretMatches(provided, AGENT_SECRET.value())) {
      logger.warn("agentHook: secreto inválido o ausente");
      res.status(401).json({ ok: false, error: "unauthorized" });
      return;
    }

    const now = Date.now();

    // 2) Validación y normalización del evento.
    const ev = normalizeEvent(req.body, now);
    if (!ev) {
      res.status(400).json({ ok: false, error: "invalid_event" });
      return;
    }

    const db = getDatabase();

    // 3) Idempotencia: no procesar dos veces el mismo eventId.
    const evRef = db.ref(`agents/_events/${sanitizeKey(ev.eventId)}`);
    const evSnap = await evRef.get();
    if (evSnap.exists()) {
      res.status(200).json({ ok: true, duplicate: true });
      return;
    }
    await evRef.set({ at: now });
    void pruneEvents(db, now);

    // 4) Transacción sobre el registro del agente (maneja concurrencia).
    const agentRef = db.ref(`agents/${ev.source}`);
    let nextStatus = "";
    await agentRef.transaction((current: AgentRecord | null) => {
      const next = applyEvent(current, ev, now);
      nextStatus = next.status;
      return next;
    });

    await db.ref("agents/meta").update({ updatedAt: now, lastSource: ev.source });

    logger.info("agentHook: estado actualizado", {
      source: ev.source,
      event: ev.event,
      status: nextStatus,
    });

    res.status(200).json({ ok: true, source: ev.source, status: nextStatus });
  },
);

/** Elimina registros de idempotencia más viejos que el TTL (best-effort). */
async function pruneEvents(
  db: ReturnType<typeof getDatabase>,
  now: number,
): Promise<void> {
  try {
    const ref = db.ref("agents/_events");
    const snap = await ref.get();
    if (!snap.exists()) return;
    const updates: Record<string, null> = {};
    snap.forEach((child) => {
      const at = (child.val() as { at?: number })?.at ?? 0;
      if (now - at > EVENT_TTL_MS) updates[child.key as string] = null;
    });
    if (Object.keys(updates).length > 0) await ref.update(updates);
  } catch (err) {
    logger.debug("agentHook: no se pudieron limpiar eventos viejos", {
      err: String(err),
    });
  }
}
