import { resetState } from './state.js';

const params = new URLSearchParams(window.location.search);

export const isAdmin = params.get('admin') === 'true';

export function getOverrideLevel() {
  const level = params.get('level');
  return level ? parseInt(level, 10) : null;
}

export function shouldReset() {
  return params.get('reset') === 'true';
}

export function applyAdminOverrides() {
  if (shouldReset()) {
    resetState();
  }
}
