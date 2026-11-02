import { fireEvent, render, screen } from '@testing-library/preact';
import { expect, test } from 'vitest';
import { App } from '../src/ui/App';
import { memoryStorage } from './fixtures';

test('add player focuses the name field so typing goes straight in', () => {
  render(<App storage={memoryStorage()} />);
  fireEvent.click(screen.getByText('+ Add player'));
  expect(document.activeElement).toBe(screen.getByLabelText('Name'));
});
