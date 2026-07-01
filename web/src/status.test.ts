import { describe, it, expect } from "vitest";
import { computeVisual, STALE_AFTER_MINUTES } from "./status";
import type { DisplayRecord } from "./types";

const now = Date.parse("2026-06-30T12:00:00Z");

function rec(over: Partial<DisplayRecord>): DisplayRecord {
  return {
    displayName: "Test",
    repository: "Gastonmaluff/NEXT-CONTROL",
    workflowName: "Deploy to GitHub Pages",
    branch: "main",
    status: "running",
    conclusion: null,
    startedAt: "2026-06-30T11:59:00Z",
    updatedAt: "2026-06-30T11:59:30Z",
    completedAt: null,
    durationSeconds: null,
    runNumber: 1,
    runUrl: "https://example.com/run",
    shortSha: "abcdef1",
    deliveryId: "d-1",
    ...over,
  };
}

describe("computeVisual", () => {
  it("sin conexión -> offline (SIN CONEXIÓN)", () => {
    const { state, def } = computeVisual(rec({}), false, now);
    expect(state).toBe("offline");
    expect(def.bigText).toBe("SIN CONEXIÓN");
  });

  it("conectado pero sin registro -> unknown (SIN DATOS)", () => {
    const { state, def } = computeVisual(null, true, now);
    expect(state).toBe("unknown");
    expect(def.bigText).toBe("SIN DATOS");
  });

  it("running reciente -> EJECUTANDO", () => {
    const { state, def } = computeVisual(rec({ status: "running" }), true, now);
    expect(state).toBe("running");
    expect(def.bigText).toBe("EJECUTANDO");
  });

  it("running sin novedades -> estancado (ATENCIÓN + POSIBLEMENTE ESTANCADO)", () => {
    const old = new Date(now - (STALE_AFTER_MINUTES + 5) * 60000).toISOString();
    const { state, def } = computeVisual(
      rec({ status: "running", updatedAt: old }),
      true,
      now,
    );
    expect(state).toBe("stale");
    expect(def.hint).toBe("POSIBLEMENTE ESTANCADO");
  });

  it("success reciente -> LISTO (verde)", () => {
    const completedAt = new Date(now - 30 * 1000).toISOString();
    const { state, def } = computeVisual(
      rec({ status: "success", completedAt }),
      true,
      now,
    );
    expect(state).toBe("success");
    expect(def.bigText).toBe("LISTO");
  });

  it("success viejo -> EN ESPERA (gris con spinner)", () => {
    const completedAt = new Date(now - 10 * 60 * 1000).toISOString();
    const { state, def } = computeVisual(
      rec({ status: "success", completedAt }),
      true,
      now,
    );
    expect(state).toBe("waiting");
    expect(def.bigText).toBe("EN ESPERA");
  });

  it("greenHoldMinutes configurable controla la transición a espera", () => {
    const completedAt = new Date(now - 5 * 60 * 1000).toISOString();
    // Con hold de 10 min sigue verde; con hold de 2 min pasa a espera.
    expect(computeVisual(rec({ status: "success", completedAt }), true, now, 10).state).toBe(
      "success",
    );
    expect(computeVisual(rec({ status: "success", completedAt }), true, now, 2).state).toBe(
      "waiting",
    );
  });

  it("failed -> FALLÓ", () => {
    const { state, def } = computeVisual(rec({ status: "failed" }), true, now);
    expect(state).toBe("failed");
    expect(def.bigText).toBe("FALLÓ");
  });

  it("attention cancelado -> ATENCIÓN con motivo CANCELADO", () => {
    const { def } = computeVisual(
      rec({ status: "attention", conclusion: "cancelled" }),
      true,
      now,
    );
    expect(def.bigText).toBe("ATENCIÓN");
    expect(def.hint).toBe("CANCELADO");
  });

  it("recuperación de conexión reevalúa a estado real", () => {
    const r = rec({ status: "success" });
    expect(computeVisual(r, false, now).state).toBe("offline");
    expect(computeVisual(r, true, now).state).toBe("success");
  });
});
