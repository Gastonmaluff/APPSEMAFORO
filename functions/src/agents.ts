/**
 * Lógica pura del estado de los agentes (Claude Code / Codex).
 *
 * Recibe eventos normalizados de los hooks locales (vía el forwarder) y produce
 * el nuevo registro a persistir en Realtime Database. Sin efectos secundarios:
 * la Cloud Function envuelve estas funciones en una transacción.
 *
 * NUNCA se guardan datos sensibles: solo contadores, timestamps, `sessionId` y
 * el `cwd` reducido a su nombre de carpeta (basename).
 */

/** Agentes soportados. */
export type AgentId = "claude" | "codex";

/** Estado de negocio de un agente. */
export type AgentStatus = "idle" | "working" | "completed" | "error";

/** Eventos que envían los hooks locales. */
export type HookEvent = "start" | "stop" | "failure" | "session_end" | "heartbeat";

export const AGENT_IDS: readonly AgentId[] = ["claude", "codex"];
export const HOOK_EVENTS: readonly HookEvent[] = [
  "start",
  "stop",
  "failure",
  "session_end",
  "heartbeat",
];

/** Evento ya validado y normalizado (sin texto de prompt ni datos privados). */
export interface NormalizedEvent {
  source: AgentId;
  event: HookEvent;
  sessionId: string;
  turnId: string | null;
  promptId: string | null;
  cwd: string | null;
  timestamp: number;
  eventId: string;
}

/** Una tarea/sesión activa de un agente. */
export interface AgentTask {
  startedAt: number;
  lastActivityAt: number;
  sessionId: string;
  cwd: string | null;
}

/** Registro por agente que se persiste y consume la web app. */
export interface AgentRecord {
  status: AgentStatus;
  activeCount: number;
  tasks: Record<string, AgentTask>;
  lastCompletedAt: number | null;
  lastError: number | null;
  lastCwd: string | null;
  updatedAt: number;
}

/** Registro base de un agente sin actividad. */
export function emptyAgentRecord(nowMs: number): AgentRecord {
  return {
    status: "idle",
    activeCount: 0,
    tasks: {},
    lastCompletedAt: null,
    lastError: null,
    lastCwd: null,
    updatedAt: nowMs,
  };
}

/** Reemplaza caracteres no válidos en claves de RTDB. */
export function sanitizeKey(key: string): string {
  return key.replace(/[.#$/[\]]/g, "_").slice(0, 200) || "_";
}

/** Reduce una ruta a su último segmento (nombre de carpeta), sin exponer la ruta completa. */
export function basename(p: string | null | undefined): string | null {
  if (!p) return null;
  const parts = p.replace(/[\\/]+$/, "").split(/[\\/]+/);
  const last = parts[parts.length - 1] || null;
  return last ? last.slice(0, 60) : null;
}

function isAgentId(v: unknown): v is AgentId {
  return typeof v === "string" && (AGENT_IDS as readonly string[]).includes(v);
}
function isHookEvent(v: unknown): v is HookEvent {
  return typeof v === "string" && (HOOK_EVENTS as readonly string[]).includes(v);
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/**
 * Valida y normaliza el payload crudo recibido por la Cloud Function.
 * Devuelve `null` si `source` o `event` no son válidos (payload rechazable).
 */
export function normalizeEvent(raw: unknown, nowMs: number): NormalizedEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  if (!isAgentId(o.source) || !isHookEvent(o.event)) return null;

  const sessionId = str(o.sessionId) ?? str(o.session_id) ?? "unknown-session";
  const turnId = str(o.turnId) ?? str(o.turn_id);
  const promptId = str(o.promptId) ?? str(o.prompt_id);
  const cwd = basename(str(o.cwd));

  const tsRaw = str(o.timestamp);
  const parsed = tsRaw ? Date.parse(tsRaw) : NaN;
  const timestamp = Number.isFinite(parsed) ? parsed : nowMs;

  // eventId estable: si el forwarder no lo mandó, se deriva de forma determinista.
  const eventId =
    str(o.eventId) ??
    str(o.event_id) ??
    `${o.source}-${sessionId}-${o.event}-${timestamp}`;

  return {
    source: o.source,
    event: o.event,
    sessionId,
    turnId,
    promptId,
    cwd,
    timestamp,
    eventId,
  };
}

/**
 * Clave estable de tarea. Prioriza `sessionId` (una sesión = un indicador),
 * luego `promptId`, y como último recurso combina source + cwd + turnId.
 */
export function buildTaskKey(ev: NormalizedEvent): string {
  const base =
    ev.sessionId !== "unknown-session"
      ? ev.sessionId
      : ev.promptId ?? `${ev.source}-${ev.cwd ?? "nocwd"}-${ev.turnId ?? "not"}`;
  return sanitizeKey(base);
}

/**
 * Recalcula el estado a partir de las tareas restantes tras aplicar el evento.
 * `working` mientras queden tareas; si no quedan, conserva el resultado
 * (completed / error) que ya se haya fijado, o `idle` por defecto.
 */
function statusFromTasks(record: AgentRecord, fallback: AgentStatus): AgentStatus {
  if (Object.keys(record.tasks).length > 0) return "working";
  return fallback;
}

/**
 * Milisegundos tras los cuales una tarea sin actividad se poda del servidor.
 * Solo evita que se acumulen tareas de sesiones que murieron sin enviar `Stop`;
 * las tareas activas se refrescan con heartbeats mucho antes de este umbral.
 */
export const STALE_TASK_MS = 60 * 60 * 1000;

/** Elimina (in place) tareas cuyo `lastActivityAt` supera el umbral de stale. */
function pruneStaleTasks(rec: AgentRecord, nowMs: number): void {
  for (const [k, t] of Object.entries(rec.tasks)) {
    if (!Number.isFinite(t.lastActivityAt) || nowMs - t.lastActivityAt > STALE_TASK_MS) {
      delete rec.tasks[k];
    }
  }
}

/**
 * Reductor puro: aplica un evento normalizado al registro actual del agente y
 * devuelve el nuevo registro. Un evento de un agente NUNCA afecta al otro.
 */
export function applyEvent(
  current: AgentRecord | null,
  ev: NormalizedEvent,
  nowMs: number,
): AgentRecord {
  const rec: AgentRecord = current
    ? { ...current, tasks: { ...current.tasks } }
    : emptyAgentRecord(nowMs);

  // Poda defensiva de tareas huérfanas (sesiones que murieron sin `Stop`).
  pruneStaleTasks(rec, nowMs);

  const key = buildTaskKey(ev);
  const cwd = ev.cwd;

  switch (ev.event) {
    case "start":
    case "heartbeat": {
      const existing = rec.tasks[key];
      rec.tasks[key] = {
        startedAt: existing?.startedAt ?? nowMs,
        lastActivityAt: nowMs,
        sessionId: ev.sessionId,
        cwd: cwd ?? existing?.cwd ?? null,
      };
      rec.status = "working";
      if (cwd) rec.lastCwd = cwd;
      break;
    }
    case "stop":
    case "session_end": {
      delete rec.tasks[key];
      if (Object.keys(rec.tasks).length > 0) {
        rec.status = "working";
      } else {
        rec.status = "completed";
        rec.lastCompletedAt = nowMs;
      }
      if (cwd) rec.lastCwd = cwd;
      break;
    }
    case "failure": {
      delete rec.tasks[key];
      rec.status = "error";
      rec.lastError = nowMs;
      if (cwd) rec.lastCwd = cwd;
      break;
    }
    default: {
      // Evento desconocido: no cambia el estado más allá de recomputar.
      rec.status = statusFromTasks(rec, rec.status);
      break;
    }
  }

  rec.activeCount = Object.keys(rec.tasks).length;
  rec.updatedAt = nowMs;
  return rec;
}
