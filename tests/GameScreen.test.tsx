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

const bannerShown = () => screen.getByTestId('banner-slot').style.visibility === 'visible';
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
  expect(bannerShown()).toBe(false);
  act(() => { vi.advanceTimersByTime(80000); });
  expect(bannerShown()).toBe(true);
  expect(vibrate).toHaveBeenCalledTimes(1);
  act(() => { vi.advanceTimersByTime(30000); });
  expect(vibrate).toHaveBeenCalledTimes(2);
});

test('CHANGE DONE rotates', () => {
  renderAt(180000);
  fireEvent.click(screen.getByText('CHANGE DONE'));
  expect(names('going-out')).toEqual(['I', 'A', 'B', 'C']);
  expect(bannerShown()).toBe(false);
  expect(loadStore(mem).games[0].onIce).toEqual(['e', 'f', 'g', 'h']);
});

test('undo restores', () => {
  renderAt(180000);
  fireEvent.click(screen.getByText('CHANGE DONE'));
  act(() => { vi.advanceTimersByTime(1500); });
  fireEvent.click(screen.getByText(/^Undo/));
  expect(names('going-out')).toEqual(['E', 'F', 'G', 'H']);
});

test('pause stops the shift timer', () => {
  renderAt(60000);
  fireEvent.click(screen.getByText('Pause'));
  act(() => { vi.advanceTimersByTime(600000); });
  expect(screen.getByTestId('shift-timer').textContent).toBe('1:00');
});

test('end game takes two taps and returns to setup', () => {
  renderAt(60000);
  fireEvent.click(screen.getByText('End game'));
  expect(loadStore(mem).activeGameId).not.toBeNull();
  fireEvent.click(screen.getByText('Tap again to end'));
  expect(loadStore(mem).activeGameId).toBeNull();
  expect(screen.getByText('New game', { selector: 'h1' })).toBeTruthy();
});

test('banner space is reserved so CHANGE DONE does not move when the change lands', () => {
  renderAt(100000);
  const slot = screen.getByTestId('banner-slot');
  expect(slot.style.visibility).toBe('hidden');
  act(() => { vi.advanceTimersByTime(80000); });
  expect(screen.getByTestId('banner-slot').style.visibility).toBe('visible');
});

test('a fast second tap right after CHANGE DONE cannot undo it', () => {
  renderAt(180000);
  fireEvent.click(screen.getByText('CHANGE DONE'));
  fireEvent.click(screen.getByText(/^Undo/));
  expect(names('going-out')).toEqual(['I', 'A', 'B', 'C']);
  act(() => { vi.advanceTimersByTime(1500); });
  fireEvent.click(screen.getByText(/^Undo/));
  expect(names('going-out')).toEqual(['E', 'F', 'G', 'H']);
});

test('undo says what it will undo', () => {
  renderAt(180000);
  fireEvent.click(screen.getByText('CHANGE DONE'));
  act(() => { vi.advanceTimersByTime(8000); });
  expect(screen.getByText(/^Undo/).textContent).toBe('Undo change · 0:08 ago');
});

test('CHANGE DONE works while paused (intermission, long stoppage)', () => {
  renderAt(180000);
  fireEvent.click(screen.getByText('Pause'));
  expect((screen.getByText('CHANGE DONE') as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(screen.getByText('CHANGE DONE'));
  expect(names('going-out')).toEqual(['I', 'A', 'B', 'C']);
});

test('next period needs two taps', () => {
  renderAt(60000);
  fireEvent.click(screen.getByText('Next period'));
  expect(loadStore(mem).games[0].period).toBe(1);
  fireEvent.click(screen.getByText('Tap again: period 2'));
  expect(loadStore(mem).games[0].period).toBe(2);
});

test('ending a long-forgotten game offers to stop ice time at the last change', () => {
  renderAt(7 * 24 * 3600 * 1000);
  fireEvent.click(screen.getByText('End game'));
  fireEvent.click(screen.getByText(/End at last change/));
  const g = loadStore(mem).games[0];
  expect(loadStore(mem).activeGameId).toBeNull();
  expect(g.elapsedMs).toBe(0);
});

