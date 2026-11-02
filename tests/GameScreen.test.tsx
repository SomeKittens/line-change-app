import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { defaultStore, loadStore, putGame, saveStore } from '../src/storage/store';
import { App } from '../src/ui/App';
import { NINE, memoryStorage, started } from './fixtures';

let mem: Storage;
let vibrate: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers({ now: 0, toFake: ['Date', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
  mem = memoryStorage();
  const g = started(NINE, 0);
  saveStore({ ...putGame(defaultStore(), g), activeGameId: g.id }, mem);
  vibrate = vi.fn();
  Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const names = (role: string) => within(screen.getByTestId(role)).queryAllByTestId('name').map((e) => e.textContent);

function renderAt(ms: number) {
  vi.setSystemTime(ms);
  return render(<App storage={mem} />);
}

test('shows going out in green and coming off in red', () => {
  renderAt(180000);
  expect(names('going-out')).toEqual(['E', 'F', 'G', 'H']);
  expect(names('coming-off')).toEqual(['A', 'B', 'C', 'D']);
  expect(names('staying')).toEqual(['I']);
  expect(screen.getByTestId('going-out').className).toContain('going-out');
  expect(screen.getByTestId('coming-off').className).toContain('coming-off');
});

test('shows banner when buzz due', () => {
  renderAt(100000);
  expect(screen.queryByText('CHANGE AT NEXT WHISTLE')).toBeNull();
  act(() => { vi.advanceTimersByTime(80000); });
  expect(screen.getByText('CHANGE AT NEXT WHISTLE')).toBeTruthy();
  expect(vibrate).toHaveBeenCalledTimes(1);
  act(() => { vi.advanceTimersByTime(30000); });
  expect(vibrate).toHaveBeenCalledTimes(2);
});

test('CHANGE DONE rotates', () => {
  renderAt(180000);
  fireEvent.click(screen.getByText('CHANGE DONE'));
  expect(names('going-out')).toEqual(['I', 'A', 'B', 'C']);
  expect(screen.queryByText('CHANGE AT NEXT WHISTLE')).toBeNull();
  expect(loadStore(mem).games[0].onIce).toEqual(['e', 'f', 'g', 'h']);
});

test('undo restores', () => {
  renderAt(180000);
  fireEvent.click(screen.getByText('CHANGE DONE'));
  fireEvent.click(screen.getByText('Undo'));
  expect(names('going-out')).toEqual(['E', 'F', 'G', 'H']);
});

test('pause stops the shift timer and disables CHANGE DONE', () => {
  renderAt(60000);
  fireEvent.click(screen.getByText('Pause'));
  act(() => { vi.advanceTimersByTime(600000); });
  expect(screen.getByTestId('shift-timer').textContent).toBe('1:00');
  expect((screen.getByText('CHANGE DONE') as HTMLButtonElement).disabled).toBe(true);
});

test('end game takes two taps and returns to setup', () => {
  renderAt(60000);
  fireEvent.click(screen.getByText('End game'));
  expect(loadStore(mem).activeGameId).not.toBeNull();
  fireEvent.click(screen.getByText('Tap again to end'));
  expect(loadStore(mem).activeGameId).toBeNull();
  expect(screen.getByText('New game', { selector: 'h1' })).toBeTruthy();
});
