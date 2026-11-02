import { useEffect, useRef } from 'preact/hooks';
import { VIBRATE_PATTERN, buzzState } from '../model/buzz';
import { planChange, shiftElapsedMs } from '../model/rotation';
import type { GameState, Settings } from '../model/types';

/** Vibrates when a change is due and again every rebuzz interval. Driven by the caller's ticking clock. */
export function useBuzz(g: GameState, settings: Settings, wallNow: number): { due: boolean } {
  const lastPulse = useRef({ changeAt: g.lastChangeAt, pulse: -1 });
  const canChange = g.runningSince !== null && planChange(g, wallNow).goingOut.length > 0;
  const { due, pulseIndex } = canChange ? buzzState(shiftElapsedMs(g, wallNow), settings) : { due: false, pulseIndex: -1 };

  useEffect(() => {
    if (lastPulse.current.changeAt !== g.lastChangeAt) lastPulse.current = { changeAt: g.lastChangeAt, pulse: -1 };
    if (pulseIndex > lastPulse.current.pulse) {
      lastPulse.current.pulse = pulseIndex;
      navigator.vibrate?.(VIBRATE_PATTERN);
    }
  }, [pulseIndex, g.lastChangeAt]);

  return { due };
}
