import { AgentPanel } from "./AgentPanel";
import { AgentLogo } from "./AgentLogo";
import { deriveAgentVisual, deriveLayout, type HoldOpts } from "../agents/state";
import type { AgentsState } from "../agents/types";

interface Props {
  agents: AgentsState;
  now: number;
  holdOpts: HoldOpts;
}

/**
 * Área principal del semáforo, controlada por los agentes:
 *  - "none": pantalla gris única "Sin tareas" con logos tenues.
 *  - un solo agente presente: ocupa toda el área.
 *  - ambos presentes: split vertical (Codex izquierda, Claude derecha),
 *    con estados independientes.
 */
export function AgentStage({ agents, now, holdOpts }: Props) {
  const claude = deriveAgentVisual(agents.claude, now, holdOpts);
  const codex = deriveAgentVisual(agents.codex, now, holdOpts);
  const layout = deriveLayout(claude, codex);

  if (layout === "none") {
    return (
      <div className="agent-stage stage-none">
        <div className="idle-logos">
          <AgentLogo agent="codex" className="idle-logo" />
          <AgentLogo agent="claude" className="idle-logo" />
        </div>
        <h1 className="idle-title">Sin tareas</h1>
      </div>
    );
  }

  if (layout === "both") {
    // Codex a la izquierda, Claude a la derecha; cada lado independiente.
    return (
      <div className="agent-stage stage-both">
        <AgentPanel agent="codex" view={codex} now={now} variant="split" />
        <AgentPanel agent="claude" view={claude} now={now} variant="split" />
      </div>
    );
  }

  const single = layout === "claude" ? "claude" : "codex";
  const view = single === "claude" ? claude : codex;
  return (
    <div className="agent-stage stage-single">
      <AgentPanel agent={single} view={view} now={now} variant="full" />
    </div>
  );
}
