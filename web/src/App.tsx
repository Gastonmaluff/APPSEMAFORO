import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Beacon } from "./components/Beacon";
import { Controls } from "./components/Controls";
import { ConfigPanel } from "./components/ConfigPanel";
import { useDisplayData } from "./hooks/useDisplayData";
import { useWakeLock } from "./hooks/useWakeLock";
import { computeVisual } from "./status";
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
  const data = useDisplayData();
  const wakeLock = useWakeLock();

  const [prefs, setPrefsState] = useState<Prefs>(() => loadPrefs());
  const [view, setView] = useState<"beacon" | "config">("beacon");
  const [now, setNow] = useState(() => Date.now());
  const [controlsVisible, setControlsVisible] = useState(false);
  const [rotationIndex, setRotationIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  const controlsTimer = useRef<number | null>(null);
  const prevStatus = useRef<Record<string, string>>({});

  const setPrefs = useCallback((next: Prefs) => {
    setPrefsState(next);
    savePrefs(next);
  }, []);

  // Reloj de 1s para tiempo transcurrido, estancado y hora.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Rotación automática entre repos con datos.
  const ordered = useMemo(() => orderRepos(data.repos), [data.repos]);
  useEffect(() => {
    if (!prefs.rotate || ordered.length <= 1) return;
    const id = window.setInterval(
      () => setRotationIndex((i) => i + 1),
      Math.max(4, prefs.rotateSeconds) * 1000,
    );
    return () => window.clearInterval(id);
  }, [prefs.rotate, prefs.rotateSeconds, ordered.length]);

  // Repo enfocado: preferencia fija > rotación > más reciente.
  const focusRepoId = useMemo(() => {
    if (prefs.focusRepoId && data.repos[prefs.focusRepoId]) return prefs.focusRepoId;
    if (ordered.length === 0) return null;
    if (prefs.rotate) return ordered[rotationIndex % ordered.length] ?? ordered[0];
    return ordered[0];
  }, [prefs.focusRepoId, prefs.rotate, ordered, rotationIndex, data.repos]);

  const rawRecord = focusRepoId ? (data.repos[focusRepoId] ?? null) : null;
  // Aplica alias local si el usuario definió uno para este repo.
  const record: DisplayRecord | null =
    rawRecord && focusRepoId && prefs.aliases[focusRepoId]
      ? { ...rawRecord, displayName: prefs.aliases[focusRepoId] as string }
      : rawRecord;
  const { state, def } = computeVisual(
    record,
    data.connected,
    now,
    prefs.greenHoldMinutes,
  );

  // Alertas sonoras al cambiar a LISTO / FALLÓ.
  useEffect(() => {
    if (!record || !focusRepoId) return;
    const prev = prevStatus.current[focusRepoId];
    if (prev && prev !== record.status) {
      if (prefs.sound && record.status === "success") playSuccess();
      if (prefs.sound && record.status === "failed") playFailure();
    }
    prevStatus.current[focusRepoId] = record.status;
  }, [record, focusRepoId, prefs.sound]);

  // Mostrar controles unos segundos al tocar la pantalla.
  const revealControls = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimer.current) window.clearTimeout(controlsTimer.current);
    controlsTimer.current = window.setTimeout(() => setControlsVisible(false), 4500);
  }, []);

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

  const activateBeacon = useCallback(async () => {
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
        repos={data.repos}
        orderedIds={ordered}
        meta={data.meta}
        connected={data.connected}
        configured={data.configured}
        now={now}
        onBack={() => setView("beacon")}
      />
    );
  }

  return (
    <Beacon
      state={state}
      def={def}
      record={record}
      now={now}
      configured={data.configured}
      needsActivation={!prefs.beaconActivated}
      controlsVisible={controlsVisible}
      onReveal={revealControls}
      onActivate={activateBeacon}
      controls={
        <Controls
          record={record}
          fullscreen={fullscreen}
          wakeActive={wakeLock.active}
          wakeSupported={wakeLock.supported}
          multiRepo={ordered.length > 1}
          onOpenConfig={() => setView("config")}
          onCycle={() => setRotationIndex((i) => i + 1)}
          onToggleFullscreen={fullscreen ? exitFullscreen : enterFullscreen}
        />
      }
    />
  );
}
