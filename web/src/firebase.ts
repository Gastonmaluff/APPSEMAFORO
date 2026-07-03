import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getDatabase,
  ref,
  onValue,
  type Database,
  type Unsubscribe,
} from "firebase/database";
import type { DisplayMeta, DisplayRecord } from "./types";
import type { AgentRecord, AgentsState } from "./agents/types";

export const DISPLAY_ID = "deck";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/** `true` si las variables mínimas de Firebase están presentes. */
export const isConfigured = Boolean(config.databaseURL && config.apiKey);

let app: FirebaseApp | null = null;
let db: Database | null = null;

if (isConfigured) {
  app = initializeApp(config);
  db = getDatabase(app);
}

/** Escucha todos los repos del display en tiempo real. */
export function subscribeRepos(
  cb: (repos: Record<string, DisplayRecord>) => void,
): Unsubscribe {
  if (!db) return () => {};
  const r = ref(db, `displays/${DISPLAY_ID}/repos`);
  return onValue(r, (snap) => {
    cb((snap.val() as Record<string, DisplayRecord>) ?? {});
  });
}

/** Escucha la metadata del display (heartbeat del backend). */
export function subscribeMeta(cb: (meta: DisplayMeta | null) => void): Unsubscribe {
  if (!db) return () => {};
  const r = ref(db, `displays/${DISPLAY_ID}/meta`);
  return onValue(r, (snap) => cb((snap.val() as DisplayMeta) ?? null));
}

/** Escucha el estado de ambos agentes (Claude Code / Codex) en tiempo real. */
export function subscribeAgents(cb: (state: AgentsState) => void): Unsubscribe {
  if (!db) return () => {};
  const r = ref(db, "agents");
  return onValue(r, (snap) => {
    const val = (snap.val() as Record<string, unknown>) ?? {};
    cb({
      claude: (val.claude as AgentRecord) ?? null,
      codex: (val.codex as AgentRecord) ?? null,
      meta: (val.meta as AgentsState["meta"]) ?? null,
    });
  });
}

/** Estado de conexión de Firebase (nodo especial `.info/connected`). */
export function subscribeConnection(cb: (connected: boolean) => void): Unsubscribe {
  if (!db) {
    cb(false);
    return () => {};
  }
  const r = ref(db, ".info/connected");
  return onValue(r, (snap) => cb(snap.val() === true));
}
