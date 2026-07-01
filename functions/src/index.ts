import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

import { verifySignature } from "./verify";
import { DISPLAY_ID, MONITORED, WEBHOOK_SECRET_NAME } from "./config";
import { buildRecord, filterEvent, WorkflowRunEvent } from "./state";

const WEBHOOK_SECRET = defineSecret(WEBHOOK_SECRET_NAME);

initializeApp();

/** TTL de registros de idempotencia (7 días). */
const DELIVERY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Endpoint público que recibe los webhooks `workflow_run` de GitHub.
 * Valida firma HMAC, filtra por allowlist, aplica idempotencia y escribe
 * el estado mínimo en Realtime Database. Nunca registra el secreto.
 */
export const githubWebhook = onRequest(
  {
    region: "us-central1",
    secrets: [WEBHOOK_SECRET],
    cors: false,
    maxInstances: 5,
    invoker: "public",
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "method_not_allowed" });
      return;
    }

    const event = req.get("X-GitHub-Event");
    const delivery = req.get("X-GitHub-Delivery");
    const signature = req.get("X-Hub-Signature-256");

    // 1) Validación de firma sobre el cuerpo crudo.
    const rawBody: Buffer | string = (req as { rawBody?: Buffer }).rawBody ?? JSON.stringify(req.body);
    if (!verifySignature(rawBody, signature, WEBHOOK_SECRET.value())) {
      logger.warn("Webhook con firma inválida", { event, delivery });
      res.status(401).json({ ok: false, error: "invalid_signature" });
      return;
    }

    // 2) Evento ping de GitHub.
    if (event === "ping") {
      res.status(200).json({ ok: true, pong: true });
      return;
    }

    // 3) Solo procesamos workflow_run.
    if (event !== "workflow_run") {
      res.status(202).json({ ok: true, ignored: "unsupported_event", event });
      return;
    }

    const body = req.body as WorkflowRunEvent | undefined;
    if (!body || !body.workflow_run || !body.repository) {
      res.status(400).json({ ok: false, error: "malformed_payload" });
      return;
    }

    // 4) Filtro por repo / workflow / rama autorizados.
    const filtered = filterEvent(body, MONITORED);
    if (!filtered.ok) {
      logger.info("Evento descartado por filtro", {
        reason: filtered.reason,
        repo: body.repository.full_name,
        workflow: body.workflow_run.name,
      });
      res.status(202).json({ ok: true, ignored: filtered.reason });
      return;
    }

    const db = getDatabase();
    const now = Date.now();

    // 5) Idempotencia: no procesar dos veces el mismo delivery.
    if (delivery) {
      const dRef = db.ref(`displays/${DISPLAY_ID}/_deliveries/${sanitizeKey(delivery)}`);
      const snap = await dRef.get();
      if (snap.exists()) {
        res.status(200).json({ ok: true, duplicate: true });
        return;
      }
      await dRef.set({ at: now, event });
      // Limpieza best-effort de deliveries viejos.
      void pruneDeliveries(db, now);
    }

    // 6) Construir y persistir el registro mínimo.
    const record = buildRecord(body, filtered.cfg, delivery ?? "", now);
    await db.ref(`displays/${DISPLAY_ID}/repos/${filtered.cfg.repoId}`).update(record);
    await db.ref(`displays/${DISPLAY_ID}/meta`).update({
      lastWebhookAt: now,
      lastRepo: filtered.cfg.repoId,
    });

    logger.info("Estado actualizado", {
      repo: filtered.cfg.repoId,
      status: record.status,
      action: body.action,
    });

    res.status(200).json({ ok: true, status: record.status });
  },
);

/** Reemplaza caracteres no válidos en claves de RTDB. */
function sanitizeKey(key: string): string {
  return key.replace(/[.#$/[\]]/g, "_");
}

/** Elimina registros de idempotencia más viejos que el TTL. */
async function pruneDeliveries(
  db: ReturnType<typeof getDatabase>,
  now: number,
): Promise<void> {
  try {
    const ref = db.ref(`displays/${DISPLAY_ID}/_deliveries`);
    const snap = await ref.get();
    if (!snap.exists()) return;
    const updates: Record<string, null> = {};
    snap.forEach((child) => {
      const at = (child.val() as { at?: number })?.at ?? 0;
      if (now - at > DELIVERY_TTL_MS) updates[child.key as string] = null;
    });
    if (Object.keys(updates).length > 0) await ref.update(updates);
  } catch (err) {
    logger.debug("No se pudieron limpiar deliveries viejos", { err: String(err) });
  }
}
