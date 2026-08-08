import React, { useState } from 'react';
import { AppProvider } from './context/AppContext';
import { BottomNav } from './components/BottomNav';
import { RoleSelectionScreen } from './screens/RoleSelectionScreen';
import { HomeScreen } from './screens/HomeScreen';
import { RoutesScreen } from './screens/RoutesScreen';
import { MapScreen } from './screens/MapScreen';
import { CommuteOptionsScreen } from './screens/CommuteOptionsScreen';
import { CommuterMatchesScreen } from './screens/CommuterMatchesScreen';
import { SecurityCenterScreen } from './screens/SecurityCenterScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { RouteNeedFlowScreen } from './flows/RouteNeedFlowScreen';
import { EVParticipantFlowScreen } from './flows/EVParticipantFlowScreen';
import { PrivacyCenterScreen } from './screens/PrivacyCenterScreen';
import { ReviewGatesScreen } from './screens/ReviewGatesScreen';

type Screen =
  | 'role-selection'
  | 'home'
  | 'routes'
  | 'matches'
  | 'options'
  | 'map'
  | 'profile'
  | 'route-need-flow'
  | 'ev-participant-flow'
  | 'privacy-center'
  | 'security-center'
  | 'review-gates';

const publicPreviewScreens: Screen[] = [
  'role-selection',
  'home',
  'matches',
  'options',
  'map',
  'routes',
  'profile',
  'security-center',
];

const getInitialScreen = (): Screen => {
  const requestedScreen = new URLSearchParams(window.location.search).get('screen') as Screen | null;
  return requestedScreen && publicPreviewScreens.includes(requestedScreen) ? requestedScreen : 'role-selection';
};

function AppContent() {
  const initialScreen = getInitialScreen();
  const [currentScreen, setCurrentScreen] = useState<Screen>(initialScreen);
  const [currentTab, setCurrentTab] = useState<string>(initialScreen === 'role-selection' ? 'home' : initialScreen);

  const handleRoleSelect = () => {
    setCurrentScreen('home');
    setCurrentTab('home');
  };

  const handleTabChange = (tab: string) => {
    setCurrentTab(tab);
    if (tab === 'home') setCurrentScreen('home');
    else if (tab === 'matches') setCurrentScreen('matches');
    else if (tab === 'options') setCurrentScreen('options');
    else if (tab === 'map') setCurrentScreen('map');
    else if (tab === 'profile') setCurrentScreen('profile');
  };

  return (
    <div className="min-h-screen bg-white">
      {currentScreen === 'role-selection' && <RoleSelectionScreen onRoleSelect={handleRoleSelect} />}

      {currentScreen === 'home' && (
        <>
          <HomeScreen
            onStartRouteSignal={() => setCurrentScreen('route-need-flow')}
            onShareEVRoute={() => setCurrentScreen('ev-participant-flow')}
            onSuggestRelayZone={() => {
              setCurrentScreen('map');
              setCurrentTab('map');
            }}
            onBrowseMatches={() => {
              setCurrentScreen('matches');
              setCurrentTab('matches');
            }}
            onBrowseOptions={() => {
              setCurrentScreen('options');
              setCurrentTab('options');
            }}
            onBrowseActivity={() => {
              setCurrentScreen('routes');
              setCurrentTab('routes');
            }}
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

      {currentScreen === 'matches' && (
        <>
          <CommuterMatchesScreen />
          <BottomNav currentTab={currentTab} onTabChange={handleTabChange} />
        </>
      )}

      {currentScreen === 'options' && (
        <>
          <CommuteOptionsScreen />
          <BottomNav currentTab={currentTab} onTabChange={handleTabChange} />
        </>
      )}

      {currentScreen === 'map' && (
        <>
          <MapScreen onSuggestZone={() => {}} />
          <BottomNav currentTab={currentTab} onTabChange={handleTabChange} />
        </>
      )}

      {currentScreen === 'profile' && (
        <>
          <ProfileScreen
            onPrivacyCenter={() => setCurrentScreen('privacy-center')}
            onSecurityCenter={() => setCurrentScreen('security-center')}
            onReviewGates={() => setCurrentScreen('review-gates')}
          />
          <BottomNav currentTab={currentTab} onTabChange={handleTabChange} />
        </>
      )}

      {currentScreen === 'route-need-flow' && <RouteNeedFlowScreen onComplete={() => setCurrentScreen('home')} />}
      {currentScreen === 'ev-participant-flow' && <EVParticipantFlowScreen onComplete={() => setCurrentScreen('home')} />}
      {currentScreen === 'privacy-center' && <PrivacyCenterScreen onBack={() => setCurrentScreen('profile')} />}
      {currentScreen === 'security-center' && <SecurityCenterScreen onBack={() => setCurrentScreen('profile')} />}
      {currentScreen === 'review-gates' && <ReviewGatesScreen onBack={() => setCurrentScreen('profile')} />}
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
