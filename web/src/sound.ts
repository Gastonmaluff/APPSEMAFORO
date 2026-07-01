/**
 * Alertas sonoras mínimas generadas con la Web Audio API (sin archivos).
 * Solo suenan si el usuario activó la preferencia de sonido y tras una
 * interacción previa (requisito de autoplay de los navegadores).
 */
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      ctx = new Ctor();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function beep(freq: number, durationMs: number, delayMs = 0): void {
  const audio = getCtx();
  if (!audio) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  const start = audio.currentTime + delayMs / 1000;
  osc.frequency.value = freq;
  osc.type = "sine";
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + durationMs / 1000);
  osc.connect(gain).connect(audio.destination);
  osc.start(start);
  osc.stop(start + durationMs / 1000);
}

/** Sonido ascendente y agradable para "LISTO". */
export function playSuccess(): void {
  beep(660, 160, 0);
  beep(880, 220, 160);
}

/** Sonido descendente de alerta para "FALLÓ". */
export function playFailure(): void {
  beep(440, 200, 0);
  beep(300, 320, 200);
}

/** Necesario para desbloquear el audio dentro de un gesto del usuario. */
export function warmUpAudio(): void {
  getCtx();
}
