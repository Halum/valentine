const STATE_KEY = 'anniversary_state';

const DEFAULT = {
  currentLevel: 1,
  level1: { foundSparkles: [] },
  level2: { matchedPairs: [] },
  level3: { capturedWords: [] }
};

export function getState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return structuredClone(DEFAULT);
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT,
      ...parsed,
      level1: { ...DEFAULT.level1, ...parsed.level1 },
      level2: { ...DEFAULT.level2, ...parsed.level2 },
      level3: { ...DEFAULT.level3, ...parsed.level3 }
    };
  } catch {
    return structuredClone(DEFAULT);
  }
}

export function setState(patch) {
  const current = getState();
  const next = { ...current };

  for (const [key, value] of Object.entries(patch)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      next[key] = { ...current[key], ...value };
    } else {
      next[key] = value;
    }
  }

  localStorage.setItem(STATE_KEY, JSON.stringify(next));
  return next;
}

export function resetState() {
  localStorage.removeItem(STATE_KEY);
  return structuredClone(DEFAULT);
}
