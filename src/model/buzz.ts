import type { Settings } from './types';

export const VIBRATE_PATTERN = [400, 200, 400];

/** Each new pulseIndex means one more vibration is due. */
export function buzzState(shiftElapsedMs: number, s: Settings): { due: boolean; pulseIndex: number } {
  const over = shiftElapsedMs - s.buzzAfterSec * 1000;
  if (over < 0) return { due: false, pulseIndex: -1 };
  return { due: true, pulseIndex: Math.floor(over / (s.rebuzzEverySec * 1000)) };
}
