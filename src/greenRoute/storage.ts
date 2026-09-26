import { defaultState, type ProgramState } from './program';

// One page-session store. Navigation does not reset it; reload creates a fresh module.
let state = defaultState();
const listeners = new Set<() => void>();

export function loadProgramState(): ProgramState {
  return state;
}

export function subscribeProgramState(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Synchronous functional updates avoid stale React-render snapshots. */
export function updateProgramState(transition: (current: ProgramState) => ProgramState) {
  const next = transition(state);
  if (next !== state) {
    state = next;
    listeners.forEach(listener => listener());
  }
  return state;
}

export function resetProgramSession() {
  updateProgramState(() => defaultState());
}
