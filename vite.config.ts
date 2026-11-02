/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  base: '/line-change-app/',
  plugins: [preact()],
  test: { environment: 'jsdom' },
});
