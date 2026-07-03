import { AgentLogo } from "./AgentLogo";
import { AGENT_DEF, AGENT_NAME, type AgentView } from "../agents/state";
import type { AgentId } from "../agents/types";
import { formatDuration } from "../time";

interface Props {
  agent: AgentId;
  view: AgentView;
  now: number;
  /** "full" = ocupa todo; "split" = mitad de pantalla. */
  variant: "full" | "split";
}

/**
 * Panel de un agente: color de fondo grande según el estado (idle/working/
 * completed/error), logo, nombre, proyecto y cantidad de tareas activas.
 */
export function AgentPanel({ agent, view, now, variant }: Props) {
  const def = AGENT_DEF[view.visual];
  const elapsed =
    view.visual === "working" && view.since
      ? formatDuration((now - view.since) / 1000)
      : null;

  return (
    <section className={`agent-panel ${def.className} agent-panel--${variant}`}>
      <div className="agent-panel-body">
        <AgentLogo agent={agent} className="agent-panel-logo" />
        <div className="agent-name">{AGENT_NAME[agent]}</div>
        <div className="agent-status">{def.label}</div>

        {view.project && <div className="agent-project">{view.project}</div>}

        <div className="agent-metrics">
          {view.activeCount > 1 && (
            <span className="agent-count">{view.activeCount} tareas</span>
          )}
          {view.activeCount === 1 && view.visual === "working" && (
            <span className="agent-count">1 tarea</span>
          )}
          {elapsed && <span className="agent-elapsed">⏱ {elapsed}</span>}
        </div>
      </div>
    </section>
  );
}
