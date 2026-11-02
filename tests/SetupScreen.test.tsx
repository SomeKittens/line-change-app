import { fireEvent, render, screen, within } from '@testing-library/preact';
import { expect, test } from 'vitest';
import type { Store } from '../src/model/types';
import { defaultStore, loadStore, saveStore, upsertPlayer } from '../src/storage/store';
import { App } from '../src/ui/App';
import { memoryStorage } from './fixtures';

function seeded(names: string[]): Storage {
  const mem = memoryStorage();
  let s: Store = defaultStore();
  names.forEach((name, i) => (s = upsertPlayer(s, { id: `p${i}`, name, tags: [], buddies: [] })));
  saveStore(s, mem);
  return mem;
}

test('start game puts present kids in rotation, excluding goalie and non-skaters', () => {
  const mem = seeded(['Mia', 'Theo', 'Ava', 'Sam', 'Lily', 'Owen', 'Gus']);
  render(<App storage={mem} />);
  const here = screen.getByTestId('attendance');
  for (const n of ['Mia', 'Theo', 'Ava', 'Sam', 'Lily', 'Owen']) fireEvent.click(within(here).getByText(n));
  fireEvent.change(screen.getByLabelText(/Goalie/), { target: { value: 'p5' } });
  fireEvent.click(within(screen.getByTestId('not-skating')).getByText('Lily'));
  fireEvent.click(screen.getByText('Build queue'));
  fireEvent.click(screen.getByText('Start game'));

  const g = loadStore(mem).games[0];
  expect(g.goalieId).toBe('p5');
  expect(g.out).toEqual(['p4']);
  expect([...g.onIce, ...g.queue].sort()).toEqual(['p0', 'p1', 'p2', 'p3']);
  expect(g.runningSince).not.toBeNull();
  expect(loadStore(mem).activeGameId).toBe(g.id);
  expect(g.names.p6).toBeUndefined();
});
