import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgentStage } from "./components/AgentStage";
import { GithubIndicator } from "./components/GithubIndicator";
import { Controls } from "./components/Controls";
import { ConfigPanel } from "./components/ConfigPanel";
import { deriveAgentVisual } from "./agents/state";
import { useAgentsData } from "./hooks/useAgentsData";
import { useDisplayData } from "./hooks/useDisplayData";
import { useWakeLock } from "./hooks/useWakeLock";
import { loadPrefs, savePrefs, type Prefs } from "./prefs";
import { playFailure, playSuccess, warmUpAudio } from "./sound";
import type { DisplayRecord } from "./types";

/** Ordena los repos por última actualización (más reciente primero). */
function orderRepos(repos: Record<string, DisplayRecord>): string[] {
  return Object.keys(repos).sort((a, b) => {
    const ta = Date.parse(repos[a]?.updatedAt ?? "") || 0;
    const tb = Date.parse(repos[b]?.updatedAt ?? "") || 0;
    return tb - ta;
  });
}

export default function App() {
  const agentsData = useAgentsData();
  const gh = useDisplayData();
  const wakeLock = useWakeLock();

  const [prefs, setPrefsState] = useState<Prefs>(() => loadPrefs());
  const [view, setView] = useState<"beacon" | "config">("beacon");
  const [now, setNow] = useState(() => Date.now());
  const [controlsVisible, setControlsVisible] = useState(false);
  const [rotationIndex, setRotationIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [cursorHidden, setCursorHidden] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelPinned, setPanelPinned] = useState(false);

  const controlsTimer = useRef<number | null>(null);
  const cursorTimer = useRef<number | null>(null);
  const panelCloseTimer = useRef<number | null>(null);
  const prevGhStatus = useRef<Record<string, string>>({});

  const setPrefs = useCallback((next: Prefs) => {
    setPrefsState(next);
    savePrefs(next);
  }, []);

  // --- Drawer del panel lateral (off-canvas; no toca datos ni listeners) ---
  const openPanel = useCallback(() => {
    if (panelCloseTimer.current) {
      window.clearTimeout(panelCloseTimer.current);
      panelCloseTimer.current = null;
    }
    setPanelOpen(true);
  }, []);
  const scheduleClosePanel = useCallback(() => {
    if (panelCloseTimer.current) window.clearTimeout(panelCloseTimer.current);
    // Retardo para no cerrarlo si el cursor se mueve dentro del panel.
    panelCloseTimer.current = window.setTimeout(() => setPanelOpen(false), 650);
  }, []);
  const togglePanel = useCallback(() => setPanelOpen((o) => !o), []);
  const togglePin = useCallback(() => setPanelPinned((p) => !p), []);

  // Reloj de 1s para cronómetros, holds y hora.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // --- Indicador GitHub: repo enfocado + rotación (secundario) ---
  const ordered = useMemo(() => orderRepos(gh.repos), [gh.repos]);
  useEffect(() => {
    if (!prefs.rotate || ordered.length <= 1) return;
    const id = window.setInterval(
      () => setRotationIndex((i) => i + 1),
      Math.max(4, prefs.rotateSeconds) * 1000,
    );
    return () => window.clearInterval(id);
  }, [prefs.rotate, prefs.rotateSeconds, ordered.length]);

  const focusRepoId = useMemo(() => {
    if (prefs.focusRepoId && gh.repos[prefs.focusRepoId]) return prefs.focusRepoId;
    if (ordered.length === 0) return null;
    if (prefs.rotate) return ordered[rotationIndex % ordered.length] ?? ordered[0];
    return ordered[0];
  }, [prefs.focusRepoId, prefs.rotate, ordered, rotationIndex, gh.repos]);

  const ghRecord: DisplayRecord | null = useMemo(() => {
    const raw = focusRepoId ? (gh.repos[focusRepoId] ?? null) : null;
    if (raw && focusRepoId && prefs.aliases[focusRepoId]) {
      return { ...raw, displayName: prefs.aliases[focusRepoId] as string };
    }
    return raw;
  }, [focusRepoId, gh.repos, prefs.aliases]);

  // Alertas sonoras opcionales al cambiar el deploy de GitHub a LISTO / FALLÓ.
  useEffect(() => {
    if (!ghRecord || !focusRepoId) return;
    const prev = prevGhStatus.current[focusRepoId];
    if (prev && prev !== ghRecord.status) {
      if (prefs.sound && ghRecord.status === "success") playSuccess();
      if (prefs.sound && ghRecord.status === "failed") playFailure();
    }
    prevGhStatus.current[focusRepoId] = ghRecord.status;
  }, [ghRecord, focusRepoId, prefs.sound]);

  const holdOpts = useMemo(
    () => ({
      greenHoldSec: prefs.agentGreenHoldSec,
      errorHoldSec: prefs.agentErrorHoldSec,
      orphanMin: prefs.agentOrphanMin,
    }),
    [prefs.agentGreenHoldSec, prefs.agentErrorHoldSec, prefs.agentOrphanMin],
  );

  // Contextos activos = tareas vivas de ambos agentes (para el panel lateral).
  const activeContexts = useMemo(
    () =>
      deriveAgentVisual(agentsData.agents.claude, now, holdOpts).activeCount +
      deriveAgentVisual(agentsData.agents.codex, now, holdOpts).activeCount,
    [agentsData.agents, now, holdOpts],
  );

  // Mostrar controles unos segundos al tocar la pantalla.
  const revealControls = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimer.current) window.clearTimeout(controlsTimer.current);
    controlsTimer.current = window.setTimeout(() => setControlsVisible(false), 4500);
  }, []);

  // Ocultar el cursor tras inactividad.
  const pokeCursor = useCallback(() => {
    setCursorHidden(false);
    if (cursorTimer.current) window.clearTimeout(cursorTimer.current);
    cursorTimer.current = window.setTimeout(() => setCursorHidden(true), 4000);
  }, []);
  useEffect(() => {
    window.addEventListener("mousemove", pokeCursor);
    window.addEventListener("touchstart", pokeCursor);
    pokeCursor();
    return () => {
      window.removeEventListener("mousemove", pokeCursor);
      window.removeEventListener("touchstart", pokeCursor);
      if (cursorTimer.current) window.clearTimeout(cursorTimer.current);
    };
  }, [pokeCursor]);

  const enterFullscreen = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen?.();
      setFullscreen(true);
    } catch {
      /* el navegador puede bloquearlo fuera de un gesto */
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {
      /* ignore */
    }
    setFullscreen(false);
  }, []);

  useEffect(() => {
    const onFsChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const activate = useCallback(async () => {
    warmUpAudio();
    await enterFullscreen();
    await wakeLock.request();
    setPrefs({ ...prefs, beaconActivated: true });
  }, [enterFullscreen, wakeLock, prefs, setPrefs]);

  if (view === "config") {
    return (
      <ConfigPanel
        prefs={prefs}
        setPrefs={setPrefs}
        repos={gh.repos}
        orderedIds={ordered}
        meta={gh.meta}
        connected={gh.connected}
        configured={gh.configured}
        agents={agentsData.agents}
        agentsConnected={agentsData.connected}
        now={now}
        onBack={() => setView("beacon")}
      />
    );
  }

  const showOfflinePill = agentsData.configured && !agentsData.connected;

  return (
    <div
      className={`app-root ${cursorHidden ? "cursor-hidden" : ""}`}
      onClick={revealControls}
    >
      <main className="stage-area">
        <AgentStage agents={agentsData.agents} now={now} holdOpts={holdOpts} />
      </main>

      {/* Zona/pestaña que revela el drawer (hover, foco, clic o toque). */}
      <button
        type="button"
        className="panel-trigger"
        aria-label={panelOpen ? "Ocultar panel de estado" : "Mostrar panel de estado"}
        aria-expanded={panelOpen || panelPinned}
        onMouseEnter={openPanel}
        onFocus={openPanel}
        onClick={(e) => {
          e.stopPropagation();
          togglePanel();
        }}
      />

      {/* Panel lateral off-canvas: SIEMPRE montado (conserva datos/listeners). */}
      <div
        className={`panel-drawer ${panelOpen || panelPinned ? "open" : ""}`}
        onMouseEnter={openPanel}
        onMouseLeave={scheduleClosePanel}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={`panel-pin ${panelPinned ? "pinned" : ""}`}
          onClick={togglePin}
          aria-pressed={panelPinned}
          aria-label={panelPinned ? "Desfijar panel" : "Fijar panel"}
          title={panelPinned ? "Desfijar" : "Fijar"}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <path
              fill="currentColor"
              d="M14 3.5 20.5 10l-1.4 1.4-1-.3-3.3 3.3.2 4.2-1.5 1.5-3-3-3.6 3.6-1-.4 3.6-3.6-3-3 1.5-1.5 4.2.2 3.3-3.3-.3-1L14 3.5Z"
            />
          </svg>
        </button>
        <GithubIndicator
          record={ghRecord}
          connected={gh.connected}
          now={now}
          greenHoldMinutes={prefs.greenHoldMinutes}
          activeContexts={activeContexts}
          maxContexts={5}
          onOpenConfig={() => setView("config")}
        />
      </div>

      {showOfflinePill && <div className="conn-pill">sin conexión — último estado</div>}

      {!agentsData.configured && (
        <div className="config-warning">Falta configurar Firebase (.env)</div>
      )}

      {!prefs.beaconActivated && (
        <div className="activation-layer" onClick={(e) => e.stopPropagation()}>
          <button className="activate-btn" onClick={activate} type="button">
            ACTIVAR MODO SEMÁFORO
          </button>
          <p className="activation-note">
            Pantalla completa · mantiene el display encendido
          </p>
        </div>
      )}

      {controlsVisible && (
        <div className="controls-layer" onClick={(e) => e.stopPropagation()}>
          <Controls
            record={ghRecord}
            fullscreen={fullscreen}
            wakeActive={wakeLock.active}
            wakeSupported={wakeLock.supported}
            multiRepo={ordered.length > 1}
            onOpenConfig={() => setView("config")}
            onCycle={() => setRotationIndex((i) => i + 1)}
            onToggleFullscreen={fullscreen ? exitFullscreen : enterFullscreen}
          />
        </div>
      )}
    </div>
  );
}
