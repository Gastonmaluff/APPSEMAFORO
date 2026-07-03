import { describe, it, expect } from "vitest";
import {
  AGENT_GREEN_HOLD_SEC,
  deriveAgentVisual,
  deriveLayout,
} from "./state";
import type { AgentRecord, AgentTask } from "./types";

const now = Date.parse("2026-07-02T12:00:00Z");

function task(over: Partial<AgentTask> = {}): AgentTask {
  return {
    startedAt: now - 5000,
    lastActivityAt: now - 1000,
    sessionId: "s",
    cwd: "next-control",
    ...over,
  };
}

function rec(over: Partial<AgentRecord> = {}): AgentRecord {
  return {
    status: "working",
    activeCount: 0,
    tasks: {},
    lastCompletedAt: null,
    lastError: null,
    lastCwd: "next-control",
    updatedAt: now,
    ...over,
  };
}

describe("deriveAgentVisual", () => {
  it("sin registro -> idle", () => {
    expect(deriveAgentVisual(null, now).visual).toBe("idle");
  });

  it("una tarea viva -> working, con proyecto y activeCount", () => {
    const v = deriveAgentVisual(rec({ tasks: { s: task() } }), now);
    expect(v.visual).toBe("working");
    expect(v.activeCount).toBe(1);
    expect(v.project).toBe("next-control");
  });

  it("dos tareas vivas -> working con activeCount 2", () => {
    const v = deriveAgentVisual(
      rec({ tasks: { a: task({ sessionId: "a" }), b: task({ sessionId: "b" }) } }),
      now,
    );
    expect(v.visual).toBe("working");
    expect(v.activeCount).toBe(2);
  });

  it("completed reciente -> completed (verde)", () => {
    const v = deriveAgentVisual(
      rec({ status: "completed", tasks: {}, lastCompletedAt: now - 30_000 }),
      now,
    );
    expect(v.visual).toBe("completed");
  });

  it(`completed viejo (> ${AGENT_GREEN_HOLD_SEC}s) -> idle`, () => {
    const v = deriveAgentVisual(
      rec({ status: "completed", tasks: {}, lastCompletedAt: now - (AGENT_GREEN_HOLD_SEC + 10) * 1000 }),
      now,
    );
    expect(v.visual).toBe("idle");
  });

  it("una tarea nueva tiene prioridad sobre un completed reciente (verde->azul)", () => {
    const v = deriveAgentVisual(
      rec({ status: "working", tasks: { s: task() }, lastCompletedAt: now - 10_000 }),
      now,
    );
    expect(v.visual).toBe("working");
  });

  it("error reciente -> error (rojo)", () => {
    const v = deriveAgentVisual(
      rec({ status: "error", tasks: {}, lastError: now - 30_000 }),
      now,
    );
    expect(v.visual).toBe("error");
  });

  it("tarea huérfana (lastActivity muy vieja) se ignora -> idle", () => {
    const v = deriveAgentVisual(
      rec({ tasks: { s: task({ lastActivityAt: now - 60 * 60000 }) } }),
      now,
    );
    expect(v.visual).toBe("idle");
  });

  it("hold del verde configurable", () => {
    const r = rec({ status: "completed", tasks: {}, lastCompletedAt: now - 200 * 1000 });
    expect(deriveAgentVisual(r, now, { greenHoldSec: 300 }).visual).toBe("completed");
    expect(deriveAgentVisual(r, now, { greenHoldSec: 60 }).visual).toBe("idle");
  });
});

describe("deriveLayout", () => {
  const idle = deriveAgentVisual(null, now);
  const working = deriveAgentVisual(rec({ tasks: { s: task() } }), now);
  const done = deriveAgentVisual(rec({ status: "completed", tasks: {}, lastCompletedAt: now - 5000 }), now);

  it("ninguno presente -> none", () => {
    expect(deriveLayout(idle, idle)).toBe("none");
  });

  it("solo Claude -> claude", () => {
    expect(deriveLayout(working, idle)).toBe("claude");
  });

  it("solo Codex -> codex", () => {
    expect(deriveLayout(idle, working)).toBe("codex");
  });

  it("ambos presentes (uno verde, otro azul) -> both (split)", () => {
    expect(deriveLayout(done, working)).toBe("both");
  });
});
