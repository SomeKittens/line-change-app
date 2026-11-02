import { createContext } from 'preact';
import { useCallback, useContext, useState } from 'preact/hooks';
import type { Store } from '../model/types';
import { loadStore, saveStore } from '../storage/store';

export type Update = (fn: (s: Store) => Store) => void;

export const StoreContext = createContext<[Store, Update] | null>(null);

/** Owns the store state; every update is persisted immediately. */
export function useStoreState(storage?: Storage): [Store, Update] {
  const [store, setStore] = useState(() => loadStore(storage));
  const update = useCallback<Update>(
    (fn) =>
      setStore((s) => {
        const next = fn(s);
        saveStore(next, storage);
        return next;
      }),
    [storage],
  );
  return [store, update];
}

export function useStore(): [Store, Update] {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore outside StoreContext');
  return ctx;
}
