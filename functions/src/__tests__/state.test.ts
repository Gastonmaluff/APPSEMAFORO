import { describe, it, expect } from "vitest";
import { MONITORED } from "../config";
import { buildRecord, filterEvent, mapStatus } from "../state";
import { makeEvent } from "./fixtures";

describe("mapStatus", () => {
  it("workflow solicitado o en progreso -> running (azul)", () => {
    expect(mapStatus("requested", null)).toBe("running");
    expect(mapStatus("in_progress", null)).toBe("running");
  });

  it("verde SOLO con success", () => {
    expect(mapStatus("completed", "success")).toBe("success");
  });

  it("failure / timed_out -> failed (rojo)", () => {
    expect(mapStatus("completed", "failure")).toBe("failed");
    expect(mapStatus("completed", "timed_out")).toBe("failed");
  });

  it("cancelled / action_required / stale / neutral -> attention (amarillo)", () => {
    expect(mapStatus("completed", "cancelled")).toBe("attention");
    expect(mapStatus("completed", "action_required")).toBe("attention");
    expect(mapStatus("completed", "stale")).toBe("attention");
    expect(mapStatus("completed", "neutral")).toBe("attention");
  });

  it("skipped -> unknown (gris)", () => {
    expect(mapStatus("completed", "skipped")).toBe("unknown");
  });
});

describe("filterEvent", () => {
  it("acepta repo + workflow + rama autorizados", () => {
    const r = filterEvent(makeEvent(), MONITORED);
    expect(r.ok).toBe(true);
  });

  it("rechaza repositorio no autorizado", () => {
    const r = filterEvent(makeEvent({ repo: "attacker/evil-repo" }), MONITORED);
    expect(r).toEqual({ ok: false, reason: "repo_not_allowed" });
  });

  it("rechaza workflow no autorizado del repo correcto", () => {
    const r = filterEvent(makeEvent({ workflow: "CI Tests" }), MONITORED);
    expect(r).toEqual({ ok: false, reason: "workflow_not_allowed" });
  });

  it("rechaza rama no autorizada", () => {
    const r = filterEvent(makeEvent({ branch: "feature/x" }), MONITORED);
    expect(r).toEqual({ ok: false, reason: "branch_not_allowed" });
  });

  it("acepta el workflow legacy de Pages en la rama gh-pages (LUCCAPARK)", () => {
    const r = filterEvent(
      makeEvent({
        repo: "Gastonmaluff/LUCCAPARK-APP",
        workflow: "pages build and deployment",
        branch: "gh-pages",
      }),
      MONITORED,
    );
    expect(r.ok).toBe(true);
  });
});

describe("buildRecord", () => {
  const now = Date.parse("2026-06-30T10:01:40Z");

  it("run solicitado produce estado running y sin conclusión", () => {
    const cfg = MONITORED["Gastonmaluff/NEXT-CONTROL"];
    const rec = buildRecord(makeEvent({ action: "requested" }), cfg, "d-1", now);
    expect(rec.status).toBe("running");
    expect(rec.conclusion).toBeNull();
    expect(rec.completedAt).toBeNull();
    expect(rec.displayName).toBe("Next Control");
    expect(rec.shortSha).toBe("abcdef1");
    expect(rec.deliveryId).toBe("d-1");
  });

  it("run exitoso produce success y duración calculada", () => {
    const cfg = MONITORED["Gastonmaluff/NEXT-CONTROL"];
    const rec = buildRecord(
      makeEvent({ action: "completed", conclusion: "success", status: "completed" }),
      cfg,
      "d-2",
      now,
    );
    expect(rec.status).toBe("success");
    expect(rec.conclusion).toBe("success");
    expect(rec.completedAt).toBe("2026-06-30T10:01:35Z");
    // started 10:00:05 -> completed 10:01:35 = 90s
    expect(rec.durationSeconds).toBe(90);
  });

  it("run fallido produce failed", () => {
    const cfg = MONITORED["Gastonmaluff/NEXT-CONTROL"];
    const rec = buildRecord(
      makeEvent({ action: "completed", conclusion: "failure" }),
      cfg,
      "d-3",
      now,
    );
    expect(rec.status).toBe("failed");
  });

  it("no filtra ni expone mensajes de commit ni datos privados", () => {
    const cfg = MONITORED["Gastonmaluff/NEXT-CONTROL"];
    const rec = buildRecord(makeEvent(), cfg, "d-4", now);
    const keys = Object.keys(rec);
    expect(keys).not.toContain("head_commit");
    expect(keys).not.toContain("message");
    expect(keys).not.toContain("actor");
  });
});
