import React from 'react';
import { ChevronLeft } from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  showBack?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle, onBack, showBack }) => {
  return (
    <header className="m3-top-app-bar">
      <div className="m3-top-app-bar__inner">
        {showBack && (
          <button
            onClick={onBack}
            className="m3-icon-button"
            aria-label="Go back"
          >
            <ChevronLeft size={24} className="text-navy" />
          </button>
        )}
        <div>
          <p className="m3-brand-label">Relay Rider</p>
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
    </header>
  );
};
