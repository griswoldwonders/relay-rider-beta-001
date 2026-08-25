import { createContext, useContext, useEffect, useState } from 'react';
import { ChargingHub, UserRole, RouteSignal, EVParticipantSignal, UserProfile, GreenRouteCredit, RedemptionRequest } from '../types';
import { clearLegacySensitiveStorage } from '../security/securityPolicy';

export const demoChargingHubs: ChargingHub[] = [
  { id: 'campus-west-garage', name: 'Campus West Garage', network: 'Institution-operated', city: 'Pasadena', stalls: 6, connectorTypes: ['J1772', 'CCS'], status: 'verified', evidenceLabel: 'modeled' },
  { id: 'campus-south-lot', name: 'Campus South Lot', network: 'Institution-operated', city: 'Pasadena', stalls: 4, connectorTypes: ['J1772'], status: 'candidate', evidenceLabel: 'modeled' },
  { id: 'glendale-transit-center', name: 'Glendale Transit Center', network: 'ChargePoint', city: 'Glendale', stalls: 4, connectorTypes: ['J1772'], status: 'candidate', evidenceLabel: 'modeled' },
];

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
  redemptionRequests: RedemptionRequest[];
  createRedemptionRequest: (request: RedemptionRequest) => void;
  reviewRedemptionRequest: (id: string, status: 'fulfilled' | 'denied', note: string) => void;
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
  const [redemptionRequests, setRedemptionRequests] = useState<RedemptionRequest[]>([]);

  useEffect(() => { clearLegacySensitiveStorage(); }, []);

  const addRouteSignal = (signal: RouteSignal) => setRouteSignals(current => [...current, signal]);
  const updateRouteSignal = (id: string, updates: Partial<RouteSignal>) => setRouteSignals(current => current.map(signal => signal.id === id ? { ...signal, ...updates } : signal));
  const addEVParticipantSignal = (signal: EVParticipantSignal) => setEVParticipantSignals(current => [...current, signal]);
  const addGreenRouteCredit = (credit: GreenRouteCredit) => setGreenRouteCredits(current => [...current, credit]);
  const createRedemptionRequest = (request: RedemptionRequest) => setRedemptionRequests(current => current.some(item => item.creditId === request.creditId && ['requested', 'under-review'].includes(item.status)) ? current : [...current, request]);
  const reviewRedemptionRequest = (id: string, status: 'fulfilled' | 'denied', note: string) => setRedemptionRequests(current => current.map(request => request.id === id ? { ...request, status, reviewNote: note, reviewedAt: new Date().toISOString(), reviewedBy: 'demo-program-admin' } : request));
  const clearSessionData = () => { setUserRole(null); setUserProfile(null); setRouteSignals([]); setEVParticipantSignals([]); setGreenRouteCredits([]); setRedemptionRequests([]); clearLegacySensitiveStorage(); };

  return <AppContext.Provider value={{ userRole, setUserRole, userProfile, setUserProfile, routeSignals, addRouteSignal, updateRouteSignal, evParticipantSignals, addEVParticipantSignal, greenRouteCredits, addGreenRouteCredit, redemptionRequests, createRedemptionRequest, reviewRedemptionRequest, clearSessionData, storageMode: 'session-memory' }}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
