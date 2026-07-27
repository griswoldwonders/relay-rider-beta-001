import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole, RouteSignal, EVParticipantSignal, UserProfile, GreenRouteCredit } from '../types';

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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [routeSignals, setRouteSignals] = useState<RouteSignal[]>([]);
  const [evParticipantSignals, setEVParticipantSignals] = useState<EVParticipantSignal[]>([]);
  const [greenRouteCredits, setGreenRouteCredits] = useState<GreenRouteCredit[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    const savedRole = localStorage.getItem('userRole') as UserRole;
    const savedProfile = localStorage.getItem('userProfile');
    const savedSignals = localStorage.getItem('routeSignals');
    const savedEVSignals = localStorage.getItem('evParticipantSignals');
    const savedCredits = localStorage.getItem('greenRouteCredits');

    if (savedRole) setUserRole(savedRole);
    if (savedProfile) setUserProfile(JSON.parse(savedProfile));
    if (savedSignals) setRouteSignals(JSON.parse(savedSignals));
    if (savedEVSignals) setEVParticipantSignals(JSON.parse(savedEVSignals));
    if (savedCredits) setGreenRouteCredits(JSON.parse(savedCredits));
  }, []);

  // Save to localStorage whenever state changes
  useEffect(() => {
    localStorage.setItem('userRole', userRole || '');
  }, [userRole]);

  useEffect(() => {
    if (userProfile) {
      localStorage.setItem('userProfile', JSON.stringify(userProfile));
    }
  }, [userProfile]);

  useEffect(() => {
    localStorage.setItem('routeSignals', JSON.stringify(routeSignals));
  }, [routeSignals]);

  useEffect(() => {
    localStorage.setItem('evParticipantSignals', JSON.stringify(evParticipantSignals));
  }, [evParticipantSignals]);

  useEffect(() => {
    localStorage.setItem('greenRouteCredits', JSON.stringify(greenRouteCredits));
  }, [greenRouteCredits]);

  const addRouteSignal = (signal: RouteSignal) => {
    setRouteSignals([...routeSignals, signal]);
  };

  const updateRouteSignal = (id: string, updates: Partial<RouteSignal>) => {
    setRouteSignals(routeSignals.map(signal =>
      signal.id === id ? { ...signal, ...updates } : signal
    ));
  };

  const addEVParticipantSignal = (signal: EVParticipantSignal) => {
    setEVParticipantSignals([...evParticipantSignals, signal]);
  };

  const addGreenRouteCredit = (credit: GreenRouteCredit) => {
    setGreenRouteCredits([...greenRouteCredits, credit]);
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
