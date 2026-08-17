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
import { PartnerConsoleScreen } from './screens/PartnerConsoleScreen';
import { TripJourneyScreen } from './screens/TripJourneyScreen';
import { InstitutionProgramScreen } from './screens/InstitutionProgramScreen';
import { CommuterOnboardingFlow } from './flows/CommuterOnboardingFlow';
import { EVParticipantFlowScreen } from './flows/EVParticipantFlowScreen';
import { PrivacyCenterScreen } from './screens/PrivacyCenterScreen';
import { ReviewGatesScreen } from './screens/ReviewGatesScreen';
import { GreenWalletOnboardingFlow } from './flows/GreenWalletOnboardingFlow';
import { WalletScreen } from './screens/WalletScreen';

type Screen =
  | 'role-selection'
  | 'home'
  | 'routes'
  | 'matches'
  | 'options'
  | 'map'
  | 'profile'
  | 'institution-program'
  | 'route-need-flow'
  | 'ev-participant-flow'
  | 'privacy-center'
  | 'security-center'
  | 'review-gates'
  | 'wallet-onboarding'
  | 'wallet'
  | 'partner-console'
  | 'trip-participant'
  | 'trip-driver';

const publicPreviewScreens: Screen[] = [
  'role-selection',
  'home',
  'matches',
  'options',
  'map',
  'routes',
  'profile',
  'institution-program',
  'security-center',
  'wallet-onboarding',
  'wallet',
  'partner-console',
  'trip-participant',
  'trip-driver',
];

const getInitialScreen = (): Screen => {
  const requestedScreen = new URLSearchParams(window.location.search).get('screen') as Screen | null;
  return requestedScreen && publicPreviewScreens.includes(requestedScreen) ? requestedScreen : 'home';
};

function AppContent() {
  const initialScreen = getInitialScreen();
  const [currentScreen, setCurrentScreen] = useState<Screen>(initialScreen);
  const [currentTab, setCurrentTab] = useState<string>(initialScreen === 'role-selection' ? 'home' : initialScreen);

  const handleRoleSelect = (role: string) => {
    if (role === 'ev-participant') {
      setCurrentScreen('ev-participant-flow');
      return;
    }
    setCurrentScreen('route-need-flow');
  };

  const handleTabChange = (tab: string) => {
    setCurrentTab(tab);
    if (tab === 'home') setCurrentScreen('home');
    else if (tab === 'matches') setCurrentScreen('matches');
    else if (tab === 'options') setCurrentScreen('options');
    else if (tab === 'map') setCurrentScreen('map');
    else if (tab === 'profile') setCurrentScreen('profile');
  };

  const returnToActivity = () => {
    setCurrentScreen('routes');
    setCurrentTab('routes');
  };

  return (
    <div className="min-h-screen bg-white">
      {currentScreen === 'role-selection' && <RoleSelectionScreen onRoleSelect={handleRoleSelect} />}

      {currentScreen === 'home' && (
        <>
          <HomeScreen
            onStartRouteSignal={() => setCurrentScreen('route-need-flow')}
            onShareEVRoute={() => setCurrentScreen('ev-participant-flow')}
            onOpenInstitutionProgram={() => setCurrentScreen('institution-program')}
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
            onOpenGreenWallet={() => setCurrentScreen('wallet-onboarding')}
          />
          <BottomNav currentTab={currentTab} onTabChange={handleTabChange} />
        </>
      )}

      {currentScreen === 'routes' && (
        <>
          <RoutesScreen
            onViewSignal={() => {}}
            onOpenParticipantTripDemo={() => setCurrentScreen('trip-participant')}
            onOpenDriverTripDemo={() => setCurrentScreen('trip-driver')}
          />
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
            onOpenGreenWallet={() => setCurrentScreen('wallet-onboarding')}
          />
          <BottomNav currentTab={currentTab} onTabChange={handleTabChange} />
        </>
      )}

      {currentScreen === 'institution-program' && (
        <InstitutionProgramScreen onBack={() => { setCurrentScreen('home'); setCurrentTab('home'); }} />
      )}

      {currentScreen === 'route-need-flow' && (
        <CommuterOnboardingFlow
          onCancel={() => {
            setCurrentScreen('home');
            setCurrentTab('home');
          }}
          onComplete={() => {
            setCurrentScreen('matches');
            setCurrentTab('matches');
          }}
        />
      )}
      {currentScreen === 'ev-participant-flow' && <EVParticipantFlowScreen onComplete={() => setCurrentScreen('home')} />}
      {currentScreen === 'privacy-center' && <PrivacyCenterScreen onBack={() => setCurrentScreen('profile')} />}
      {currentScreen === 'security-center' && <SecurityCenterScreen onBack={() => setCurrentScreen('profile')} />}
      {currentScreen === 'review-gates' && <ReviewGatesScreen onBack={() => setCurrentScreen('profile')} />}
      {currentScreen === 'wallet-onboarding' && (
        <GreenWalletOnboardingFlow
          onBack={() => setCurrentScreen('profile')}
          onComplete={() => setCurrentScreen('wallet')}
        />
      )}
      {currentScreen === 'wallet' && <WalletScreen onBack={() => setCurrentScreen('profile')} />}
      {currentScreen === 'partner-console' && <PartnerConsoleScreen onBack={() => { setCurrentScreen('home'); setCurrentTab('home'); }} />}
      {currentScreen === 'trip-participant' && (
        <TripJourneyScreen mode="participant" onBack={returnToActivity} onDone={returnToActivity} />
      )}
      {currentScreen === 'trip-driver' && (
        <TripJourneyScreen mode="route-participant" onBack={returnToActivity} onDone={returnToActivity} />
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
