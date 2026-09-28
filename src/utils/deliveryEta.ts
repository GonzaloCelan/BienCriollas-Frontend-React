export type DeliveryEtaTone = "normal" | "warning" | "critical" | "finished";

export type DeliveryEtaPresentation = {
  label: string;
  description: string;
  tone: DeliveryEtaTone;
};

export type DeliveryEtaPlayback = {
  target: string;
  pausedAt: number | null;
  totalPausedMs: number;
};

export function getDeliveryEtaClock(target: string, now: number, playback?: DeliveryEtaPlayback) {
  if (!playback || playback.target !== target) return { now, paused: false };
  return {
    now: (playback.pausedAt ?? now) - playback.totalPausedMs,
    paused: playback.pausedAt !== null,
  };
}

export function toggleDeliveryEtaPlayback(target: string, now: number, playback?: DeliveryEtaPlayback): DeliveryEtaPlayback {
  if (!playback || playback.target !== target) {
    return { target, pausedAt: now, totalPausedMs: 0 };
  }
  if (playback.pausedAt !== null) {
    return { target, pausedAt: null, totalPausedMs: playback.totalPausedMs + now - playback.pausedAt };
  }
  return { ...playback, pausedAt: now };
}

export function parseOptionalEtaMinutes(value: string): number | null | undefined {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return undefined;

  const minutes = Number(trimmed);
  return Number.isSafeInteger(minutes) && minutes > 0 ? minutes : undefined;
}

export function getDeliveryEtaPresentation(
  fechaHoraEstimadaDelivery: string | null,
  now: number
): DeliveryEtaPresentation | null {
  if (!fechaHoraEstimadaDelivery) return null;

  const target = new Date(fechaHoraEstimadaDelivery).getTime();
  if (!Number.isFinite(target)) return null;

  const remainingSeconds = Math.max(0, Math.ceil((target - now) / 1000));
  if (remainingSeconds === 0) {
    return {
      label: "0:00",
      description: "El tiempo estimado del delivery terminó",
      tone: "finished",
    };
  }

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  return {
    label: `${minutes}:${String(seconds).padStart(2, "0")}`,
    description: `Tiempo estimado restante: ${minutes} ${minutes === 1 ? "minuto" : "minutos"} y ${seconds} ${seconds === 1 ? "segundo" : "segundos"}`,
    tone: remainingSeconds <= 5 * 60 ? "critical" : remainingSeconds <= 15 * 60 ? "warning" : "normal",
  };
}
