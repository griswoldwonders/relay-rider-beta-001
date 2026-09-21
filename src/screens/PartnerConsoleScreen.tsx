import React from 'react';
import { PasadenaAdminScreen } from './PasadenaAdminScreen';

interface PartnerConsoleScreenProps {
  onBack: () => void;
}

/**
 * Focused institution-facing demonstration for the Pasadena clean-commute
 * proof chain. The production/main branch partner workspace is preserved;
 * this feature branch remains reversible and uses synthetic/modelled data.
 */
export const PartnerConsoleScreen: React.FC<PartnerConsoleScreenProps> = ({ onBack }) => {
  return <PasadenaAdminScreen onBack={onBack} />;
};
