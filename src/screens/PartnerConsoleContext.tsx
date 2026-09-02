// ============================================================================
// Rule 2202 Partner Console — state management
// ============================================================================

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type {
  Rule2202Worksite,
  CommuterResearchRecord,
  Rule2202Methodology,
  Rule2202CalculationResult,
} from '../types';

export interface PartnerConsoleState {
  worksites: Rule2202Worksite[];
  selectedWorksite: Rule2202Worksite | null;
  commuterRecords: CommuterResearchRecord[];
  methodologies: Rule2202Methodology[];
  calculationResults: Rule2202CalculationResult[];
  loading: boolean;
  error: string | null;
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
  };
}

export interface PartnerConsoleContextValue {
  state: PartnerConsoleState;
  setSelectedWorksite: (ws: Rule2202Worksite | null) => void;
  setCommuterRecords: (records: CommuterResearchRecord[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  refreshFromApi: () => Promise<void>;
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

  const refreshFromApi = useCallback(async () => {
    // Replace with real Supabase client calls
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      // const { data: worksites, error: wsError } = await supabase
      //   .from('rule2202_worksites')
      //   .select('*')
      //   .order('created_at', { ascending: false });
      // ...
      setState((prev) => ({ ...prev, loading: false }));
    } catch (err) {
      setState((prev) => ({ ...prev, loading: false, error: String(err) }));
    }
  }, []);

  return (
    <PartnerConsoleContext.Provider
      value={{ state, setSelectedWorksite, setCommuterRecords, setLoading, setError, refreshFromApi }}
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
