import { WorkflowRunEvent } from "../state";

/**
 * Genera un payload de prueba de `workflow_run` sin datos confidenciales.
 * Valores neutros y sintéticos; no representa un run real.
 */
export function makeEvent(
  overrides: {
    action?: string;
    repo?: string;
    workflow?: string;
    branch?: string | null;
    conclusion?: string | null;
    status?: string | null;
  } = {},
): WorkflowRunEvent {
  return {
    action: overrides.action ?? "requested",
    repository: { full_name: overrides.repo ?? "Gastonmaluff/NEXT-CONTROL" },
    workflow_run: {
      id: 123456,
      name: overrides.workflow ?? "Deploy to GitHub Pages",
      head_branch: overrides.branch === undefined ? "main" : overrides.branch,
      head_sha: "abcdef1234567890abcdef1234567890abcdef12",
      run_number: 42,
      status: overrides.status ?? "queued",
      conclusion: overrides.conclusion ?? null,
      html_url: "https://github.com/Gastonmaluff/NEXT-CONTROL/actions/runs/123456",
      created_at: "2026-06-30T10:00:00Z",
      run_started_at: "2026-06-30T10:00:05Z",
      updated_at: "2026-06-30T10:01:35Z",
    },
  };
}
