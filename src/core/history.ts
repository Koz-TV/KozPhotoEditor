import type { HistoryState } from './types';

export const createHistory = <T>(present: T): HistoryState<T> => ({
  past: [],
  present,
  future: [],
});

export const pushHistory = <T>(state: HistoryState<T>, present: T): HistoryState<T> => ({
  past: [...state.past, state.present],
  present,
  future: [],
});

export const undoHistory = <T>(state: HistoryState<T>): HistoryState<T> => {
  if (state.past.length === 0) return state;
  const previous = state.past[state.past.length - 1];
  const past = state.past.slice(0, -1);
  return {
    past,
    present: previous,
    future: [state.present, ...state.future],
  };
};

export const redoHistory = <T>(state: HistoryState<T>): HistoryState<T> => {
  if (state.future.length === 0) return state;
  const [next, ...future] = state.future;
  return {
    past: [...state.past, state.present],
    present: next,
    future,
  };
};
