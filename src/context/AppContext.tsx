import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole, RouteSignal, EVParticipantSignal, UserProfile, GreenRouteCredit } from '../types';
import { clearLegacySensitiveStorage } from '../security/securityPolicy';
import {
  acceptInstitutionInvitation,
  getParticipantMatchPreviews,
  getProgramContexts,
  signInToRelayProgram,
  signOutOfRelayProgram,
  signUpForRelayProgram,
  submitCommuterNeed,
  submitPlannedRoute,
  type ParticipantMatchPreview,
  type ProgramContext,
  type RelayAuthSession,
} from '../backend/relayBackend';
import { evSignalToPlannedRoute, routeSignalToCommuterNeed } from '../backend/participantMappers';

export type BackendActivity = {
  state: 'disconnected' | 'authenticated' | 'program_connected' | 'saving' | 'persisted' | 'prototype_only' | 'error';
  message: string;
  recordType?: 'commuter_need' | 'planned_route';
  recordId?: string;
};

interface AppContextType {
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  userProfile: UserProfile | null;
  setUserProfile: (profile: UserProfile) => void;
  routeSignals: RouteSignal[];
  addRouteSignal: (signal: RouteSignal) => void;
  updateRouteSignal: (id: string, signal: Partial<RouteSignal>) => void;
  evParticipantSignals: EVParticipantSignal[];
  addEVParticipantSignal: (signal: EVParticipantSignal) => void;
  greenRouteCredits: GreenRouteCredit[];
  addGreenRouteCredit: (credit: GreenRouteCredit) => void;
  backendSession: RelayAuthSession | null;
  programContexts: ProgramContext[];
  activeProgram: ProgramContext | null;
  participantMatches: ParticipantMatchPreview[];
  backendActivity: BackendActivity;
  connectProgram: (email: string, password: string) => Promise<void>;
  createProgramAccount: (email: string, password: string) => Promise<'authenticated' | 'email_confirmation_required'>;
  acceptProgramInvitation: (inviteToken: string) => Promise<void>;
  disconnectProgram: () => Promise<void>;
  selectProgramContext: (context: ProgramContext) => void;
  refreshProgramContexts: () => Promise<void>;
  refreshParticipantMatches: () => Promise<void>;
  clearSessionData: () => void;
  storageMode: 'session-prototype' | 'institutional-backend+session-prototype';
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [routeSignals, setRouteSignals] = useState<RouteSignal[]>([]);
  const [evParticipantSignals, setEVParticipantSignals] = useState<EVParticipantSignal[]>([]);
  const [greenRouteCredits, setGreenRouteCredits] = useState<GreenRouteCredit[]>([]);
  const [backendSession, setBackendSession] = useState<RelayAuthSession | null>(null);
  const [programContexts, setProgramContexts] = useState<ProgramContext[]>([]);
  const [activeProgram, setActiveProgram] = useState<ProgramContext | null>(null);
  const [participantMatches, setParticipantMatches] = useState<ParticipantMatchPreview[]>([]);
  const [backendActivity, setBackendActivity] = useState<BackendActivity>({
    state: 'disconnected',
    message: 'Prototype session only. Connect an institution-sponsored program to persist participant records.',
  });

  useEffect(() => {
    clearLegacySensitiveStorage();
  }, []);

  const loadProgramContexts = async (session: RelayAuthSession, preferredOrganizationId?: string) => {
    const contexts = await getProgramContexts(session);
    setProgramContexts(contexts);
    const preferred = preferredOrganizationId
      ? contexts.find(context => context.organization_id === preferredOrganizationId)
      : null;
    const selected = preferred ?? contexts[0] ?? null;
    setActiveProgram(selected);
    if (selected) {
      setBackendActivity({
        state: 'program_connected',
        message: `Connected to ${selected.organization_name}. Participant writes use the governed institutional backend.`,
      });
    } else {
      setBackendActivity({
        state: 'authenticated',
        message: 'Authenticated, but no active institution program membership is available yet. Accept an institution invitation to continue.',
      });
    }
    return contexts;
  };

  const connectProgram = async (email: string, password: string) => {
    setBackendActivity({ state: 'saving', message: 'Connecting secure institutional session…' });
    try {
      const session = await signInToRelayProgram(email, password);
      setBackendSession(session);
      await loadProgramContexts(session);
      const matches = await getParticipantMatchPreviews(session);
      setParticipantMatches(matches);
    } catch (error) {
      setBackendActivity({ state: 'error', message: error instanceof Error ? error.message : 'Unable to connect institutional session.' });
      throw error;
    }
  };

  const createProgramAccount = async (email: string, password: string) => {
    setBackendActivity({ state: 'saving', message: 'Creating participant account…' });
    try {
      const result = await signUpForRelayProgram(email, password);
      if (result.status === 'email_confirmation_required') {
        setBackendActivity({
          state: 'authenticated',
          message: 'Account created. Confirm the email address if required, then sign in and accept the institution invitation.',
        });
        return 'email_confirmation_required' as const;
      }
      setBackendSession(result.session);
      await loadProgramContexts(result.session);
      return 'authenticated' as const;
    } catch (error) {
      setBackendActivity({ state: 'error', message: error instanceof Error ? error.message : 'Unable to create participant account.' });
      throw error;
    }
  };

  const acceptProgramInvitation = async (inviteToken: string) => {
    if (!backendSession) throw new Error('Sign in before accepting an institution invitation.');
    setBackendActivity({ state: 'saving', message: 'Verifying institution invitation…' });
    try {
      const organizationId = await acceptInstitutionInvitation(backendSession, inviteToken);
      await loadProgramContexts(backendSession, organizationId);
      const matches = await getParticipantMatchPreviews(backendSession);
      setParticipantMatches(matches);
    } catch (error) {
      setBackendActivity({ state: 'error', message: error instanceof Error ? error.message : 'Unable to accept institution invitation.' });
      throw error;
    }
  };

  const disconnectProgram = async () => {
    const session = backendSession;
    setBackendSession(null);
    setProgramContexts([]);
    setActiveProgram(null);
    setParticipantMatches([]);
    setBackendActivity({
      state: 'disconnected',
      message: 'Institutional session disconnected. Prototype-only state remains in memory until this browser session is cleared.',
    });
    if (session) {
      try {
        await signOutOfRelayProgram(session);
      } catch {
        // Local session is already cleared; remote sign-out failure must not recreate it.
      }
    }
  };

  const selectProgramContext = (context: ProgramContext) => {
    setActiveProgram(context);
    setBackendActivity({
      state: 'program_connected',
      message: `Active program: ${context.organization_name}${context.site_name ? ` · ${context.site_name}` : ''}.`,
    });
  };

  const refreshProgramContexts = async () => {
    if (!backendSession) return;
    await loadProgramContexts(backendSession, activeProgram?.organization_id);
  };

  const refreshParticipantMatches = async () => {
    if (!backendSession) {
      setParticipantMatches([]);
      return;
    }
    try {
      setParticipantMatches(await getParticipantMatchPreviews(backendSession));
    } catch (error) {
      setBackendActivity({ state: 'error', message: error instanceof Error ? error.message : 'Unable to refresh participant Match Previews.' });
      throw error;
    }
  };

  const addRouteSignal = (signal: RouteSignal) => {
    if (!backendSession || !activeProgram) {
      setRouteSignals(current => [...current, signal]);
      setBackendActivity({
        state: 'prototype_only',
        message: 'Commute profile saved only in this prototype session. Connect an active institution program for governed backend persistence.',
        recordType: 'commuter_need',
      });
      return;
    }

    setBackendActivity({ state: 'saving', message: 'Saving commuter need to the institutional program…', recordType: 'commuter_need' });
    void submitCommuterNeed(backendSession, routeSignalToCommuterNeed(signal, activeProgram))
      .then(recordId => {
        setRouteSignals(current => [...current, signal]);
        setBackendActivity({
          state: 'persisted',
          message: 'Commuter need persisted. A qualified institutional reviewer must generate and review any Match Preview.',
          recordType: 'commuter_need',
          recordId,
        });
        return refreshParticipantMatches();
      })
      .catch(error => {
        setBackendActivity({
          state: 'error',
          message: error instanceof Error ? error.message : 'Commuter need could not be persisted.',
          recordType: 'commuter_need',
        });
      });
  };

  const updateRouteSignal = (id: string, updates: Partial<RouteSignal>) => {
    setRouteSignals(current => current.map(signal =>
      signal.id === id ? { ...signal, ...updates } : signal
    ));
  };

  const addEVParticipantSignal = (signal: EVParticipantSignal) => {
    if (!backendSession || !activeProgram) {
      setEVParticipantSignals(current => [...current, signal]);
      setBackendActivity({
        state: 'prototype_only',
        message: 'Planned-route signal saved only in this prototype session. Connect an active institution program for governed backend persistence.',
        recordType: 'planned_route',
      });
      return;
    }

    setBackendActivity({ state: 'saving', message: 'Registering existing planned route with the institutional program…', recordType: 'planned_route' });
    void submitPlannedRoute(backendSession, evSignalToPlannedRoute(signal, activeProgram))
      .then(recordId => {
        setEVParticipantSignals(current => [...current, signal]);
        setBackendActivity({
          state: 'persisted',
          message: 'Existing planned route registered for program review. This does not activate transportation or create compensation.',
          recordType: 'planned_route',
          recordId,
        });
        return refreshParticipantMatches();
      })
      .catch(error => {
        setBackendActivity({
          state: 'error',
          message: error instanceof Error ? error.message : 'Planned route could not be persisted.',
          recordType: 'planned_route',
        });
      });
  };

  const addGreenRouteCredit = (credit: GreenRouteCredit) => {
    setGreenRouteCredits(current => [...current, credit]);
  };

  const clearSessionData = () => {
    const session = backendSession;
    setUserRole(null);
    setUserProfile(null);
    setRouteSignals([]);
    setEVParticipantSignals([]);
    setGreenRouteCredits([]);
    setBackendSession(null);
    setProgramContexts([]);
    setActiveProgram(null);
    setParticipantMatches([]);
    setBackendActivity({ state: 'disconnected', message: 'Session data cleared.' });
    clearLegacySensitiveStorage();
    if (session) void signOutOfRelayProgram(session).catch(() => undefined);
  };

  return (
    <AppContext.Provider
      value={{
        userRole,
        setUserRole,
        userProfile,
        setUserProfile,
        routeSignals,
        addRouteSignal,
        updateRouteSignal,
        evParticipantSignals,
        addEVParticipantSignal,
        greenRouteCredits,
        addGreenRouteCredit,
        backendSession,
        programContexts,
        activeProgram,
        participantMatches,
        backendActivity,
        connectProgram,
        createProgramAccount,
        acceptProgramInvitation,
        disconnectProgram,
        selectProgramContext,
        refreshProgramContexts,
        refreshParticipantMatches,
        clearSessionData,
        storageMode: backendSession && activeProgram ? 'institutional-backend+session-prototype' : 'session-prototype',
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};
