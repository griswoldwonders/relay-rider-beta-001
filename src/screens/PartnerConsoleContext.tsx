// ============================================================================
// Rule 2202 Partner Console — state management
// Wired to Supabase when VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are set.
// Falls back to mock fixtures when the client is not configured.
// ============================================================================

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type {
  Rule2202Worksite,
  CommuterResearchRecord,
  Rule2202Methodology,
  Rule2202CalculationResult,
} from '../types';
import { listWorksites, listCommuterRecordsForWorksite, listMethodologies } from '../lib/rule2202-service';

export interface PartnerConsoleState {
  worksites: Rule2202Worksite[];
  selectedWorksite: Rule2202Worksite | null;
  commuterRecords: CommuterResearchRecord[];
  methodologies: Rule2202Methodology[];
  calculationResults: Rule2202CalculationResult[];
  loading: boolean;
  error: string | null;
  dataSource: 'supabase' | 'mock';
}

export function createInitialState(): PartnerConsoleState {
  return {
    worksites: [],
    selectedWorksite: null,
    commuterRecords: [],
    methodologies: [],
    calculationResults: [],
    loading: false,
    error: null,
    dataSource: 'mock',
  };
}

export interface PartnerConsoleContextValue {
  state: PartnerConsoleState;
  setSelectedWorksite: (ws: Rule2202Worksite | null) => void;
  setCommuterRecords: (records: CommuterResearchRecord[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  refreshFromApi: () => Promise<void>;
  /** Manually select a worksite from the loaded list (or pass a mock for demo mode). */
  selectWorksiteById: (worksiteId: string | null) => void;
}

const PartnerConsoleContext = createContext<PartnerConsoleContextValue | null>(null);

export function PartnerConsoleProvider({ children, initialState = createInitialState() }: { children: ReactNode; initialState?: PartnerConsoleState }) {
  const [state, setState] = useState<PartnerConsoleState>(initialState);

  const setSelectedWorksite = useCallback((ws: Rule2202Worksite | null) => {
    setState((prev) => ({ ...prev, selectedWorksite: ws }));
  }, []);

  const setCommuterRecords = useCallback((records: CommuterResearchRecord[]) => {
    setState((prev) => ({ ...prev, commuterRecords: records }));
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    setState((prev) => ({ ...prev, loading }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState((prev) => ({ ...prev, error }));
  }, []);

  const selectWorksiteById = useCallback((worksiteId: string | null) => {
    if (!worksiteId) {
      setState((prev) => ({ ...prev, selectedWorksite: null, commuterRecords: [] }));
      return;
    }
    const ws = state.worksites.find((w) => w.id === worksiteId || w.sixDigitWorksiteId === worksiteId);
    if (ws) {
      setState((prev) => ({ ...prev, selectedWorksite: ws }));
    }
  }, [state.worksites]);

  const refreshFromApi = useCallback(async () => {
    if (!listWorksites) {
      setState((prev) => ({ ...prev, loading: false, dataSource: 'mock' }));
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null, dataSource: 'supabase' }));

    try {
      const [worksitesResult, methodologiesResult] = await Promise.all([
        listWorksites({ limit: 100 }),
        listMethodologies({ activeOnly: true, limit: 100 }),
      ]);

      setState((prev) => ({
        ...prev,
        worksites: worksitesResult,
        methodologies: methodologiesResult,
        loading: false,
        dataSource: 'supabase',
        // Keep selectedWorksite if it still exists in the fresh list,
        // otherwise clear it.
        selectedWorksite:
          prev.selectedWorksite && worksitesResult.some(
            (w) => w.id === prev.selectedWorksite!.id
          )
            ? prev.selectedWorksite
            : null,
      }));

      // If a worksite is selected, load its commuter records.
      // This is a best-effort follow-up; the screen will re-fetch records
      // when the user picks a specific worksite.
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: String(err),
        dataSource: 'mock',
      }));
    }
  }, []);

  // Auto-load on mount when Supabase is configured.
  useEffect(() => {
    refreshFromApi();
  }, [refreshFromApi]);

  return (
    <PartnerConsoleContext.Provider
      value={{ state, setSelectedWorksite, setCommuterRecords, setLoading, setError, refreshFromApi, selectWorksiteById }}
    >
      {children}
    </PartnerConsoleContext.Provider>
  );
}

export function usePartnerConsole() {
  const ctx = useContext(PartnerConsoleContext);
  if (!ctx) {
    throw new Error('usePartnerConsole must be used within a PartnerConsoleProvider');
  }
  return ctx;
}
