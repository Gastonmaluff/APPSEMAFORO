import type { AgentId } from "../agents/types";
import { AGENT_NAME } from "../agents/state";

/**
 * Logo local del agente. Se pinta con `currentColor` vía CSS mask, por lo que
 * hereda el color del panel y puede atenuarse. Los archivos viven en
 * `web/public/{claude,codex}-logo.svg` y pueden reemplazarse por los oficiales
 * sin tocar código.
 */
export function AgentLogo({ agent, className = "" }: { agent: AgentId; className?: string }) {
  return (
    <span
      className={`agent-logo agent-logo--${agent} ${className}`.trim()}
      role="img"
      aria-label={AGENT_NAME[agent]}
    />
  );
}
