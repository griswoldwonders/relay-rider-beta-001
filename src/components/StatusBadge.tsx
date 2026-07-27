import React from 'react';

interface StatusBadgeProps {
  status: 'active' | 'pending' | 'research' | 'inactive';
  label: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label }) => {
  return (
    <span className={`status-badge status-badge.${status}`}>
      {label}
    </span>
  );
};
