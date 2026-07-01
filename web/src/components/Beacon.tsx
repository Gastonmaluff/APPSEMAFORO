import { type ReactNode, useEffect, useRef, useState } from "react";
import type { VisualDef } from "../status";
import type { DisplayRecord, VisualState } from "../types";
import { formatClock, formatDuration, relativeAge } from "../time";

interface Props {
  state: VisualState;
  def: VisualDef;
  record: DisplayRecord | null;
  now: number;
  configured: boolean;
  needsActivation: boolean;
  controlsVisible: boolean;
  controls: ReactNode;
  onReveal: () => void;
  onActivate: () => void;
}

/** Segundos que dura la animación de confirmación al pasar a verde. */
const CONFIRM_MS = 3500;

export function Beacon({
  state,
  def,
  record,
  now,
  configured,
  needsActivation,
  controlsVisible,
  controls,
  onReveal,
  onActivate,
}: Props) {
  const [confirming, setConfirming] = useState(false);
  const prevState = useRef<VisualState | null>(null);

  // Dispara la animación de confirmación en la transición hacia "success".
  useEffect(() => {
    if (state === "success" && prevState.current && prevState.current !== "success") {
      setConfirming(true);
      const id = window.setTimeout(() => setConfirming(false), CONFIRM_MS);
      prevState.current = state;
      return () => window.clearTimeout(id);
    }
    prevState.current = state;
  }, [state]);

  const elapsed = computeElapsed(state, record, now);
  const rootClass = [
    "beacon",
    def.className,
    confirming ? "confirming" : "",
    controlsVisible ? "controls-open" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <main className={rootClass} onClick={onReveal} role="status" aria-live="polite">
      <div className="beacon-center">
        <h1 className="big-word">{def.bigText}</h1>

        {def.hint && <div className="hint">{def.hint}</div>}

        {record && (
          <div className="details">
            <span className="project">{record.displayName}</span>
            <span className="sep">·</span>
            <span className="workflow">{record.workflowName}</span>
          </div>
        )}

        <div className="metrics">
          {elapsed && <span className="metric elapsed">{elapsed}</span>}
          {record && (
            <span className="metric updated">
              act. {formatClock(record.updatedAt)}{" "}
              <em>({relativeAge(Date.parse(record.updatedAt), now)})</em>
            </span>
          )}
        </div>

        {!configured && (
          <div className="config-warning">Falta configurar Firebase (.env)</div>
        )}
      </div>

      {confirming && <div className="confirm-check" aria-hidden="true">✔</div>}

      {needsActivation && (
        <div className="activation-layer" onClick={(e) => e.stopPropagation()}>
          <button
            className="activate-btn"
            onClick={onActivate}
            type="button"
          >
            ACTIVAR MODO SEMÁFORO
          </button>
          <p className="activation-note">
            Pantalla completa · mantiene el display encendido
          </p>
        </div>
      )}

      {controlsVisible && (
        <div className="controls-layer" onClick={(e) => e.stopPropagation()}>
          {controls}
        </div>
      )}
    </main>
  );
}

/** Texto de tiempo transcurrido según el estado. */
function computeElapsed(
  state: VisualState,
  record: DisplayRecord | null,
  now: number,
): string | null {
  if (!record) return null;
  if ((state === "running" || state === "stale") && record.startedAt) {
    const secs = (now - Date.parse(record.startedAt)) / 1000;
    return `⏱ ${formatDuration(secs)}`;
  }
  if (state === "success" && record.durationSeconds != null) {
    return `en ${formatDuration(record.durationSeconds)}`;
  }
  return null;
}
