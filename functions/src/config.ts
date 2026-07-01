/**
 * Configuración de repositorios monitoreados (allowlist del backend).
 *
 * Solo los repos, workflows y ramas declarados aquí pueden modificar la
 * pantalla del semáforo. Cualquier otro evento se descarta. No hay secretos
 * en este archivo: el secreto del webhook se inyecta por variable segura.
 */

export const DISPLAY_ID = "deck";

/** Estados visuales que entiende la web app. */
export type AppStatus = "running" | "success" | "failed" | "attention" | "unknown";

export interface MonitoredRepo {
  /** Clave estable usada en Realtime Database. */
  repoId: string;
  /** Alias visible en la pantalla. */
  displayName: string;
  /** Nombre EXACTO del workflow que representa el deploy real (workflow_run.name). */
  deployWorkflow: string;
  /** Rama que debe disparar el deploy. `null` = cualquier rama. */
  branch: string | null;
  /** URL pública de la app desplegada (solo informativa, no secreta). */
  pagesUrl: string;
}

/**
 * Allowlist principal. La clave es `owner/repo` tal como lo envía GitHub en
 * `repository.full_name`.
 */
export const MONITORED: Record<string, MonitoredRepo> = {
  "Gastonmaluff/NEXT-CONTROL": {
    repoId: "next-control",
    displayName: "Next Control",
    deployWorkflow: "Deploy to GitHub Pages",
    branch: "main",
    pagesUrl: "https://gastonmaluff.github.io/NEXT-CONTROL/",
  },
  "Gastonmaluff/Panel-de-Quintas-": {
    repoId: "panel-quintas",
    displayName: "Panel de Quintas",
    deployWorkflow: "Deploy GitHub Pages",
    branch: "main",
    pagesUrl: "https://gastonmaluff.github.io/Panel-de-Quintas-/",
  },
  "Gastonmaluff/CRMGAMIGOMITAS": {
    repoId: "crm-gamigomitas",
    displayName: "CRM Gami Gomitas",
    deployWorkflow: "pages build and deployment",
    branch: "main",
    pagesUrl: "https://gastonmaluff.github.io/CRMGAMIGOMITAS/",
  },
  "Gastonmaluff/LUCCAPARK-APP": {
    repoId: "luccapark",
    displayName: "Lucca Park",
    deployWorkflow: "pages build and deployment",
    branch: "gh-pages",
    pagesUrl: "https://gastonmaluff.github.io/LUCCAPARK-APP/",
  },
};

/** Nombre de la variable/secreto que guarda el HMAC del webhook. */
export const WEBHOOK_SECRET_NAME = "GH_WEBHOOK_SECRET";
