import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole, RouteSignal, EVParticipantSignal, UserProfile, GreenRouteCredit } from '../types';
import { clearLegacySensitiveStorage } from '../security/securityPolicy';

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
  clearSessionData: () => void;
  storageMode: 'session-memory';
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [routeSignals, setRouteSignals] = useState<RouteSignal[]>([]);
  const [evParticipantSignals, setEVParticipantSignals] = useState<EVParticipantSignal[]>([]);
  const [greenRouteCredits, setGreenRouteCredits] = useState<GreenRouteCredit[]>([]);

  // Security migration: remove sensitive data persisted by earlier prototype versions.
  useEffect(() => {
    clearLegacySensitiveStorage();
  }, []);

  const addRouteSignal = (signal: RouteSignal) => {
    setRouteSignals(current => [...current, signal]);
  };

  const updateRouteSignal = (id: string, updates: Partial<RouteSignal>) => {
    setRouteSignals(current => current.map(signal =>
      signal.id === id ? { ...signal, ...updates } : signal
    ));
  };

  const addEVParticipantSignal = (signal: EVParticipantSignal) => {
    setEVParticipantSignals(current => [...current, signal]);
  };

  const addGreenRouteCredit = (credit: GreenRouteCredit) => {
    setGreenRouteCredits(current => [...current, credit]);
  };

  const clearSessionData = () => {
    setUserRole(null);
    setUserProfile(null);
    setRouteSignals([]);
    setEVParticipantSignals([]);
    setGreenRouteCredits([]);
    clearLegacySensitiveStorage();
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
        clearSessionData,
        storageMode: 'session-memory',
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
