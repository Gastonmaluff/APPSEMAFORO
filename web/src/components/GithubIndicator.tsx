import { computeVisual } from "../status";
import type { DisplayRecord, VisualState } from "../types";
import { formatClock } from "../time";

interface Props {
  record: DisplayRecord | null;
  connected: boolean;
  now: number;
  greenHoldMinutes: number;
  /** Cantidad de repos con datos (para el conmutador opcional). */
  repoCount: number;
  onCycle?: () => void;
}

/** Etiqueta y clase compacta del indicador según el estado del deploy. */
const GH_LABEL: Record<VisualState, { text: string; cls: string; spin?: boolean; check?: boolean }> = {
  running: { text: "Publicando", cls: "gh-running", spin: true },
  success: { text: "Listo", cls: "gh-success", check: true },
  waiting: { text: "En espera", cls: "gh-waiting" },
  failed: { text: "Deploy fallido", cls: "gh-failed" },
  attention: { text: "Atención", cls: "gh-attention" },
  stale: { text: "Posible estancado", cls: "gh-attention" },
  unknown: { text: "Sin datos", cls: "gh-unknown" },
  offline: { text: "Sin conexión", cls: "gh-unknown" },
};

/** Marca de GitHub (logo oficial, monocromo con currentColor). */
function GithubMark() {
  return (
    <svg viewBox="0 0 16 16" width="1em" height="1em" aria-hidden="true" className="gh-mark">
      <path
        fill="currentColor"
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"
      />
    </svg>
  );
}

/**
 * Indicador secundario compacto del estado del deploy de GitHub. Reutiliza
 * `computeVisual` (misma lógica de running/success/waiting/stale/offline que el
 * semáforo original) pero se renderiza pequeño, a la derecha, y solo el propio
 * indicador se anima. Nunca cambia el color del área principal de los agentes.
 */
export function GithubIndicator({
  record,
  connected,
  now,
  greenHoldMinutes,
  repoCount,
  onCycle,
}: Props) {
  const { state } = computeVisual(record, connected, now, greenHoldMinutes);
  const meta = GH_LABEL[state];
  const repoShort = record
    ? record.displayName || record.repository.split("/").pop() || record.repository
    : "GitHub";

  return (
    <aside className={`gh-indicator ${meta.cls}`} aria-label="Estado del deploy de GitHub">
      <header className="gh-head">
        <GithubMark />
        <span className="gh-repo" title={record?.repository}>
          {repoShort}
        </span>
        {repoCount > 1 && (
          <button type="button" className="gh-cycle" onClick={onCycle} aria-label="Siguiente repo">
            ⟳
          </button>
        )}
      </header>

      <div className="gh-state">
        {meta.spin && <span className="gh-spinner" aria-hidden="true" />}
        {meta.check && <span className="gh-check" aria-hidden="true">✔</span>}
        <span className="gh-state-text">{meta.text}</span>
      </div>

      {record && (
        <dl className="gh-details">
          {record.branch && (
            <div className="gh-row">
              <dt>rama</dt>
              <dd>{record.branch}</dd>
            </div>
          )}
          {record.shortSha && (
            <div className="gh-row">
              <dt>commit</dt>
              <dd>
                {record.runUrl ? (
                  <a href={record.runUrl} target="_blank" rel="noreferrer noopener">
                    {record.shortSha}
                  </a>
                ) : (
                  record.shortSha
                )}
              </dd>
            </div>
          )}
          <div className="gh-row">
            <dt>act.</dt>
            <dd>{formatClock(record.updatedAt)}</dd>
          </div>
        </dl>
      )}
    </aside>
  );
}
