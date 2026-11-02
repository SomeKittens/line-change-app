import { describe, expect, test } from 'vitest';
import { gameNow } from '../src/model/clock';
import {
  STORAGE_KEY, activeGame, finishGame, archivePlayer, defaultStore, exportJson, importJson, loadStore, putGame, saveStore, upsertPlayer,
} from '../src/storage/store';
import { makeGame, memoryStorage } from './fixtures';

describe('store', () => {
  test('loads defaults when empty', () => {
    const s = loadStore(memoryStorage());
    expect(s).toEqual(defaultStore());
    expect(s.settings).toEqual({ buzzAfterSec: 180, rebuzzEverySec: 30 });
  });

  test('round-trips through storage', () => {
    const mem = memoryStorage();
    const s = upsertPlayer(defaultStore(), { id: 'x', name: 'Xavi', tags: ['fast'], buddies: [] });
    saveStore(s, mem);
    expect(loadStore(mem)).toEqual(s);
  });

  test('corrupt JSON falls back to defaults and keeps a copy', () => {
    const mem = memoryStorage();
    mem.setItem(STORAGE_KEY, '{bad');
    expect(loadStore(mem)).toEqual(defaultStore());
    const backupKey = Array.from({ length: mem.length }, (_, i) => mem.key(i)!).find((k) => k.startsWith('line-change-app:corrupt-'));
    expect(backupKey).toBeDefined();
    expect(mem.getItem(backupKey!)).toBe('{bad');
  });

  test('resumes active game after reload', () => {
    const mem = memoryStorage();
    const g = makeGame({ id: 'live', runningSince: 1000, onIce: ['a', 'b'] });
    saveStore({ ...putGame(defaultStore(), g), activeGameId: 'live' }, mem);
    const loaded = activeGame(loadStore(mem))!;
    expect(gameNow(loaded, 61000)).toBe(60000);
    expect(loaded.onIce).toEqual(['a', 'b']);
  });

  test('export/import round-trip', () => {
    const s = upsertPlayer(defaultStore(), { id: 'x', name: 'Xavi', tags: [], buddies: [] });
    expect(importJson(exportJson(s))).toEqual(s);
  });

  test('import rejects foreign JSON', () => {
    expect(() => importJson('{"foo":1}')).toThrow('Not a Line Change backup');
    expect(() => importJson('not json')).toThrow('Not a Line Change backup');
  });

  test('archiving a player keeps them in past games', () => {
    let s = upsertPlayer(defaultStore(), { id: 'x', name: 'Xavi', tags: [], buddies: ['y'] });
    s = upsertPlayer(s, { id: 'y', name: 'Yara', tags: [], buddies: ['x'] });
    s = putGame(s, makeGame({ id: 'old', names: { x: 'Xavi' }, endedAt: '2026-10-01' }));
    s = archivePlayer(s, 'x');
    expect(s.games[0].names.x).toBe('Xavi');
    expect(s.players.find((p) => p.id === 'x')!.archived).toBe(true);
    expect(s.players.find((p) => p.id === 'y')!.buddies).not.toContain('x');
  });

  test('finishing a game pauses it, stamps endedAt and drops undo history', () => {
    const g = makeGame({ id: 'live', runningSince: 1000, history: [makeGame()] });
    const s = finishGame({ ...putGame(defaultStore(), g), activeGameId: 'live' }, 61000);
    expect(s.activeGameId).toBeNull();
    expect(s.games[0].endedAt).toBeDefined();
    expect(s.games[0].history).toEqual([]);
    expect(s.games[0].runningSince).toBeNull();
    expect(s.games[0].elapsedMs).toBe(60000);
  });
});
