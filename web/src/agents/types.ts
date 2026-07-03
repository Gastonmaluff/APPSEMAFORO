/** Agentes soportados en el área principal. */
export type AgentId = "claude" | "codex";

/** Estado de negocio que escribe el backend por agente. */
export type AgentStatus = "idle" | "working" | "completed" | "error";

/** Una tarea/sesión activa de un agente (tal como llega de RTDB). */
export interface AgentTask {
  startedAt: number;
  lastActivityAt: number;
  sessionId: string;
  cwd: string | null;
}

/** Registro por agente en Realtime Database (`agents/{agentId}`). */
export interface AgentRecord {
  status: AgentStatus;
  activeCount: number;
  tasks?: Record<string, AgentTask>;
  lastCompletedAt: number | null;
  lastError: number | null;
  lastCwd: string | null;
  updatedAt: number;
}

/** Snapshot de ambos agentes + metadata. */
export interface AgentsState {
  claude: AgentRecord | null;
  codex: AgentRecord | null;
  meta: { updatedAt?: number; lastSource?: AgentId } | null;
}

/**
 * Estado visual efectivo de un agente, ya resuelto en el cliente (aplica hold
 * del verde/rojo y expiración de tareas huérfanas).
 */
export type AgentVisual = "idle" | "working" | "completed" | "error";

/** Distribución del área principal según qué agentes están activos/recientes. */
export type StageLayout = "none" | "claude" | "codex" | "both";
