import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, expect, test } from 'vitest';
import { defaultStore, loadStore, saveStore, upsertPlayer } from '../src/storage/store';
import { App } from '../src/ui/App';
import { memoryStorage } from './fixtures';

afterEach(cleanup);

function openSettings() {
  const mem = memoryStorage();
  saveStore(upsertPlayer(defaultStore(), { id: 'x', name: 'Xavi', tags: [], buddies: [] }), mem);
  render(<App storage={mem} />);
  fireEvent.click(screen.getByText('Settings'));
  return mem;
}

test('buzz stepper changes the saved threshold in 15s steps', () => {
  const mem = openSettings();
  expect(screen.getByTestId('buzz-after').textContent).toBe('3:00');
  fireEvent.click(screen.getByLabelText('Buzz later'));
  expect(screen.getByTestId('buzz-after').textContent).toBe('3:15');
  expect(loadStore(mem).settings.buzzAfterSec).toBe(195);
});

test('bad import file shows an error and keeps data', async () => {
  const mem = openSettings();
  const input = screen.getByLabelText('Import backup') as HTMLInputElement;
  const file = new File(['{"foo":1}'], 'x.json', { type: 'application/json' });
  Object.defineProperty(input, 'files', { value: [file] });
  fireEvent.change(input);
  expect(await screen.findByText('Not a Line Change backup')).toBeTruthy();
  expect(loadStore(mem).players[0].name).toBe('Xavi');
});

test('shows the build version', () => {
  openSettings();
  expect(screen.getByTestId('version').textContent).toMatch(/^Version (\d{4}\.\d{2}\.\d{2} · [0-9a-f]{7,}\+?|dev)$/);
});
