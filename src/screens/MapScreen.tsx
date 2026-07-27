import React, { useCallback, useMemo, useState } from 'react';
import { BatteryCharging, ExternalLink, MapPin, ShieldCheck } from 'lucide-react';
import { Header } from '../components/Header';
import { CorridorMap } from '../components/CorridorMap';
import { mapLocations, MapLocationKind } from '../data/mapLocations';

interface MapScreenProps {
  onSuggestZone: () => void;
}

type LocationFilter = 'all' | MapLocationKind;

export const MapScreen: React.FC<MapScreenProps> = ({ onSuggestZone }) => {
  const [locationFilter, setLocationFilter] = useState<LocationFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filteredLocations = useMemo(
    () => mapLocations.filter(location => locationFilter === 'all' || location.kind === locationFilter),
    [locationFilter],
  );

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    document.getElementById(`location-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  return (
    <div className="min-h-screen bg-white pb-24">
      <Header
        title="Corridor Map"
        subtitle="Real public locations across Pasadena, Eagle Rock, and Glendale."
      />

      <div className="container py-5 space-y-4">
        <div className="flex rounded-xl bg-soft-gray p-1" aria-label="Map location filters">
          {[
            ['all', 'All locations'],
            ['anchor', 'Anchor Points'],
            ['ev-hub', 'EV hubs'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setLocationFilter(value as LocationFilter);
                setSelectedId(null);
              }}
              className={`flex-1 rounded-lg px-2 py-2 text-xs font-semibold transition ${
                locationFilter === value ? 'bg-white text-navy shadow-sm' : 'text-gray-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <CorridorMap locations={filteredLocations} selectedId={selectedId} onSelect={handleSelect} />

        <div className="flex flex-wrap gap-3 text-xs text-gray-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-mobility-green" /> Candidate Anchor Point
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[9px] text-white">⚡</span>
            Verified EV hub
          </span>
        </div>

        <div className="rounded-xl border border-blue-200 bg-light-blue p-3">
          <div className="flex items-start gap-2">
            <ShieldCheck size={18} className="mt-0.5 flex-shrink-0 text-blue-800" />
            <p className="text-xs leading-relaxed text-blue-900">
              <strong>Research Beta:</strong> Public locations and charging infrastructure are source-verified.
              Anchor Point suitability is not approved. Partner, site-rule, accessibility, lighting, legal, insurance,
              and field-safety review are required before any pilot use.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div>
            <p className="text-sm font-bold text-navy">Map locations</p>
            <p className="text-xs text-gray-500">{filteredLocations.length} shown · Updated July 2026</p>
          </div>
          <span className="rounded-full bg-soft-gray px-3 py-1 text-xs font-semibold text-gray-600">
            OpenStreetMap
          </span>
        </div>

        <div className="space-y-3">
          {filteredLocations.map(location => {
            const isEvHub = location.kind === 'ev-hub';
            const isSelected = location.id === selectedId;

            return (
              <article
                id={`location-${location.id}`}
                key={location.id}
                className={`card scroll-mt-24 transition ${isSelected ? 'ring-2 ring-mobility-green' : ''}`}
                onClick={() => setSelectedId(location.id)}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${
                      isEvHub ? 'bg-blue-100 text-blue-700' : 'bg-light-green text-mobility-green'
                    }`}
                  >
                    {isEvHub ? <BatteryCharging size={22} /> : <MapPin size={22} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-navy">{location.name}</h3>
                        <p className="mt-0.5 text-xs font-medium text-gray-500">{location.type} · {location.city}</p>
                      </div>
                      <span
                        className={`whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-bold ${
                          isEvHub ? 'bg-blue-100 text-blue-700' : 'bg-light-green text-mobility-green'
                        }`}
                      >
                        {isEvHub ? 'EV HUB' : 'CANDIDATE'}
                      </span>
                    </div>

                    <p className="mt-3 text-xs leading-relaxed text-gray-600">{location.address}</p>
                    {location.chargerSummary && (
                      <p className="mt-2 rounded-lg bg-blue-50 p-2 text-xs leading-relaxed text-blue-900">
                        {location.chargerSummary}
                      </p>
                    )}
                    <p className="mt-2 text-xs leading-relaxed text-gray-600">{location.notes}</p>

                    <a
                      href={location.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={event => event.stopPropagation()}
                      className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-700"
                    >
                      Verify with {location.sourceLabel}
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <button onClick={onSuggestZone} className="btn-primary">
          Suggest an Anchor Point for Review
        </button>
        <p className="text-center text-xs text-gray-500">
          Suggestions create a research signal only. They do not activate a location.
        </p>
      </div>
    </div>
  );
};
