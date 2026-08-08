import React from 'react';
import { Home, Map, Route, Search, User } from 'lucide-react';

interface BottomNavProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onTabChange }) => {
  const tabs = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'options', label: 'Options', icon: Search },
    { id: 'map', label: 'Map', icon: Map },
    { id: 'routes', label: 'Activity', icon: Route },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <nav className="m3-navigation-bar">
      <div className="m3-navigation-bar__inner">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`m3-navigation-item ${isActive ? 'is-active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="m3-navigation-item__icon"><Icon size={21} strokeWidth={2} /></span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
