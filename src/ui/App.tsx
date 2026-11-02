import { useState } from 'preact/hooks';
import { activeGame } from '../storage/store';
import { GameScreen } from './GameScreen';
import { RosterScreen } from './RosterScreen';
import { SettingsScreen } from './SettingsScreen';
import { SetupScreen } from './SetupScreen';
import { UpdatePrompt } from './UpdatePrompt';
import { StoreContext, useStoreState } from './useStore';

/** 'play' shows the live game if there is one, otherwise game setup. */
export type Screen = 'roster' | 'play' | 'settings';

export function App({ storage, withUpdates = false }: { storage?: Storage; withUpdates?: boolean }) {
  const ctx = useStoreState(storage);
  const [store] = ctx;
  const [screen, setScreen] = useState<Screen>(() =>
    activeGame(store) || store.players.some((p) => !p.archived) ? 'play' : 'roster',
  );
  const live = activeGame(store) !== null;
  const tab = (s: Screen, label: string) => (
    <button class={screen === s ? 'on' : ''} onClick={() => setScreen(s)}>{label}</button>
  );

  return (
    <StoreContext.Provider value={ctx}>
      <main class="screen">
        {screen === 'roster' && <RosterScreen />}
        {screen === 'play' && (live ? <GameScreen /> : <SetupScreen />)}
        {screen === 'settings' && <SettingsScreen />}
      </main>
      {withUpdates && <UpdatePrompt />}
      <nav class="tabs">
        {tab('roster', 'Roster')}
        {tab('play', live ? 'Game' : 'New game')}
        {tab('settings', 'Settings')}
      </nav>
    </StoreContext.Provider>
  );
}
