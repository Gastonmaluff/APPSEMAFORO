import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";
import { verifySignature } from "../verify";

const SECRET = "test-secret-value-1234567890";

function sign(body: string, secret = SECRET): string {
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}

describe("verifySignature", () => {
  const body = JSON.stringify({ hello: "world" });

  it("acepta una firma válida", () => {
    expect(verifySignature(body, sign(body), SECRET)).toBe(true);
  });

  it("rechaza una firma inválida", () => {
    expect(verifySignature(body, sign(body, "otro-secreto"), SECRET)).toBe(false);
  });

  it("rechaza cuando falta el header de firma", () => {
    expect(verifySignature(body, undefined, SECRET)).toBe(false);
  });

  it("rechaza cuando el cuerpo fue alterado", () => {
    const tampered = JSON.stringify({ hello: "mundo" });
    expect(verifySignature(tampered, sign(body), SECRET)).toBe(false);
  });

  it("rechaza cuando el secreto está vacío", () => {
    expect(verifySignature(body, sign(body), "")).toBe(false);
  });
});
