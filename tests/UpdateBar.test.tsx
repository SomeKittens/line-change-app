import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, expect, test, vi } from 'vitest';
import { UpdateBar } from '../src/ui/UpdatePrompt';

afterEach(cleanup);

test('offers the update when no game is live', () => {
  const onUpdate = vi.fn();
  render(<UpdateBar needRefresh gameLive={false} onUpdate={onUpdate} />);
  fireEvent.click(screen.getByText(/New version available/));
  expect(onUpdate).toHaveBeenCalled();
});

test('never interrupts a live game', () => {
  render(<UpdateBar needRefresh gameLive onUpdate={() => {}} />);
  expect(screen.queryByText(/New version available/)).toBeNull();
});
