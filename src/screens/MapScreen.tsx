import React, { useCallback, useMemo, useState } from 'react';
import { BatteryCharging, ExternalLink, MapPin, ShieldCheck, TrainFront } from 'lucide-react';
import { Header } from '../components/Header';
import { CorridorMap } from '../components/CorridorMap';
import { mapLocations, MapLocationKind } from '../data/mapLocations';

interface MapScreenProps {
  onSuggestZone: () => void;
}

type LocationFilter = 'all' | MapLocationKind | 'transit';

export const MapScreen: React.FC<MapScreenProps> = ({ onSuggestZone }) => {
  const [locationFilter, setLocationFilter] = useState<LocationFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filteredLocations = useMemo(
    () => mapLocations.filter(location => {
      if (locationFilter === 'all') return true;
      if (locationFilter === 'transit') return location.type.toLowerCase().includes('transit');
      return location.kind === locationFilter;
    }),
    [locationFilter],
  );

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    document.getElementById(`location-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  return (
    <div className="min-h-screen bg-[var(--color-parchment)] pb-24">
      <Header title="Access Points" subtitle="Transit, public coordination points, and EV infrastructure" />

      <div className="container py-6 space-y-6">
        <section className="card-highlight">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-navy">Corridor layer</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-wide text-navy">See how the commute connects.</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-700">Explore candidate Access Points alongside transit hubs and EV charging infrastructure across Pasadena, Eagle Rock, and Glendale.</p>
        </section>

        <div className="m3-chip-row" aria-label="Map location filters">
          {[
            ['all', 'All locations'],
            ['anchor', 'Access Points'],
            ['transit', 'Transit hubs'],
            ['ev-hub', 'EV hubs'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setLocationFilter(value as LocationFilter);
                setSelectedId(null);
              }}
              className={`activity-chip ${locationFilter === value ? 'is-active' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>

        <CorridorMap locations={filteredLocations} selectedId={selectedId} onSelect={handleSelect} />

        <div className="flex flex-wrap gap-2 text-[10px] font-medium text-gray-600">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-lagoon/20 px-3 py-1.5"><MapPin size={12} /> Candidate Access Point</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-lagoon/20 px-3 py-1.5"><TrainFront size={12} /> Transit location</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-lagoon/20 px-3 py-1.5"><BatteryCharging size={12} /> Verified EV hub</span>
        </div>

        <div className="research-banner">
          <div className="flex items-start gap-3">
            <ShieldCheck size={18} className="mt-0.5 flex-shrink-0 text-iris" />
            <p className="text-xs leading-relaxed text-gray-700">
              <strong>Research Beta:</strong> Public locations and charging infrastructure are source-verified where noted. Access Point suitability is not approved. Partner, site-rule, accessibility, lighting, legal, insurance, and field review are required before any controlled pilot use.
            </p>
          </div>
        </div>

        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="section-title !mb-1">Map locations</h2>
            <p className="text-xs text-gray-500">{filteredLocations.length} shown · verify transit service before travel</p>
          </div>
          <span className="rounded-full border border-lagoon/20 px-3 py-1.5 text-[10px] font-semibold text-navy">OpenStreetMap</span>
        </div>

        <div className="space-y-4">
          {filteredLocations.map(location => {
            const isEvHub = location.kind === 'ev-hub';
            const isTransit = location.type.toLowerCase().includes('transit');
            const isSelected = location.id === selectedId;

            return (
              <article
                id={`location-${location.id}`}
                key={location.id}
                className={`card scroll-mt-24 transition ${isSelected ? 'ring-2 ring-mobility-green' : ''}`}
                onClick={() => setSelectedId(location.id)}
              >
                <div className="flex items-start gap-4">
                  <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full ${isEvHub ? 'bg-light-blue text-iris' : 'bg-light-green text-navy'}`}>
                    {isEvHub ? <BatteryCharging size={21} /> : isTransit ? <TrainFront size={21} /> : <MapPin size={21} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold tracking-wide text-navy">{location.name}</h3>
                        <p className="mt-1 text-xs text-gray-500">{location.type} · {location.city}</p>
                      </div>
                      <span className={`whitespace-nowrap rounded-full border border-lagoon/20 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider ${isEvHub ? 'bg-light-blue text-iris' : 'bg-light-green text-navy'}`}>
                        {isEvHub ? 'EV hub' : isTransit ? 'Transit' : 'Candidate'}
                      </span>
                    </div>

                    <p className="mt-4 text-xs leading-relaxed text-gray-600">{location.address}</p>
                    {location.chargerSummary && <p className="mt-3 rounded-2xl bg-light-blue p-3 text-xs leading-relaxed text-gray-700">{location.chargerSummary}</p>}
                    <p className="mt-3 text-xs leading-relaxed text-gray-600">{location.notes}</p>

                    <a href={location.sourceUrl} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()} className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-iris">
                      Verify with {location.sourceLabel}<ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <button onClick={onSuggestZone} className="btn-primary">Suggest an Access Point for Review</button>
        <p className="text-center text-xs text-gray-500">Suggestions create a research signal only. They do not activate a location.</p>
      </div>
    </div>
  );
};
