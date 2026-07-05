import type { AgentId } from "../agents/types";
import { AGENT_NAME } from "../agents/state";

/**
 * Logo oficial del agente (PNG con fondo transparente en
 * `web/public/{codex,claude}-logo.png`; fuente sin procesar en `web/logos-src/`).
 * El tamaño/glow los aplica el CSS.
 */
export function AgentLogo({ agent, className = "" }: { agent: AgentId; className?: string }) {
  return (
    <img
      src={`/${agent}-logo.png`}
      alt={AGENT_NAME[agent]}
      className={`agent-logo agent-logo--${agent} ${className}`.trim()}
      draggable={false}
    />
  );
}
