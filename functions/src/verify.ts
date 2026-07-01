import { createHmac, timingSafeEqual } from "crypto";

/**
 * Valida la firma `X-Hub-Signature-256` que envía GitHub.
 *
 * La comparación es de tiempo constante para no filtrar información por
 * temporización. Devuelve `false` ante cualquier ausencia o discrepancia.
 */
export function verifySignature(
  rawBody: Buffer | string,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!signatureHeader || !secret) return false;

  const expected =
    "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");

  const received = Buffer.from(signatureHeader, "utf8");
  const computed = Buffer.from(expected, "utf8");

  // timingSafeEqual exige buffers de igual longitud.
  if (received.length !== computed.length) return false;
  return timingSafeEqual(received, computed);
}
