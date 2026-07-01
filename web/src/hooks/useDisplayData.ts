import { useEffect, useState } from "react";
import {
  isConfigured,
  subscribeConnection,
  subscribeMeta,
  subscribeRepos,
} from "../firebase";
import { loadLastRepos, saveLastRepos } from "../prefs";
import type { DisplayMeta, DisplayRecord } from "../types";

export interface DisplayData {
  repos: Record<string, DisplayRecord>;
  meta: DisplayMeta | null;
  /** Conectado a Firebase (o sin configurar => false). */
  connected: boolean;
  configured: boolean;
  /** Se recibió al menos un snapshot en esta sesión. */
  hydrated: boolean;
}

/**
 * Suscribe a Realtime Database y expone el estado en vivo. Cachea el último
 * snapshot en localStorage para mostrar algo tras recargar u offline.
 */
export function useDisplayData(): DisplayData {
  const [repos, setRepos] = useState<Record<string, DisplayRecord>>(
    () => loadLastRepos<Record<string, DisplayRecord>>() ?? {},
  );
  const [meta, setMeta] = useState<DisplayMeta | null>(null);
  const [connected, setConnected] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!isConfigured) return;
    const unsubRepos = subscribeRepos((next) => {
      setRepos(next);
      setHydrated(true);
      saveLastRepos(next);
    });
    const unsubMeta = subscribeMeta(setMeta);
    const unsubConn = subscribeConnection(setConnected);
    return () => {
      unsubRepos();
      unsubMeta();
      unsubConn();
    };
  }, []);

  return { repos, meta, connected, configured: isConfigured, hydrated };
}
