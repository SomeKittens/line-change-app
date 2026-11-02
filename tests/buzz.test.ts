import { expect, test } from 'vitest';
import { buzzState } from '../src/model/buzz';

const s = { buzzAfterSec: 180, rebuzzEverySec: 30 };

test.each([
  [179999, false, -1],
  [180000, true, 0],
  [209999, true, 0],
  [210000, true, 1],
])('buzzState(%i)', (elapsed, due, pulseIndex) => {
  expect(buzzState(elapsed, s)).toEqual({ due, pulseIndex });
});
