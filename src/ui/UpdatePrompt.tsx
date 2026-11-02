import { useRegisterSW } from 'virtual:pwa-register/preact';
import { activeGame } from '../storage/store';
import { useStore } from './useStore';

export function UpdateBar({ needRefresh, gameLive, onUpdate }: { needRefresh: boolean; gameLive: boolean; onUpdate: () => void }) {
  if (!needRefresh || gameLive) return null;
  return (
    <button class="update-bar" onClick={onUpdate}>
      New version available. Tap to update
    </button>
  );
}

/** Shows the service worker's "new version" prompt, but never during a live game. */
export function UpdatePrompt() {
  const [store] = useStore();
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  return <UpdateBar needRefresh={needRefresh} gameLive={activeGame(store) !== null} onUpdate={() => void updateServiceWorker(true)} />;
}
