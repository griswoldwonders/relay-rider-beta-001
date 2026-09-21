import { STORAGE_KEY, defaultState, type ProgramState } from './program';

export function loadProgramState(): ProgramState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return { ...defaultState(), ...JSON.parse(raw) };
  } catch {
    return defaultState();
  }
}

export function saveProgramState(state: ProgramState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
