// Save/load orchestration at the game level: serialises enough state to
// resume a run (money, missions, weapons, position).

import { G } from './state.js';
import { saveGame, loadGame, applySave, saveSlotPos, saveMissionIdx, hasSave } from '../systems/economy.js';
import { STORY } from '../data/missions.js';

export { hasSave };

export function persistProgress() {
  // stash next mission index on G so economy.saveGame can pick it up
  const st = window.__missionState ? window.__missionState() : null;
  G.availableIdx = st ? st.availableIdx : 0;
  G.nextMissionIdx = G.availableIdx;
  return saveGame();
}

export function restoreProgress() {
  const data = loadGame();
  if (!data) return null;
  applySave(data);
  const idx = saveMissionIdx(data);
  const pos = saveSlotPos(data);
  return { idx, pos };
}

export function nextStoryMission(idx) {
  return STORY[Math.min(idx, STORY.length - 1)];
}
