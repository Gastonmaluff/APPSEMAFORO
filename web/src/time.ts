/** Formatea segundos como "m:ss" o "h:mm:ss". */
export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "—";
  const s = Math.floor(totalSeconds % 60);
  const m = Math.floor((totalSeconds / 60) % 60);
  const h = Math.floor(totalSeconds / 3600);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Hora local corta HH:MM:SS. */
export function formatClock(iso: string | number | null | undefined): string {
  if (iso == null) return "—";
  const d = typeof iso === "number" ? new Date(iso) : new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** Tiempo relativo compacto: "hace 5 s", "hace 3 min". */
export function relativeAge(fromMs: number, nowMs: number): string {
  const secs = Math.max(0, Math.round((nowMs - fromMs) / 1000));
  if (secs < 60) return `hace ${secs} s`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.round(mins / 60);
  return `hace ${hours} h`;
}
