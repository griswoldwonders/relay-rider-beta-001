import React from 'react';
import { PasadenaAdminScreen } from './PasadenaAdminScreen';

interface PartnerConsoleScreenProps {
  onBack: () => void;
}

/**
 * Focused institution-facing prototype for the Pasadena EV commuter proof chain.
 *
 * This intentionally replaces the older broad partner console on the feature branch.
 * The main branch remains unchanged, so this experiment can be reviewed or reverted
 * without disturbing the current production prototype.
 */
export const PartnerConsoleScreen: React.FC<PartnerConsoleScreenProps> = ({ onBack }) => {
  return <PasadenaAdminScreen onBack={onBack} />;
};
