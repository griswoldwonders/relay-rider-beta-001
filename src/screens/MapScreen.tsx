import React, { useCallback, useMemo, useState } from 'react';
import {
  BatteryCharging,
  ExternalLink,
  Layers3,
  MapPin,
  Route,
  ShieldCheck,
  TrainFront,
  Users,
  X,
} from 'lucide-react';
import { Header } from '../components/Header';
import { CorridorMap, MapFeatureKind } from '../components/CorridorMap';
import { useApp } from '../context/AppContext';
import { mapLocations } from '../data/mapLocations';
import {
  sessionDemandZones,
  sessionPlannedRoutes,
  simulatedCommuterDemand,
  simulatedPlannedRoutes,
} from '../data/mapParticipantLayers';

interface MapScreenProps {
  onSuggestZone: () => void;
}

type LayerFilter = 'all' | 'demand' | 'planned-route' | 'anchor' | 'transit' | 'ev-hub';

type SelectedFeature = {
  kind: MapFeatureKind;
  id: string;
} | null;

const layerOptions: Array<{ value: LayerFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'demand', label: 'Commuters' },
  { value: 'planned-route', label: 'EV routes' },
  { value: 'anchor', label: 'Access Points' },
  { value: 'transit', label: 'Transit' },
  { value: 'ev-hub', label: 'Charging' },
];

export const MapScreen: React.FC<MapScreenProps> = ({ onSuggestZone }) => {
  const { routeSignals, evParticipantSignals } = useApp();
  const [layerFilter, setLayerFilter] = useState<LayerFilter>('all');
  const [selectedFeature, setSelectedFeature] = useState<SelectedFeature>(null);

  const demandZones = useMemo(
    () => [...simulatedCommuterDemand, ...sessionDemandZones(routeSignals)],
    [routeSignals],
  );

  const plannedRoutes = useMemo(
    () => [...simulatedPlannedRoutes, ...sessionPlannedRoutes(evParticipantSignals)],
    [evParticipantSignals],
  );

  const filteredLocations = useMemo(() => {
    if (layerFilter === 'all') return mapLocations;
    if (layerFilter === 'anchor') {
      return mapLocations.filter(location => location.kind === 'anchor' && !location.type.toLowerCase().includes('transit'));
    }
    if (layerFilter === 'transit') {
      return mapLocations.filter(location => location.type.toLowerCase().includes('transit'));
    }
    if (layerFilter === 'ev-hub') {
      return mapLocations.filter(location => location.kind === 'ev-hub');
    }
    return [];
  }, [layerFilter]);

  const visibleDemandZones = layerFilter === 'all' || layerFilter === 'demand' ? demandZones : [];
  const visiblePlannedRoutes = layerFilter === 'all' || layerFilter === 'planned-route' ? plannedRoutes : [];

  const selectedFeatureKey = selectedFeature ? `${selectedFeature.kind}:${selectedFeature.id}` : null;

  const handleSelectFeature = useCallback((kind: MapFeatureKind, id: string) => {
    setSelectedFeature({ kind, id });
  }, []);

  const selectedLocation = selectedFeature?.kind === 'location'
    ? mapLocations.find(location => location.id === selectedFeature.id)
    : undefined;

  const selectedDemand = selectedFeature?.kind === 'demand'
    ? demandZones.find(zone => zone.id === selectedFeature.id)
    : undefined;

  const selectedRoute = selectedFeature?.kind === 'planned-route'
    ? plannedRoutes.find(route => route.id === selectedFeature.id)
    : undefined;

  const totalCommuterNeeds = demandZones.reduce((sum, zone) => sum + zone.commuterCount, 0);
  const totalPlannedRoutes = plannedRoutes.reduce((sum, route) => sum + route.routeCount, 0);
  const chargingCount = mapLocations.filter(location => location.kind === 'ev-hub').length;
  const transitCount = mapLocations.filter(location => location.type.toLowerCase().includes('transit')).length;

  const showInfrastructureList = filteredLocations.length > 0 && layerFilter !== 'demand' && layerFilter !== 'planned-route';

  return (
    <div className="min-h-screen bg-[var(--color-parchment)] pb-24">
      <Header title="Mobility Map" subtitle="Demand, planned EV routes, Access Points, transit, and charging" />

      <div className="container py-6 space-y-6">
        <section className="card-highlight">
          <div className="flex items-start gap-3">
            <Layers3 size={20} className="mt-0.5 flex-shrink-0 text-iris" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-navy">Pasadena ↔ Eagle Rock ↔ Glendale</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-wide text-navy">See where commuter demand meets clean-route supply.</h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-700">
                Compare generalized commuter-demand signals, EV/hybrid planned routes, candidate Access Points, transit locations, and verified charging infrastructure in one corridor view.
              </p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3" aria-label="Mobility map summary">
          <div className="card p-4">
            <div className="flex items-center gap-2 text-iris"><Users size={16} /><span className="text-xs font-semibold uppercase tracking-wider">Commute needs</span></div>
            <p className="mt-2 text-2xl font-semibold text-navy">{totalCommuterNeeds}</p>
            <p className="mt-1 text-[10px] leading-relaxed text-gray-500">Simulated corridor aggregate + your current session signals</p>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 text-lagoon"><Route size={16} /><span className="text-xs font-semibold uppercase tracking-wider">Planned routes</span></div>
            <p className="mt-2 text-2xl font-semibold text-navy">{totalPlannedRoutes}</p>
            <p className="mt-1 text-[10px] leading-relaxed text-gray-500">EV/hybrid route-interest signals, not operating routes</p>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 text-navy"><TrainFront size={16} /><span className="text-xs font-semibold uppercase tracking-wider">Transit points</span></div>
            <p className="mt-2 text-2xl font-semibold text-navy">{transitCount}</p>
            <p className="mt-1 text-[10px] leading-relaxed text-gray-500">Current source-verified prototype locations</p>
          </div>
          <div className="card p-4">
            <div className="flex items-center gap-2 text-iris"><BatteryCharging size={16} /><span className="text-xs font-semibold uppercase tracking-wider">EV hubs</span></div>
            <p className="mt-2 text-2xl font-semibold text-navy">{chargingCount}</p>
            <p className="mt-1 text-[10px] leading-relaxed text-gray-500">Charging infrastructure; live availability can change</p>
          </div>
        </section>

        <div className="m3-chip-row" aria-label="Mobility map layer filters">
          {layerOptions.map(option => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setLayerFilter(option.value);
                setSelectedFeature(null);
              }}
              className={`activity-chip ${layerFilter === option.value ? 'is-active' : ''}`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <CorridorMap
          locations={filteredLocations}
          demandZones={visibleDemandZones}
          plannedRoutes={visiblePlannedRoutes}
          selectedFeatureKey={selectedFeatureKey}
          onSelectFeature={handleSelectFeature}
        />

        <div className="flex flex-wrap gap-2 text-[10px] font-medium text-gray-600" aria-label="Map legend">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 px-3 py-1.5"><Users size={12} /> Generalized demand</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-lagoon/20 px-3 py-1.5"><Route size={12} /> EV/hybrid planned route</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-lagoon/20 px-3 py-1.5"><MapPin size={12} /> Candidate Access Point</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-lagoon/20 px-3 py-1.5"><TrainFront size={12} /> Transit</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-lagoon/20 px-3 py-1.5"><BatteryCharging size={12} /> EV charging</span>
        </div>

        <div className="research-banner">
          <div className="flex items-start gap-3">
            <ShieldCheck size={18} className="mt-0.5 flex-shrink-0 text-iris" />
            <p className="text-xs leading-relaxed text-gray-700">
              <strong>Research Beta:</strong> Commuter-demand and planned-route corridor layers include simulated aggregate data for demonstration. Your own session submissions may be added as generalized signals when their area can be resolved. Public locations and charging infrastructure are source-verified where noted. No layer represents live participant tracking, guaranteed route availability, or an approved Access Point.
            </p>
          </div>
        </div>

        {layerFilter === 'demand' && (
          <section className="space-y-3">
            <div>
              <h2 className="section-title !mb-1">Commuter demand zones</h2>
              <p className="text-xs text-gray-500">Tap a zone to inspect the generalized research signal.</p>
            </div>
            {visibleDemandZones.map(zone => (
              <button
                key={zone.id}
                type="button"
                onClick={() => handleSelectFeature('demand', zone.id)}
                className="card w-full text-left"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-navy">{zone.name}</h3>
                    <p className="mt-1 text-xs text-gray-500">{zone.peakWindow} · {zone.parkingPressure} parking pressure</p>
                  </div>
                  <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">{zone.commuterCount}</span>
                </div>
              </button>
            ))}
          </section>
        )}

        {layerFilter === 'planned-route' && (
          <section className="space-y-3">
            <div>
              <h2 className="section-title !mb-1">EV/hybrid planned-route bands</h2>
              <p className="text-xs text-gray-500">These represent routes participants already intend to travel, not dispatch availability.</p>
            </div>
            {visiblePlannedRoutes.map(route => (
              <button
                key={route.id}
                type="button"
                onClick={() => handleSelectFeature('planned-route', route.id)}
                className="card w-full text-left"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-navy">{route.name}</h3>
                    <p className="mt-1 text-xs text-gray-500">{route.peakWindow} · {route.evCount} EV · {route.hybridCount} hybrid</p>
                  </div>
                  <span className="rounded-full bg-light-green px-3 py-1 text-xs font-semibold text-navy">{route.routeCount}</span>
                </div>
              </button>
            ))}
          </section>
        )}

        {showInfrastructureList && (
          <section className="space-y-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="section-title !mb-1">Infrastructure in view</h2>
                <p className="text-xs text-gray-500">{filteredLocations.length} shown · verify transit service and charger status before travel</p>
              </div>
              <span className="rounded-full border border-lagoon/20 px-3 py-1.5 text-[10px] font-semibold text-navy">OpenStreetMap</span>
            </div>

            <div className="space-y-4">
              {filteredLocations.map(location => {
                const isEvHub = location.kind === 'ev-hub';
                const isTransit = location.type.toLowerCase().includes('transit');
                const isSelected = selectedFeature?.kind === 'location' && selectedFeature.id === location.id;

                return (
                  <article
                    id={`location-${location.id}`}
                    key={location.id}
                    className={`card scroll-mt-24 transition ${isSelected ? 'ring-2 ring-mobility-green' : ''}`}
                    onClick={() => handleSelectFeature('location', location.id)}
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
          </section>
        )}

        <button onClick={onSuggestZone} className="btn-primary">Suggest an Access Point for Review</button>
        <p className="text-center text-xs text-gray-500">Suggestions create a research signal only. They do not activate or approve a location.</p>
      </div>

      {(selectedLocation || selectedDemand || selectedRoute) && (
        <aside
          className="fixed inset-x-3 bottom-20 z-[1100] mx-auto max-w-md rounded-[28px] border border-black/10 bg-white p-5 shadow-2xl"
          aria-label="Selected map feature details"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                {selectedDemand ? 'Commuter demand signal' : selectedRoute ? 'Planned-route signal' : selectedLocation?.kind === 'ev-hub' ? 'EV charging infrastructure' : 'Infrastructure / Access Point'}
              </p>
              <h3 className="mt-1 text-lg font-semibold text-navy">
                {selectedDemand?.name ?? selectedRoute?.name ?? selectedLocation?.name}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setSelectedFeature(null)}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600"
              aria-label="Close map details"
            >
              <X size={18} />
            </button>
          </div>

          {selectedDemand && (
            <div className="mt-4 space-y-3 text-xs text-gray-700">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-violet-50 p-3"><strong className="block text-base text-violet-800">{selectedDemand.commuterCount}</strong> commute needs</div>
                <div className="rounded-2xl bg-light-green p-3"><strong className="block text-base text-navy">{selectedDemand.accessPointWillingCount}</strong> Access Point willing</div>
                <div className="rounded-2xl bg-light-blue p-3"><strong className="block text-base text-iris">{selectedDemand.evHybridPreferenceCount}</strong> EV/hybrid preference</div>
              </div>
              <p><strong>Peak window:</strong> {selectedDemand.peakWindow}</p>
              <p><strong>Parking pressure:</strong> {selectedDemand.parkingPressure}</p>
              <p><strong>Common destinations:</strong> {selectedDemand.topDestinations.join(', ')}</p>
              <p className="rounded-2xl bg-gray-50 p-3 text-[11px] leading-relaxed text-gray-600">
                {selectedDemand.source === 'simulated' ? 'Simulated aggregate for the research-beta demonstration.' : 'Generalized from your current session submission; no precise address is shown.'}
              </p>
            </div>
          )}

          {selectedRoute && (
            <div className="mt-4 space-y-3 text-xs text-gray-700">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-light-green p-3"><strong className="block text-base text-navy">{selectedRoute.routeCount}</strong> route signals</div>
                <div className="rounded-2xl bg-light-blue p-3"><strong className="block text-base text-iris">{selectedRoute.evCount}</strong> EV</div>
                <div className="rounded-2xl bg-gray-50 p-3"><strong className="block text-base text-navy">{selectedRoute.hybridCount}</strong> hybrid</div>
              </div>
              <p><strong>Common window:</strong> {selectedRoute.peakWindow}</p>
              <p><strong>Detour context:</strong> {selectedRoute.detourLabel}</p>
              <p><strong>Candidate Access Point links:</strong> {selectedRoute.accessPointCandidateCount}</p>
              <p><strong>Capacity:</strong> {selectedRoute.capacityLabel}</p>
              <p className="rounded-2xl bg-gray-50 p-3 text-[11px] leading-relaxed text-gray-600">
                {selectedRoute.source === 'simulated' ? 'Simulated aggregate route-interest layer. It does not represent an operating route.' : 'This is your generalized session route. It is not activated or guaranteed to operate.'}
              </p>
            </div>
          )}

          {selectedLocation && (
            <div className="mt-4 space-y-3 text-xs text-gray-700">
              <p>{selectedLocation.type} · {selectedLocation.city}</p>
              <p>{selectedLocation.address}</p>
              {selectedLocation.chargerSummary && <p className="rounded-2xl bg-light-blue p-3">{selectedLocation.chargerSummary}</p>}
              <p>{selectedLocation.notes}</p>
              <a href={selectedLocation.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-iris">
                Verify with {selectedLocation.sourceLabel}<ExternalLink size={12} />
              </a>
            </div>
          )}
        </aside>
      )}
    </div>
  );
};
