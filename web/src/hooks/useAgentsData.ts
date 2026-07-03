import { useEffect, useState } from "react";
import { isConfigured, subscribeAgents, subscribeConnection } from "../firebase";
import type { AgentsState } from "../agents/types";

const CACHE_KEY = "semaforo:agents:v1";

function loadCache(): AgentsState {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) return JSON.parse(raw) as AgentsState;
  } catch {
    /* ignore */
  }
  return { claude: null, codex: null, meta: null };
}

function saveCache(state: AgentsState): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export interface AgentsData {
  agents: AgentsState;
  connected: boolean;
  configured: boolean;
  hydrated: boolean;
}

/**
 * Suscribe a `agents/` en tiempo real. Cachea el último snapshot en
 * localStorage para sobrevivir recargas y desconexiones breves (muestra el
 * último estado conocido en vez de parpadear a vacío).
 */
export function useAgentsData(): AgentsData {
  const [agents, setAgents] = useState<AgentsState>(() => loadCache());
  const [connected, setConnected] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!isConfigured) return;
    const unsubAgents = subscribeAgents((next) => {
      setAgents(next);
      setHydrated(true);
      saveCache(next);
    });
    const unsubConn = subscribeConnection(setConnected);
    return () => {
      unsubAgents();
      unsubConn();
    };
  }, []);

  return { agents, connected, configured: isConfigured, hydrated };
}
