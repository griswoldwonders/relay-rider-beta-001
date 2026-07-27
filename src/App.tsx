import React, { useState } from 'react';
import { AppProvider } from './context/AppContext';
import { BottomNav } from './components/BottomNav';
import { RoleSelectionScreen } from './screens/RoleSelectionScreen';
import { HomeScreen } from './screens/HomeScreen';
import { RoutesScreen } from './screens/RoutesScreen';
import { MapScreen } from './screens/MapScreen';
import { WalletScreen } from './screens/WalletScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { RouteNeedFlowScreen } from './flows/RouteNeedFlowScreen';
import { EVParticipantFlowScreen } from './flows/EVParticipantFlowScreen';
import { PrivacyCenterScreen } from './screens/PrivacyCenterScreen';
import { ReviewGatesScreen } from './screens/ReviewGatesScreen';
import { PartnerConsoleScreen } from './screens/PartnerConsoleScreen';

type Screen =
  | 'role-selection'
  | 'home'
  | 'routes'
  | 'map'
  | 'wallet'
  | 'profile'
  | 'route-need-flow'
  | 'ev-participant-flow'
  | 'privacy-center'
  | 'review-gates'
  | 'partner-console';

function AppContent() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('role-selection');
  const [currentTab, setCurrentTab] = useState('home');

  const handleRoleSelect = () => {
    setCurrentScreen('home');
    setCurrentTab('home');
  };

  const handleTabChange = (tab: string) => {
    setCurrentTab(tab);
    if (tab === 'home') setCurrentScreen('home');
    else if (tab === 'routes') setCurrentScreen('routes');
    else if (tab === 'map') setCurrentScreen('map');
    else if (tab === 'wallet') setCurrentScreen('wallet');
    else if (tab === 'profile') setCurrentScreen('profile');
  };

  return (
    <div className="min-h-screen bg-white">
      {currentScreen === 'role-selection' && (
        <RoleSelectionScreen onRoleSelect={handleRoleSelect} />
      )}

      {currentScreen === 'home' && (
        <>
          <HomeScreen
            onStartRouteSignal={() => setCurrentScreen('route-need-flow')}
            onShareEVRoute={() => setCurrentScreen('ev-participant-flow')}
            onSuggestRelayZone={() => setCurrentScreen('map')}
            onLearnMore={() => {}}
          />
          <BottomNav currentTab={currentTab} onTabChange={handleTabChange} />
        </>
      )}

      {currentScreen === 'routes' && (
        <>
          <RoutesScreen onViewSignal={() => {}} />
          <BottomNav currentTab={currentTab} onTabChange={handleTabChange} />
        </>
      )}

      {currentScreen === 'map' && (
        <>
          <MapScreen onSuggestZone={() => {}} />
          <BottomNav currentTab={currentTab} onTabChange={handleTabChange} />
        </>
      )}

      {currentScreen === 'wallet' && (
        <>
          <WalletScreen onViewRules={() => {}} />
          <BottomNav currentTab={currentTab} onTabChange={handleTabChange} />
        </>
      )}

      {currentScreen === 'profile' && (
        <>
          <ProfileScreen
            onPrivacyCenter={() => setCurrentScreen('privacy-center')}
            onReviewGates={() => setCurrentScreen('review-gates')}
            onPartnerConsole={() => setCurrentScreen('partner-console')}
          />
          <BottomNav currentTab={currentTab} onTabChange={handleTabChange} />
        </>
      )}

      {currentScreen === 'route-need-flow' && (
        <RouteNeedFlowScreen onComplete={() => setCurrentScreen('home')} />
      )}

      {currentScreen === 'ev-participant-flow' && (
        <EVParticipantFlowScreen onComplete={() => setCurrentScreen('home')} />
      )}

      {currentScreen === 'privacy-center' && (
        <PrivacyCenterScreen onBack={() => setCurrentScreen('profile')} />
      )}

      {currentScreen === 'review-gates' && (
        <ReviewGatesScreen onBack={() => setCurrentScreen('profile')} />
      )}

      {currentScreen === 'partner-console' && (
        <PartnerConsoleScreen onBack={() => setCurrentScreen('profile')} />
      )}
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
