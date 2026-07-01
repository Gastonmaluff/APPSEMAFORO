import type { AppStatus, DisplayRecord, VisualState } from "./types";

/** Minutos sin actualización tras los cuales un run "running" se marca estancado. */
export const STALE_AFTER_MINUTES = 15;

export interface VisualDef {
  bigText: string;
  className: string;
  /** Texto de motivo auxiliar (para ATENCIÓN / estancado). */
  hint?: string;
}

const BASE: Record<VisualState, VisualDef> = {
  running: { bigText: "EJECUTANDO", className: "state-running" },
  success: { bigText: "LISTO", className: "state-success" },
  failed: { bigText: "FALLÓ", className: "state-failed" },
  attention: { bigText: "ATENCIÓN", className: "state-attention" },
  stale: {
    bigText: "ATENCIÓN",
    className: "state-attention",
    hint: "POSIBLEMENTE ESTANCADO",
  },
  unknown: { bigText: "SIN DATOS", className: "state-unknown" },
  offline: { bigText: "SIN CONEXIÓN", className: "state-unknown" },
};

/** Motivo legible para el estado de atención según la conclusión de GitHub. */
export function attentionReason(conclusion: string | null): string {
  switch (conclusion) {
    case "cancelled":
      return "CANCELADO";
    case "action_required":
      return "REQUIERE ACCIÓN";
    case "stale":
      return "QUEDÓ OBSOLETO";
    case "neutral":
      return "RESULTADO NEUTRO";
    default:
      return "REQUIERE ATENCIÓN";
  }
}

/**
 * Calcula el estado visual efectivo combinando:
 *  - conexión a Firebase (`connected`)
 *  - existencia de datos (`record`)
 *  - antigüedad de `updatedAt` para detectar runs estancados
 */
export function computeVisual(
  record: DisplayRecord | null,
  connected: boolean,
  nowMs: number,
): { state: VisualState; def: VisualDef } {
  if (!connected) return { state: "offline", def: BASE.offline };
  if (!record || !record.status) return { state: "unknown", def: BASE.unknown };

  const status: AppStatus = record.status;

  if (status === "running") {
    const updated = Date.parse(record.updatedAt);
    const ageMin = (nowMs - updated) / 60000;
    if (Number.isFinite(ageMin) && ageMin > STALE_AFTER_MINUTES) {
      return { state: "stale", def: BASE.stale };
    }
    return { state: "running", def: BASE.running };
  }

  if (status === "attention") {
    return {
      state: "attention",
      def: { ...BASE.attention, hint: attentionReason(record.conclusion) },
    };
  }

  const known: VisualState =
    status === "success" ? "success" : status === "failed" ? "failed" : "unknown";
  return { state: known, def: BASE[known] };
}
