import { describe, it, expect } from "vitest";
import {
  applyEvent,
  basename,
  buildTaskKey,
  emptyAgentRecord,
  normalizeEvent,
  type AgentRecord,
  type NormalizedEvent,
} from "../agents";

const T0 = Date.parse("2026-07-02T10:00:00Z");

/** Construye un evento normalizado de prueba. */
function ev(over: Partial<NormalizedEvent> = {}): NormalizedEvent {
  return {
    source: "claude",
    event: "start",
    sessionId: "sess-A",
    turnId: null,
    promptId: null,
    cwd: "next-control",
    timestamp: T0,
    eventId: "evt-1",
    ...over,
  };
}

/** Aplica una secuencia de eventos sobre un registro inicial. */
function run(events: NormalizedEvent[], start: AgentRecord | null = null): AgentRecord {
  return events.reduce<AgentRecord | null>(
    (acc, e, i) => applyEvent(acc, e, T0 + i * 1000),
    start,
  ) as AgentRecord;
}

describe("normalizeEvent", () => {
  it("acepta source/event válidos y normaliza snake_case", () => {
    const n = normalizeEvent(
      {
        source: "codex",
        event: "start",
        session_id: "s1",
        cwd: "C:\\Users\\x\\proj\\panel-quintas",
        prompt_id: "p1",
        timestamp: "2026-07-02T10:00:00Z",
        eventId: "e1",
      },
      T0,
    );
    expect(n).not.toBeNull();
    expect(n!.source).toBe("codex");
    expect(n!.sessionId).toBe("s1");
    expect(n!.promptId).toBe("p1");
    expect(n!.cwd).toBe("panel-quintas"); // solo basename
  });

  it("rechaza source inválido", () => {
    expect(normalizeEvent({ source: "hacker", event: "start" }, T0)).toBeNull();
  });

  it("rechaza event inválido", () => {
    expect(normalizeEvent({ source: "claude", event: "explode" }, T0)).toBeNull();
  });

  it("deriva un eventId estable si falta", () => {
    const n = normalizeEvent(
      { source: "claude", event: "stop", session_id: "s9", timestamp: "2026-07-02T10:00:00Z" },
      T0,
    );
    expect(n!.eventId).toContain("claude");
    expect(n!.eventId).toContain("s9");
  });
});

describe("basename", () => {
  it("reduce rutas Windows y POSIX a la carpeta", () => {
    expect(basename("C:\\a\\b\\mi-proyecto")).toBe("mi-proyecto");
    expect(basename("/home/x/repo/")).toBe("repo");
    expect(basename(null)).toBeNull();
  });
});

describe("applyEvent — un agente", () => {
  it("start -> working (azul), activeCount 1", () => {
    const r = run([ev({ event: "start" })]);
    expect(r.status).toBe("working");
    expect(r.activeCount).toBe(1);
    expect(r.lastCwd).toBe("next-control");
  });

  it("start luego stop -> completed (verde), sin tareas", () => {
    const r = run([ev({ event: "start" }), ev({ event: "stop" })]);
    expect(r.status).toBe("completed");
    expect(r.activeCount).toBe(0);
    expect(r.lastCompletedAt).not.toBeNull();
  });

  it("failure -> error (rojo) con lastError", () => {
    const r = run([ev({ event: "start" }), ev({ event: "failure" })]);
    expect(r.status).toBe("error");
    expect(r.lastError).not.toBeNull();
    expect(r.activeCount).toBe(0);
  });

  it("session_end finaliza la tarea de esa sesión", () => {
    const r = run([ev({ event: "start" }), ev({ event: "session_end" })]);
    expect(r.status).toBe("completed");
    expect(r.activeCount).toBe(0);
  });
});

describe("applyEvent — múltiples tareas del mismo agente", () => {
  it("dos sesiones -> activeCount 2 y sigue azul hasta vaciar", () => {
    const r1 = run([
      ev({ event: "start", sessionId: "sess-A" }),
      ev({ event: "start", sessionId: "sess-B" }),
    ]);
    expect(r1.activeCount).toBe(2);
    expect(r1.status).toBe("working");

    // Termina una sola: sigue trabajando (queda la otra).
    const r2 = applyEvent(r1, ev({ event: "stop", sessionId: "sess-A" }), T0 + 5000);
    expect(r2.status).toBe("working");
    expect(r2.activeCount).toBe(1);

    // Termina la segunda: recién ahí pasa a completed.
    const r3 = applyEvent(r2, ev({ event: "stop", sessionId: "sess-B" }), T0 + 6000);
    expect(r3.status).toBe("completed");
    expect(r3.activeCount).toBe(0);
  });

  it("start duplicado de la misma sesión no crea dos tareas", () => {
    const r = run([
      ev({ event: "start", sessionId: "sess-A" }),
      ev({ event: "start", sessionId: "sess-A" }),
    ]);
    expect(r.activeCount).toBe(1);
  });

  it("conserva startedAt original al recibir un heartbeat", () => {
    const r1 = applyEvent(null, ev({ event: "start", sessionId: "s" }), T0);
    const key = buildTaskKey(ev({ sessionId: "s" }));
    const started = r1.tasks[key].startedAt;
    const r2 = applyEvent(r1, ev({ event: "heartbeat", sessionId: "s" }), T0 + 30000);
    expect(r2.tasks[key].startedAt).toBe(started);
    expect(r2.tasks[key].lastActivityAt).toBe(T0 + 30000);
    expect(r2.status).toBe("working");
  });
});

describe("poda de tareas huérfanas (server-side)", () => {
  it("una tarea vieja (sin Stop) se poda al llegar un evento nuevo", () => {
    // Registro con una tarea vieja (>60 min) que nunca cerró.
    const stale: AgentRecord = {
      status: "working",
      activeCount: 1,
      tasks: { vieja: { startedAt: T0 - 90 * 60000, lastActivityAt: T0 - 90 * 60000, sessionId: "vieja", cwd: "x" } },
      lastCompletedAt: null,
      lastError: null,
      lastCwd: "x",
      updatedAt: T0 - 90 * 60000,
    };
    // Llega un start de OTRA sesión "ahora".
    const r = applyEvent(stale, ev({ event: "start", sessionId: "nueva" }), T0);
    expect(Object.keys(r.tasks)).toEqual(["nueva"]); // la vieja fue podada
    expect(r.activeCount).toBe(1);
  });

  it("un heartbeat reciente mantiene la tarea viva (no se poda)", () => {
    const r1 = applyEvent(null, ev({ event: "start", sessionId: "s" }), T0);
    const r2 = applyEvent(r1, ev({ event: "heartbeat", sessionId: "s" }), T0 + 30 * 60000);
    expect(r2.activeCount).toBe(1);
    expect(r2.status).toBe("working");
  });
});

describe("independencia entre agentes", () => {
  it("el reductor opera sobre un registro por agente (no se cruzan)", () => {
    // Claude trabaja...
    const claude = run([ev({ source: "claude", event: "start", sessionId: "c1" })]);
    // ...y un evento de Codex se aplica a SU propio registro, sin tocar el de Claude.
    const codex = applyEvent(
      emptyAgentRecord(T0),
      ev({ source: "codex", event: "failure", sessionId: "x1" }),
      T0,
    );
    expect(claude.status).toBe("working");
    expect(codex.status).toBe("error");
  });
});
