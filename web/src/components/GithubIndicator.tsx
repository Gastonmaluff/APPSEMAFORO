import { computeVisual } from "../status";
import type { DisplayRecord, VisualState } from "../types";

interface Props {
  record: DisplayRecord | null;
  connected: boolean;
  now: number;
  greenHoldMinutes: number;
  /** Tareas activas totales (Codex + Claude). */
  activeContexts: number;
  /** Tope nominal de contextos para la lectura "N/max". */
  maxContexts: number;
  onOpenConfig?: () => void;
}

/** Etiqueta y clase del estado del deploy (fuente: GitHub). */
const GH_LABEL: Record<VisualState, { text: string; cls: string; spin?: boolean; check?: boolean }> = {
  running: { text: "Publicando", cls: "sp-running", spin: true },
  success: { text: "Listo", cls: "sp-success", check: true },
  waiting: { text: "En espera", cls: "sp-waiting" },
  failed: { text: "Deploy fallido", cls: "sp-failed" },
  attention: { text: "Atención", cls: "sp-attention" },
  stale: { text: "Estancado", cls: "sp-attention" },
  unknown: { text: "Sin datos", cls: "sp-unknown" },
  offline: { text: "Sin conexión", cls: "sp-unknown" },
};

/**
 * Panel lateral secundario, premium y discreto. Muestra el estado del deploy de
 * GitHub (real), los contextos activos de los agentes (real) y una utilización
 * derivada de esos contextos. No compite con el estado principal.
 */
export function GithubIndicator({
  record,
  connected,
  now,
  greenHoldMinutes,
  activeContexts,
  maxContexts,
  onOpenConfig,
}: Props) {
  const { state } = computeVisual(record, connected, now, greenHoldMinutes);
  const meta = GH_LABEL[state];
  const repoShort = record
    ? record.displayName || record.repository.split("/").pop() || record.repository
    : null;
  const util = Math.min(100, Math.round((activeContexts / Math.max(1, maxContexts)) * 100));

  return (
    <aside className={`side-panel ${meta.cls}`} aria-label="Estado secundario">
      <div className="sp-block">
        <div className="sp-label">Estado</div>
        <div className="sp-value sp-estado">
          <span className="sp-dot" aria-hidden="true" />
          {meta.spin && <span className="sp-spinner" aria-hidden="true" />}
          {meta.check && <span className="sp-check" aria-hidden="true">✓</span>}
          <span className="sp-estado-text">{meta.text}</span>
        </div>
        {repoShort && <div className="sp-caption">{repoShort}</div>}
      </div>

      <div className="sp-block">
        <div className="sp-label">Contextos activos</div>
        <div className="sp-value sp-metric">
          {activeContexts}
          <span className="sp-of">/{maxContexts}</span>
        </div>
      </div>

      <div className="sp-block">
        <div className="sp-label">Utilización</div>
        <div className="sp-value sp-metric">{util}%</div>
      </div>

      <button
        type="button"
        className="sp-more"
        onClick={onOpenConfig}
        aria-label="Abrir configuración"
      >
        •••
      </button>
    </aside>
  );
}
