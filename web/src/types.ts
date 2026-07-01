/** Estado de negocio que escribe el backend. */
export type AppStatus = "running" | "success" | "failed" | "attention" | "unknown";

/** Registro tal como llega desde Realtime Database. */
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

export interface DisplayMeta {
  lastWebhookAt?: number;
  lastRepo?: string;
}

/** Estado visual efectivo, incluye condiciones calculadas en el cliente. */
export type VisualState =
  | "running"
  | "success"
  | "waiting"
  | "failed"
  | "attention"
  | "stale"
  | "unknown"
  | "offline";
