import { AppStatus, MonitoredRepo } from "./config";

/** Forma mínima del objeto `workflow_run` que nos interesa del payload. */
export interface WorkflowRun {
  id: number;
  name: string;
  head_branch: string | null;
  head_sha: string;
  run_number: number;
  status: string | null;
  conclusion: string | null;
  html_url: string;
  created_at: string;
  run_started_at?: string | null;
  updated_at: string;
}

export interface WorkflowRunEvent {
  action: "requested" | "in_progress" | "completed" | string;
  workflow_run: WorkflowRun;
  repository: { full_name: string };
}

/** Registro que se persiste en Realtime Database y consume la web app. */
export interface DisplayRecord {
  displayName: string;
  repository: string;
  workflowName: string;
  branch: string | null;
  status: AppStatus;
  conclusion: string | null;
  startedAt: string | null;
  updatedAt: string;
  completedAt: string | null;
  durationSeconds: number | null;
  runNumber: number;
  runUrl: string;
  shortSha: string;
  deliveryId: string;
}

export type FilterResult =
  | { ok: true; cfg: MonitoredRepo }
  | { ok: false; reason: "repo_not_allowed" | "workflow_not_allowed" | "branch_not_allowed" };

/**
 * Verifica que el evento provenga de un repo/workflow/rama autorizados.
 * No confía en ningún dato para decidir el color hasta pasar este filtro.
 */
export function filterEvent(
  event: WorkflowRunEvent,
  monitored: Record<string, MonitoredRepo>,
): FilterResult {
  const cfg = monitored[event.repository.full_name];
  if (!cfg) return { ok: false, reason: "repo_not_allowed" };
  if (event.workflow_run.name !== cfg.deployWorkflow) {
    return { ok: false, reason: "workflow_not_allowed" };
  }
  if (cfg.branch && event.workflow_run.head_branch !== cfg.branch) {
    return { ok: false, reason: "branch_not_allowed" };
  }
  return { ok: true, cfg };
}

/**
 * Traduce acción + conclusión de GitHub al estado visual del semáforo.
 * El verde SOLO aparece cuando el workflow terminó con `success`.
 */
export function mapStatus(
  action: string,
  conclusion: string | null,
): AppStatus {
  if (action === "requested" || action === "in_progress") return "running";
  if (action !== "completed") return "unknown";

  switch (conclusion) {
    case "success":
      return "success";
    case "failure":
    case "timed_out":
      return "failed";
    case "action_required":
    case "cancelled":
    case "stale":
    case "neutral":
      return "attention";
    case "skipped":
      return "unknown";
    default:
      return "attention";
  }
}

/** Construye el registro a persistir a partir del evento validado. */
export function buildRecord(
  event: WorkflowRunEvent,
  cfg: MonitoredRepo,
  deliveryId: string,
  nowMs: number,
): DisplayRecord {
  const run = event.workflow_run;
  const status = mapStatus(event.action, run.conclusion);
  const startedAt = run.run_started_at || run.created_at || null;
  const isCompleted = event.action === "completed";
  const completedAt = isCompleted ? run.updated_at : null;

  let durationSeconds: number | null = null;
  if (completedAt && startedAt) {
    const d = Math.round(
      (new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000,
    );
    durationSeconds = Number.isFinite(d) && d >= 0 ? d : null;
  }

  return {
    displayName: cfg.displayName,
    repository: event.repository.full_name,
    workflowName: run.name,
    branch: run.head_branch,
    status,
    conclusion: isCompleted ? run.conclusion : null,
    startedAt,
    updatedAt: new Date(nowMs).toISOString(),
    completedAt,
    durationSeconds,
    runNumber: run.run_number,
    runUrl: run.html_url,
    shortSha: (run.head_sha || "").slice(0, 7),
    deliveryId,
  };
}
