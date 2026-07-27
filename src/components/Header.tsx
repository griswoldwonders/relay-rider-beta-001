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
    <div className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
      <div className="max-w-md mx-auto">
        {showBack && (
          <button
            onClick={onBack}
            className="mb-2 p-1 hover:bg-soft-gray rounded-lg transition-colors"
          >
            <ChevronLeft size={24} className="text-navy" />
          </button>
        )}
        <h1 className="text-2xl font-bold text-navy">{title}</h1>
        {subtitle && <p className="text-sm text-gray-600 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
};
