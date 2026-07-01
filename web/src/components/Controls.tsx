import type { DisplayRecord } from "../types";

interface Props {
  record: DisplayRecord | null;
  fullscreen: boolean;
  wakeActive: boolean;
  wakeSupported: boolean;
  multiRepo: boolean;
  onOpenConfig: () => void;
  onCycle: () => void;
  onToggleFullscreen: () => void;
}

/** Controles discretos que aparecen unos segundos al tocar la pantalla. */
export function Controls({
  record,
  fullscreen,
  wakeActive,
  wakeSupported,
  multiRepo,
  onOpenConfig,
  onCycle,
  onToggleFullscreen,
}: Props) {
  return (
    <div className="controls">
      <button type="button" className="ctl" onClick={onOpenConfig}>
        ⚙ Configurar
      </button>

      {multiRepo && (
        <button type="button" className="ctl" onClick={onCycle}>
          ⟳ Siguiente repo
        </button>
      )}

      <button type="button" className="ctl" onClick={onToggleFullscreen}>
        {fullscreen ? "⤢ Salir pantalla" : "⛶ Pantalla completa"}
      </button>

      {record?.runUrl && (
        <a
          className="ctl"
          href={record.runUrl}
          target="_blank"
          rel="noreferrer noopener"
        >
          ↗ Abrir run
        </a>
      )}

      {wakeSupported && (
        <span className={`wake-pill ${wakeActive ? "on" : "off"}`}>
          {wakeActive ? "● pantalla activa" : "○ wake lock off"}
        </span>
      )}
    </div>
  );
}
