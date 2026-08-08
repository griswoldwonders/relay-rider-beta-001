import React from 'react';
import { Home, Map, Route, Sparkles, User } from 'lucide-react';

interface BottomNavProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onTabChange }) => {
  const tabs = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'map', label: 'Map', icon: Map },
    { id: 'options', label: 'Plan', icon: Sparkles, primary: true },
    { id: 'routes', label: 'Activity', icon: Route },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <nav className="m3-navigation-bar" aria-label="Primary navigation">
      <div className="m3-navigation-bar__inner">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`m3-navigation-item ${tab.primary ? 'm3-navigation-item--primary' : ''} ${isActive ? 'is-active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
              aria-label={tab.primary ? 'Plan or compare commute options' : tab.label}
            >
              <span className="m3-navigation-item__icon"><Icon size={tab.primary ? 23 : 20} strokeWidth={2} /></span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
