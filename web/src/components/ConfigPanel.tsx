import { useState } from "react";
import type { DisplayMeta, DisplayRecord, VisualState } from "../types";
import type { Prefs } from "../prefs";
import { relativeAge } from "../time";

interface Props {
  prefs: Prefs;
  setPrefs: (p: Prefs) => void;
  repos: Record<string, DisplayRecord>;
  orderedIds: string[];
  meta: DisplayMeta | null;
  connected: boolean;
  configured: boolean;
  now: number;
  onBack: () => void;
}

const TEST_COLORS: { state: VisualState; label: string; cls: string }[] = [
  { state: "running", label: "EJECUTANDO", cls: "state-running" },
  { state: "success", label: "LISTO", cls: "state-success" },
  { state: "failed", label: "FALLÓ", cls: "state-failed" },
  { state: "attention", label: "ATENCIÓN", cls: "state-attention" },
  { state: "unknown", label: "SIN DATOS", cls: "state-unknown" },
];

export function ConfigPanel({
  prefs,
  setPrefs,
  repos,
  orderedIds,
  meta,
  connected,
  configured,
  now,
  onBack,
}: Props) {
  const [preview, setPreview] = useState<{ cls: string; label: string } | null>(null);

  const update = (patch: Partial<Prefs>) => setPrefs({ ...prefs, ...patch });

  const setAlias = (repoId: string, value: string) => {
    const aliases = { ...prefs.aliases };
    if (value.trim()) aliases[repoId] = value.trim();
    else delete aliases[repoId];
    update({ aliases });
  };

  return (
    <div className="config">
      {preview && (
        <div
          className={`preview-overlay ${preview.cls}`}
          onClick={() => setPreview(null)}
        >
          <span className="big-word">{preview.label}</span>
          <span className="preview-tap">tocar para cerrar</span>
        </div>
      )}

      <header className="config-header">
        <h2>Configuración</h2>
        <button type="button" className="ctl primary" onClick={onBack}>
          ← Volver al semáforo
        </button>
      </header>

      <section className="config-section">
        <h3>Estado de conexión</h3>
        <p>
          Firebase:{" "}
          <strong className={connected ? "ok" : "bad"}>
            {configured ? (connected ? "conectado" : "desconectado") : "sin configurar"}
          </strong>
        </p>
        <p>
          Último webhook recibido:{" "}
          <strong>
            {meta?.lastWebhookAt ? relativeAge(meta.lastWebhookAt, now) : "—"}
          </strong>
        </p>
      </section>

      <section className="config-section">
        <h3>Proyecto a mostrar</h3>
        <select
          value={prefs.focusRepoId ?? ""}
          onChange={(e) => update({ focusRepoId: e.target.value || null })}
        >
          <option value="">Automático (más reciente)</option>
          {orderedIds.map((id) => (
            <option key={id} value={id}>
              {prefs.aliases[id] ?? repos[id]?.displayName ?? id}
            </option>
          ))}
        </select>

        <label className="switch">
          <input
            type="checkbox"
            checked={prefs.rotate}
            onChange={(e) => update({ rotate: e.target.checked })}
          />
          Rotación automática entre proyectos
        </label>
        {prefs.rotate && (
          <label className="inline">
            Segundos por proyecto:
            <input
              type="number"
              min={4}
              max={120}
              value={prefs.rotateSeconds}
              onChange={(e) =>
                update({ rotateSeconds: Number(e.target.value) || 12 })
              }
            />
          </label>
        )}

        <label className="switch">
          <input
            type="checkbox"
            checked={prefs.sound}
            onChange={(e) => update({ sound: e.target.checked })}
          />
          Sonar alerta al finalizar o fallar
        </label>

        <label className="inline">
          Minutos en verde antes de pasar a “EN ESPERA”:
          <input
            type="number"
            min={1}
            max={120}
            value={prefs.greenHoldMinutes}
            onChange={(e) =>
              update({ greenHoldMinutes: Math.max(1, Number(e.target.value) || 3) })
            }
          />
        </label>
      </section>

      <section className="config-section">
        <h3>Proyectos detectados</h3>
        {orderedIds.length === 0 && (
          <p className="muted">
            Todavía no llegó ningún evento. Ejecutá un deploy para ver datos.
          </p>
        )}
        <ul className="repo-list">
          {orderedIds.map((id) => {
            const r = repos[id];
            if (!r) return null;
            return (
              <li key={id} className="repo-item">
                <div className="repo-line">
                  <span className={`dot ${r.status}`} />
                  <strong>{r.displayName}</strong>
                  <span className="muted">{r.repository}</span>
                </div>
                <div className="repo-controls">
                  <input
                    type="text"
                    placeholder="Alias visible…"
                    defaultValue={prefs.aliases[id] ?? ""}
                    onBlur={(e) => setAlias(id, e.target.value)}
                  />
                  {r.runUrl && (
                    <a href={r.runUrl} target="_blank" rel="noreferrer noopener">
                      Abrir run ↗
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="config-section">
        <h3>Probar colores</h3>
        <div className="test-colors">
          {TEST_COLORS.map((t) => (
            <button
              key={t.state}
              type="button"
              className={`test-swatch ${t.cls}`}
              onClick={() => setPreview({ cls: t.cls, label: t.label })}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
