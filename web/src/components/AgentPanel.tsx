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
 * Panel de un agente: fondo radial premium según el estado (idle/working/
 * completed/error), logo real, nombre, estado grande, proyecto y tareas/tiempo.
 * Solo presentación — el estado ya viene resuelto en `view`.
 */
export function AgentPanel({ agent, view, now, variant }: Props) {
  const def = AGENT_DEF[view.visual];
  const elapsed =
    view.visual === "working" && view.since
      ? formatDuration((now - view.since) / 1000)
      : null;
  const taskLabel =
    view.activeCount > 0
      ? `${view.activeCount} ${view.activeCount === 1 ? "tarea" : "tareas"}`
      : null;
  const meta = [taskLabel, elapsed].filter(Boolean).join("  ·  ");

  return (
    <section className={`agent-panel panel-${agent} ${def.className} agent-panel--${variant}`}>
      <div className="agent-panel-body">
        <AgentLogo agent={agent} className="agent-panel-logo" />
        <div className="agent-name">{AGENT_NAME[agent]}</div>
        <h1 className="agent-status">{def.label}</h1>
        {view.project && <div className="agent-project">{view.project}</div>}
        {meta && <div className="agent-meta">{meta}</div>}
      </div>
    </section>
  );
}
