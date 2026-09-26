import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { GreenRouteCredits } from '../greenRoute/GreenRouteCredits';
import '../greenRoute/greenRoute.css';
import { WalletScreen } from './WalletScreen';

interface GreenWalletHostProps {
  onBack: () => void;
  onOpenAdmin: () => void;
}

export function GreenWalletHost({ onBack, onOpenAdmin }: GreenWalletHostProps) {
  const [surface, setSurface] = useState<'credits' | 'classic'>('credits');

  if (surface === 'classic') {
    return <WalletScreen onBack={() => setSurface('credits')} />;
  }

  return (
    <div className="grc-host">
      <div className="grc-host__bar">
        <button type="button" className="grc-host__back" onClick={onBack}>
          <ArrowLeft size={16} /> Back to profile
        </button>
        <span className="grc-demo-flag">Lives in Relay Rider · Demo / simulated</span>
      </div>
      <GreenRouteCredits
        onOpenClassicWallet={() => setSurface('classic')}
        onOpenClassicAdmin={onOpenAdmin}
      />
    </div>
  );
}
