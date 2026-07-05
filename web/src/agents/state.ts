import type {
  AgentId,
  AgentRecord,
  AgentTask,
  AgentVisual,
  StageLayout,
} from "./types";

/** Segundos que el verde ("LISTO") se mantiene tras completar antes de volver a idle. */
export const AGENT_GREEN_HOLD_SEC = 120;
/** Segundos que el rojo ("ERROR") se mantiene antes de volver a idle. */
export const AGENT_ERROR_HOLD_SEC = 300;
/**
 * Minutos sin actividad tras los cuales una tarea se considera huérfana y se ignora.
 * Actúa solo como red de seguridad ante un agente que crashea sin enviar `Stop`.
 * Las tareas activas se mantienen vivas con heartbeats (PostToolUse), así que este
 * valor puede ser generoso sin apagar tareas largas reales.
 */
export const AGENT_ORPHAN_MIN = 45;

export interface HoldOpts {
  greenHoldSec?: number;
  errorHoldSec?: number;
  orphanMin?: number;
}

export interface AgentView {
  visual: AgentVisual;
  /** Tareas realmente vivas (no huérfanas). */
  activeCount: number;
  /** Nombre corto del proyecto (basename del cwd) o null. */
  project: string | null;
  /** Timestamp de inicio de la tarea viva más antigua (para cronómetro). */
  since: number | null;
}

export interface AgentVisualDef {
  label: string;
  className: string;
}

export const AGENT_DEF: Record<AgentVisual, AgentVisualDef> = {
  idle: { label: "EN REPOSO", className: "agent-idle" },
  working: { label: "TRABAJANDO", className: "agent-working" },
  completed: { label: "LISTO", className: "agent-completed" },
  error: { label: "ERROR", className: "agent-error" },
};

export const AGENT_NAME: Record<AgentId, string> = {
  claude: "Claude Code",
  codex: "Codex",
};

/** Tareas cuyo `lastActivityAt` es más reciente que el umbral de orfandad. */
function liveTasks(
  tasks: Record<string, AgentTask> | undefined,
  now: number,
  orphanMs: number,
): AgentTask[] {
  if (!tasks) return [];
  return Object.values(tasks).filter(
    (t) => Number.isFinite(t.lastActivityAt) && now - t.lastActivityAt <= orphanMs,
  );
}

/**
 * Resuelve el estado visual efectivo de un agente combinando:
 *  - tareas vivas (ignora huérfanas por expiración),
 *  - hold del verde tras completar (120 s por defecto),
 *  - hold del rojo tras error.
 * Una nueva tarea (working) siempre tiene prioridad sobre un resultado reciente.
 */
export function deriveAgentVisual(
  record: AgentRecord | null,
  now: number,
  opts: HoldOpts = {},
): AgentView {
  const greenMs = (opts.greenHoldSec ?? AGENT_GREEN_HOLD_SEC) * 1000;
  const errorMs = (opts.errorHoldSec ?? AGENT_ERROR_HOLD_SEC) * 1000;
  const orphanMs = (opts.orphanMin ?? AGENT_ORPHAN_MIN) * 60000;

  if (!record) {
    return { visual: "idle", activeCount: 0, project: null, since: null };
  }

  const live = liveTasks(record.tasks, now, orphanMs);

  if (live.length > 0) {
    const since = live.reduce((min, t) => Math.min(min, t.startedAt), Infinity);
    const project = live[0]?.cwd ?? record.lastCwd ?? null;
    return {
      visual: "working",
      activeCount: live.length,
      project,
      since: Number.isFinite(since) ? since : null,
    };
  }

  // Sin tareas vivas: mirar el resultado terminal más reciente dentro del hold.
  const lastError = record.lastError ?? 0;
  const lastDone = record.lastCompletedAt ?? 0;

  if (lastError && now - lastError <= errorMs && lastError >= lastDone) {
    return { visual: "error", activeCount: 0, project: record.lastCwd, since: null };
  }
  if (lastDone && now - lastDone <= greenMs) {
    return { visual: "completed", activeCount: 0, project: record.lastCwd, since: null };
  }

  return { visual: "idle", activeCount: 0, project: record.lastCwd, since: null };
}

/** ¿El agente está activo o mostró un resultado reciente (no idle)? */
export function isPresent(view: AgentView): boolean {
  return view.visual !== "idle";
}

/**
 * Decide la distribución del área principal:
 *  - "none": ninguno presente -> pantalla "Sin tareas".
 *  - "claude" / "codex": solo uno presente -> ocupa todo.
 *  - "both": ambos presentes -> split (Codex izquierda, Claude derecha).
 */
export function deriveLayout(claude: AgentView, codex: AgentView): StageLayout {
  const c = isPresent(claude);
  const x = isPresent(codex);
  if (c && x) return "both";
  if (c) return "claude";
  if (x) return "codex";
  return "none";
}
