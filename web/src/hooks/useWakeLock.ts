import { useCallback, useEffect, useRef, useState } from "react";

type WakeLockSentinelLike = { release: () => Promise<void>; released: boolean };

/**
 * Mantiene la pantalla encendida usando la Screen Wake Lock API cuando está
 * disponible. Se re-adquiere sola al volver a primer plano.
 */
export function useWakeLock(): {
  supported: boolean;
  active: boolean;
  request: () => Promise<void>;
  release: () => Promise<void>;
} {
  const supported =
    typeof navigator !== "undefined" && "wakeLock" in navigator;
  const [active, setActive] = useState(false);
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);
  const wantRef = useRef(false);

  const request = useCallback(async () => {
    wantRef.current = true;
    if (!supported) return;
    try {
      const wl = navigator as unknown as {
        wakeLock: { request: (t: "screen") => Promise<WakeLockSentinelLike> };
      };
      const sentinel = await wl.wakeLock.request("screen");
      sentinelRef.current = sentinel;
      setActive(true);
    } catch {
      setActive(false);
    }
  }, [supported]);

  const release = useCallback(async () => {
    wantRef.current = false;
    try {
      await sentinelRef.current?.release();
    } catch {
      /* ignore */
    }
    sentinelRef.current = null;
    setActive(false);
  }, []);

  // Re-adquirir al volver a la pestaña si el usuario lo había pedido.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && wantRef.current) {
        void request();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [request]);

  return { supported, active, request, release };
}
