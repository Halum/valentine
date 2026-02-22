import { getState, setState } from './state.js';
import { initLevel1 } from './level1.js';
import { initLevel2 } from './level2.js';
import { initLevel3 } from './level3.js';
import { isAdmin, getOverrideLevel, applyAdminOverrides } from './admin.js';
import { initAnalytics, logEvent } from './analytics.js';

async function init() {
  applyAdminOverrides();

  const response = await fetch('data.json');
  const data = await response.json();
  const state = getState();

  // Admin level override
  const overrideLevel = getOverrideLevel();
  if (overrideLevel) {
    state.currentLevel = overrideLevel;
    setState({ currentLevel: overrideLevel });
  }

  // Set browser tab title
  const levelData = data[`level${state.currentLevel}`];
  const levelName = levelData?.name || '';
  document.title = levelName ? `${data.siteName} | ${levelName}` : data.siteName;

  // Show the correct level container
  const levelId = `level-${state.currentLevel}`;
  const levelEl = document.getElementById(levelId);
  if (levelEl) levelEl.removeAttribute('hidden');

  // Init analytics and log page view
  initAnalytics();
  logEvent('page_view', { level: `level${state.currentLevel}` });

  // Initialize the active level
  switch (state.currentLevel) {
    case 1:
      initLevel1(data.level1);
      break;
    case 2:
      initLevel2(data.level2);
      break;
    case 3:
      initLevel3(data.level3);
      break;
  }

  // CTA button advances to next level
  const ctaBtn = document.getElementById(`level${state.currentLevel}-cta`);
  if (ctaBtn) {
    ctaBtn.addEventListener('click', () => {
      const from = state.currentLevel;
      const to = state.currentLevel + 1;
      logEvent('level_transition', { from: `level${from}`, to: `level${to}` });
      setState({ currentLevel: to });
      location.reload();
    });
  }
}

init();
