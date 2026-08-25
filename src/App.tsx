import React, { lazy, Suspense, useState } from 'react';
import { AppProvider } from './context/AppContext';
import { BottomNav } from './components/BottomNav';
import { RoleSelectionScreen } from './screens/RoleSelectionScreen';
import { HomeScreen } from './screens/HomeScreen';
import { RoutesScreen } from './screens/RoutesScreen';
import { SecurityCenterScreen } from './screens/SecurityCenterScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { PrivacyCenterScreen } from './screens/PrivacyCenterScreen';
import { ReviewGatesScreen } from './screens/ReviewGatesScreen';
import { HowItWorksScreen } from './screens/HowItWorksScreen';

const MapScreen = lazy(() => import('./screens/MapScreen').then(module => ({ default: module.MapScreen })));
const PartnerConsoleScreen = lazy(() => import('./screens/PartnerConsoleScreen').then(module => ({ default: module.PartnerConsoleScreen })));
const TripJourneyScreen = lazy(() => import('./screens/TripJourneyScreen').then(module => ({ default: module.TripJourneyScreen })));
const GreenWalletOnboardingFlow = lazy(() => import('./flows/GreenWalletOnboardingFlow').then(module => ({ default: module.GreenWalletOnboardingFlow })));
const WalletScreen = lazy(() => import('./screens/WalletScreen').then(module => ({ default: module.WalletScreen })));
const WalletAdminScreen = lazy(() => import('./screens/WalletAdminScreen').then(module => ({ default: module.WalletAdminScreen })));
const ImpactDashboardScreen = lazy(() => import('./screens/ImpactDashboardScreen').then(module => ({ default: module.ImpactDashboardScreen })));
const CommuteOptionsScreen = lazy(() => import('./screens/CommuteOptionsScreen').then(module => ({ default: module.CommuteOptionsScreen })));
const CommuterMatchesScreen = lazy(() => import('./screens/CommuterMatchesScreen').then(module => ({ default: module.CommuterMatchesScreen })));
const CommuterOnboardingFlow = lazy(() => import('./flows/CommuterOnboardingFlow').then(module => ({ default: module.CommuterOnboardingFlow })));
const EVParticipantFlowScreen = lazy(() => import('./flows/EVParticipantFlowScreen').then(module => ({ default: module.EVParticipantFlowScreen })));

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
  | 'review-gates'
  | 'wallet-onboarding'
  | 'wallet'
  | 'wallet-admin'
  | 'partner-console'
  | 'trip-participant'
  | 'trip-driver'
  | 'impact'
  | 'how-it-works';

const publicPreviewScreens: Screen[] = [
  'role-selection',
  'home',
  'matches',
  'options',
  'map',
  'routes',
  'profile',
  'security-center',
  'wallet-onboarding',
  'wallet',
  'wallet-admin',
  'partner-console',
  'trip-participant',
  'trip-driver',
  'impact',
  'how-it-works',
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
    <Suspense fallback={<ScreenLoadingState />}>
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
            onOpenGreenWallet={() => setCurrentScreen('wallet-onboarding')}
            onOpenImpact={() => setCurrentScreen('impact')}
            onOpenHowItWorks={() => setCurrentScreen('how-it-works')}
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

      {currentScreen === 'route-need-flow' && (
        <CommuterOnboardingFlow
          onCancel={() => {
            setCurrentScreen('home');
            setCurrentTab('home');
          }}
          onComplete={() => {
            setCurrentScreen('options');
            setCurrentTab('options');
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
      {currentScreen === 'wallet-admin' && <WalletAdminScreen onBack={() => setCurrentScreen('wallet')} />}
      {currentScreen === 'impact' && <ImpactDashboardScreen onBack={() => { setCurrentScreen('home'); setCurrentTab('home'); }} />}
      {currentScreen === 'how-it-works' && (
        <HowItWorksScreen
          onBack={() => { setCurrentScreen('home'); setCurrentTab('home'); }}
          onStartCommute={() => setCurrentScreen('route-need-flow')}
          onPostRoute={() => setCurrentScreen('ev-participant-flow')}
        />
      )}
      {currentScreen === 'partner-console' && <PartnerConsoleScreen onBack={() => { setCurrentScreen('home'); setCurrentTab('home'); }} />}
      {currentScreen === 'trip-participant' && (
        <TripJourneyScreen mode="participant" onBack={returnToActivity} onDone={returnToActivity} />
      )}
      {currentScreen === 'trip-driver' && (
        <TripJourneyScreen mode="route-participant" onBack={returnToActivity} onDone={returnToActivity} />
      )}
      </div>
    </Suspense>
  );
}

function ScreenLoadingState() {
  return (
    <main className="container flex min-h-screen items-center justify-center" role="status" aria-live="polite">
      <div className="card w-full text-center">
        <p className="m3-brand-label">Relay Rider</p>
        <h1 className="text-xl font-semibold text-navy">Loading this prototype view…</h1>
        <p className="mt-2 text-sm text-gray-600">Research beta · no live route activation</p>
      </div>
    </main>
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
