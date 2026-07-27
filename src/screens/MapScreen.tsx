import React, { useState } from 'react';
import { Header } from '../components/Header';
import { relayZones, corridors } from '../data/demoData';
import { MapPin } from 'lucide-react';

interface MapScreenProps {
  onSuggestZone: () => void;
}

export const MapScreen: React.FC<MapScreenProps> = ({ onSuggestZone }) => {
  const [selectedCorridor, setSelectedCorridor] = useState<string>('pasadena-glendale');
  const [selectedZoneType, setSelectedZoneType] = useState<string>('all');

  const filteredZones = relayZones.filter(zone => {
    const corridorMatch = selectedCorridor === 'all' || zone.corridor === selectedCorridor;
    const typeMatch = selectedZoneType === 'all' || zone.type === selectedZoneType;
    return corridorMatch && typeMatch;
  });

  const zoneTypes = ['all', ...new Set(relayZones.map(z => z.type))];

  const getReviewStatusColor = (status: string) => {
    if (status === 'candidate') return 'bg-light-green text-mobility-green';
    if (status === 'needs-partner') return 'bg-warning-yellow text-yellow-800';
    if (status === 'needs-safety') return 'bg-red-100 text-red-700';
    if (status === 'needs-property') return 'bg-orange-100 text-orange-700';
    return 'bg-soft-gray text-gray-600';
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      <Header title="Relay Zone Map" subtitle="Candidate Access Points and Corridor Anchors for research-beta planning." />

      <div className="container py-6 space-y-4">
        {/* Filters */}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-semibold text-navy mb-2">Corridor</label>
            <select
              value={selectedCorridor}
              onChange={e => setSelectedCorridor(e.target.value)}
              className="input-field"
            >
              <option value="all">All Corridors</option>
              {corridors.map(corridor => (
                <option key={corridor.id} value={corridor.id}>
                  {corridor.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-navy mb-2">Zone Type</label>
            <select
              value={selectedZoneType}
              onChange={e => setSelectedZoneType(e.target.value)}
              className="input-field"
            >
              {zoneTypes.map(type => (
                <option key={type} value={type}>
                  {type === 'all' ? 'All Types' : type}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="bg-light-blue border border-blue-300 rounded-lg p-3">
          <p className="text-xs text-blue-900">
            <strong>Candidate Relay Zones</strong> are planning concepts only. They are not approved pickup/dropoff locations unless site rules, partner permission, safety review, insurance review, and operational review are complete.
          </p>
        </div>

        {/* Zone Cards */}
        <div className="space-y-3">
          {filteredZones.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-gray-600">No zones match your filters</p>
            </div>
          ) : (
            filteredZones.map(zone => (
              <div key={zone.id} className="card">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 bg-light-green rounded-lg flex items-center justify-center flex-shrink-0">
                    <MapPin size={20} className="text-mobility-green" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-navy">{zone.name}</h3>
                    <p className="text-xs text-gray-600 mt-1">{zone.address}</p>
                  </div>
                </div>

                <div className="space-y-2 mb-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">Zone Type</span>
                    <span className="text-xs font-medium text-navy">{zone.type}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">Review Status</span>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${getReviewStatusColor(zone.reviewStatus)}`}>
                      {zone.reviewStatus.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600">Suggested By</span>
                    <span className="text-xs font-medium text-navy">{zone.suggestedByCount} users</span>
                  </div>
                </div>

                {zone.notes && (
                  <p className="text-xs text-gray-600 bg-soft-gray rounded p-2">
                    <strong>Notes:</strong> {zone.notes}
                  </p>
                )}

                {(zone.partnerReviewNeeded || zone.safetyReviewNeeded || zone.propertyReviewNeeded) && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs font-semibold text-orange-600">
                      {[
                        zone.partnerReviewNeeded && 'Partner review needed',
                        zone.safetyReviewNeeded && 'Safety review needed',
                        zone.propertyReviewNeeded && 'Property review needed',
                      ]
                        .filter(Boolean)
                        .join(' • ')}
                    </p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* CTA */}
        <button onClick={onSuggestZone} className="btn-primary">
          Suggest a Relay Zone
        </button>
      </div>
    </div>
  );
};
