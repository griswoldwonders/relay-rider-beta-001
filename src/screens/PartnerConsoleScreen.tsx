import React, { useState } from 'react';
import { Header } from '../components/Header';
import { corridors } from '../data/demoData';

interface PartnerConsoleScreenProps {
  onBack: () => void;
}

export const PartnerConsoleScreen: React.FC<PartnerConsoleScreenProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState('overview');

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'demand', label: 'Demand Signals' },
    { id: 'zones', label: 'Relay Zones' },
    { id: 'parking', label: 'Parking Pressure' },
    { id: 'ev', label: 'EV/Hybrid' },
    { id: 'packages', label: 'Research Packages' },
  ];

  const researchPackages = [
    {
      name: 'Corridor Mobility Readiness Package',
      price: '$2,500',
      includes: [
        'Commuter demand validation',
        'Relay Zone review',
        'EV/hybrid route signal analysis',
        'Parking-pressure signal review',
        'Pilot-readiness recommendations',
      ],
    },
    {
      name: 'Mobility Impact & Relay Zone Report',
      price: '$1,000',
      includes: [
        'Candidate Access Point review',
        'Route demand summary',
        'Estimated shared-mile potential',
        'Modeled clean mobility impact',
      ],
    },
    {
      name: 'Partner Research Dashboard Access',
      price: '$500/month',
      includes: [
        'Monthly research-beta dashboard access',
        'Selected partners only',
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-white pb-24">
      <Header title="Partner Console" subtitle="Corridor insights and research packages" onBack={onBack} showBack />

      <div className="container py-6 space-y-6">
        {/* Tab Navigation */}
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-navy text-white'
                  : 'bg-soft-gray text-gray-700 hover:bg-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <h2 className="section-title">Corridor Snapshot</h2>
            <div className="space-y-3">
              {corridors.map(corridor => (
                <div key={corridor.id} className="card">
                  <h3 className="font-bold text-navy mb-3">{corridor.name}</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-gray-600">Route Signals</p>
                      <p className="font-bold text-navy mt-1">{corridor.routeSignals}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">EV/Hybrid Participants</p>
                      <p className="font-bold text-navy mt-1">{corridor.evParticipants}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Relay Zones</p>
                      <p className="font-bold text-navy mt-1">{corridor.relayZones}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Parking Pressure</p>
                      <p className="font-bold text-orange-600 mt-1">{corridor.parkingPressure}</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs font-semibold text-blue-600">
                      Pilot Readiness: {corridor.pilotReadiness.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Demand Signals Tab */}
        {activeTab === 'demand' && (
          <div className="space-y-4">
            <h2 className="section-title">Demand Signals</h2>
            <div className="card">
              <p className="text-gray-600">Total route-interest signals collected: <span className="font-bold text-navy">165</span></p>
              <p className="text-gray-600 mt-2">Average signal strength: <span className="font-bold text-navy">Moderate</span></p>
              <p className="text-gray-600 mt-2">Signals needing more data: <span className="font-bold text-orange-600">42</span></p>
            </div>
          </div>
        )}

        {/* Relay Zones Tab */}
        {activeTab === 'zones' && (
          <div className="space-y-4">
            <h2 className="section-title">Relay Zone Suggestions</h2>
            <div className="card">
              <p className="text-gray-600">Total candidate zones: <span className="font-bold text-navy">52</span></p>
              <p className="text-gray-600 mt-2">Zones needing review: <span className="font-bold text-orange-600">28</span></p>
              <p className="text-gray-600 mt-2">Approved zones: <span className="font-bold text-mobility-green">8</span></p>
            </div>
          </div>
        )}

        {/* Parking Pressure Tab */}
        {activeTab === 'parking' && (
          <div className="space-y-4">
            <h2 className="section-title">Parking Pressure Signals</h2>
            <div className="card">
              <p className="text-gray-600">High pressure corridors: <span className="font-bold text-orange-600">3</span></p>
              <p className="text-gray-600 mt-2">Medium pressure corridors: <span className="font-bold text-yellow-600">2</span></p>
              <p className="text-gray-600 mt-2">Low pressure corridors: <span className="font-bold text-mobility-green">1</span></p>
            </div>
          </div>
        )}

        {/* EV/Hybrid Tab */}
        {activeTab === 'ev' && (
          <div className="space-y-4">
            <h2 className="section-title">EV/Hybrid Participation</h2>
            <div className="card">
              <p className="text-gray-600">Total EV/hybrid route signals: <span className="font-bold text-navy">46</span></p>
              <p className="text-gray-600 mt-2">EV-only signals: <span className="font-bold text-navy">18</span></p>
              <p className="text-gray-600 mt-2">Hybrid signals: <span className="font-bold text-navy">28</span></p>
            </div>
          </div>
        )}

        {/* Research Packages Tab */}
        {activeTab === 'packages' && (
          <div className="space-y-4">
            <h2 className="section-title">Research Package Offers</h2>
            {researchPackages.map((pkg, idx) => (
              <div key={idx} className="card">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-bold text-navy">{pkg.name}</h3>
                  <span className="text-lg font-bold text-mobility-green">{pkg.price}</span>
                </div>
                <ul className="space-y-2">
                  {pkg.includes.map((item, itemIdx) => (
                    <li key={itemIdx} className="flex gap-2">
                      <span className="text-mobility-green font-bold">✓</span>
                      <span className="text-sm text-gray-700">{item}</span>
                    </li>
                  ))}
                </ul>
                <button className="btn-primary mt-4">
                  Request Package
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
