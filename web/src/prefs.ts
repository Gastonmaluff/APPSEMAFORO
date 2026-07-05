/** Preferencias locales del semáforo (persisten en el navegador). */
export interface Prefs {
  /** repoId enfocado; null = automático (el más reciente). */
  focusRepoId: string | null;
  /** Rotación automática entre repos con datos. */
  rotate: boolean;
  /** Segundos por repo cuando la rotación está activa. */
  rotateSeconds: number;
  /** Sonar alerta al finalizar (success) o fallar (failed). */
  sound: boolean;
  /** El usuario ya activó el modo semáforo (fullscreen + wakelock). */
  beaconActivated: boolean;
  /** Alias visibles locales por repoId (sobrescriben el del backend). */
  aliases: Record<string, string>;
  /** Minutos que el verde de GitHub permanece antes de pasar a gris "EN ESPERA". */
  greenHoldMinutes: number;
  /** Segundos que un agente permanece en verde ("LISTO") tras completar. */
  agentGreenHoldSec: number;
  /** Segundos que un agente permanece en rojo ("ERROR") tras fallar. */
  agentErrorHoldSec: number;
  /** Minutos sin actividad tras los cuales una tarea de agente se considera huérfana. */
  agentOrphanMin: number;
}

const KEY = "semaforo:prefs:v1";

export const DEFAULT_PREFS: Prefs = {
  focusRepoId: null,
  rotate: false,
  rotateSeconds: 12,
  sound: false,
  beaconActivated: false,
  aliases: {},
  greenHoldMinutes: 3,
  agentGreenHoldSec: 120,
  agentErrorHoldSec: 300,
  agentOrphanMin: 45,
};

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(prefs: Prefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* almacenamiento no disponible: se ignora */
  }
}

const LAST_STATE_KEY = "semaforo:lastRepos:v1";

/** Guarda el último snapshot conocido para sobrevivir recargas / offline. */
export function saveLastRepos(repos: unknown): void {
  try {
    localStorage.setItem(LAST_STATE_KEY, JSON.stringify(repos));
  } catch {
    /* ignore */
  }
}

export function loadLastRepos<T>(): T | null {
  try {
    const raw = localStorage.getItem(LAST_STATE_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
