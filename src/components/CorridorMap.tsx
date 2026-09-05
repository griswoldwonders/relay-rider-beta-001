import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { corridorPath, MapLocation } from '../data/mapLocations';
import { CommuterDemandZone, PlannedRouteBand } from '../data/mapParticipantLayers';

export type MapFeatureKind = 'location' | 'demand' | 'planned-route';

interface CorridorMapProps {
  locations: MapLocation[];
  demandZones: CommuterDemandZone[];
  plannedRoutes: PlannedRouteBand[];
  selectedFeatureKey: string | null;
  onSelectFeature: (kind: MapFeatureKind, id: string) => void;
  onTileLayerReady?: (layer: L.TileLayer) => void;
}

type TrackedFeature =
  | { kind: 'location'; layer: L.Marker; data: MapLocation }
  | { kind: 'demand'; layer: L.Circle; data: CommuterDemandZone }
  | { kind: 'planned-route'; layer: L.Polyline; data: PlannedRouteBand };

const markerGlyph = (location: MapLocation) => {
  if (location.kind === 'ev-hub') return '⚡';
  if (location.kind === 'school') return '🎓';
  return '●';
};

const markerIcon = (location: MapLocation, selected: boolean) =>
  L.divIcon({
    className: '',
    html: `<span class="map-marker map-marker--${location.kind}${selected ? ' map-marker--selected' : ''}" aria-hidden="true">${markerGlyph(location)}</span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });

const demandCircleStyle = (zone: CommuterDemandZone, selected: boolean) => ({
  radius: Math.max(320, Math.min(900, 250 + zone.commuterCount * 35)),
  color: selected ? '#5434a5' : '#7057b7',
  weight: selected ? 4 : 2,
  fillColor: '#8b75c9',
  fillOpacity: selected ? 0.3 : 0.18,
});

const routeLineStyle = (route: PlannedRouteBand, selected: boolean) => ({
  color: route.source === 'session' ? '#0b7a5c' : '#176b87',
  weight: selected ? 8 : Math.min(7, 3.5 + route.routeCount * 0.35),
  opacity: selected ? 0.95 : 0.72,
  dashArray: route.source === 'simulated' ? '12 8' : undefined,
});

function buildPopup(titleText: string, subtitleText: string, detailText?: string) {
  const popup = document.createElement('div');
  popup.className = 'map-popup';

  const title = document.createElement('strong');
  title.textContent = titleText;
  popup.appendChild(title);

  const subtitle = document.createElement('span');
  subtitle.textContent = subtitleText;
  popup.appendChild(subtitle);

  if (detailText) {
    const detail = document.createElement('small');
    detail.textContent = detailText;
    popup.appendChild(detail);
  }

  return popup;
}

export function CorridorMap({
  locations,
  demandZones,
  plannedRoutes,
  selectedFeatureKey,
  onSelectFeature,
  onTileLayerReady,
}: CorridorMapProps) {
  const mapElement = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const locationLayer = useRef<L.LayerGroup | null>(null);
  const demandLayer = useRef<L.LayerGroup | null>(null);
  const routeLayer = useRef<L.LayerGroup | null>(null);
  const trackedFeatures = useRef<Map<string, TrackedFeature>>(new Map());
  const [tileError, setTileError] = useState(false);
  const onSelectFeatureRef = useRef(onSelectFeature);
  onSelectFeatureRef.current = onSelectFeature;

  useEffect(() => {
    if (!mapElement.current || mapInstance.current) return;

    const map = L.map(mapElement.current, {
      center: [34.14, -118.19],
      zoom: 12,
      zoomControl: true,
      scrollWheelZoom: false,
    });

    const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    });
    tiles.on('tileerror', () => setTileError(true));
    onTileLayerReady?.(tiles);
    tiles.addTo(map);

    L.polyline(corridorPath, {
      color: '#18243c',
      weight: 4,
      opacity: 0.45,
      dashArray: '10 9',
      interactive: false,
    }).addTo(map);

    routeLayer.current = L.layerGroup().addTo(map);
    demandLayer.current = L.layerGroup().addTo(map);
    locationLayer.current = L.layerGroup().addTo(map);
    mapInstance.current = map;

    window.setTimeout(() => map.invalidateSize(), 0);

    return () => {
      map.remove();
      mapInstance.current = null;
      locationLayer.current = null;
      demandLayer.current = null;
      routeLayer.current = null;
      trackedFeatures.current.clear();
    };
  }, []);

  // Identity keys (not array references) drive the rebuild effect below, so a
  // parent re-render that recreates an array with the same feature ids never
  // triggers a reframe — only an actual change in which features are visible does.
  const locationsKey = locations.map(location => location.id).join('|');
  const demandZonesKey = demandZones.map(zone => zone.id).join('|');
  const plannedRoutesKey = plannedRoutes.map(route => route.id).join('|');

  // Rebuilds the feature layers and reframes the viewport. Runs only on initial
  // load and when the set of visible features intentionally changes (e.g. a
  // layer-filter switch) — never on selection alone, so selecting a feature
  // never moves the map out from under the user.
  useEffect(() => {
    const map = mapInstance.current;
    const locationsGroup = locationLayer.current;
    const demandGroup = demandLayer.current;
    const routesGroup = routeLayer.current;
    if (!map || !locationsGroup || !demandGroup || !routesGroup) return;

    locationsGroup.clearLayers();
    demandGroup.clearLayers();
    routesGroup.clearLayers();
    trackedFeatures.current.clear();

    const bounds = L.latLngBounds([]);

    plannedRoutes.forEach(route => {
      const featureKey = `planned-route:${route.id}`;
      const line = L.polyline(route.path, routeLineStyle(route, false));

      line.bindPopup(buildPopup(
        route.name,
        `${route.routeCount} planned route signal${route.routeCount === 1 ? '' : 's'} · ${route.evCount} EV · ${route.hybridCount} hybrid`,
        `${route.peakWindow} · ${route.source === 'simulated' ? 'Simulated aggregate' : 'Your session signal'}`,
      ));
      line.on('click', () => onSelectFeatureRef.current('planned-route', route.id));
      line.addTo(routesGroup);
      route.path.forEach(point => bounds.extend(point));
      trackedFeatures.current.set(featureKey, { kind: 'planned-route', layer: line, data: route });
    });

    demandZones.forEach(zone => {
      const featureKey = `demand:${zone.id}`;
      const circle = L.circle([zone.lat, zone.lng], demandCircleStyle(zone, false));

      circle.bindPopup(buildPopup(
        zone.name,
        `${zone.commuterCount} commute need${zone.commuterCount === 1 ? '' : 's'} · ${zone.peakWindow}`,
        `${zone.accessPointWillingCount} Access Point willing · ${zone.source === 'simulated' ? 'Simulated aggregate' : 'Your session signal'}`,
      ));
      circle.on('click', () => onSelectFeatureRef.current('demand', zone.id));
      circle.addTo(demandGroup);
      bounds.extend([zone.lat, zone.lng]);
      trackedFeatures.current.set(featureKey, { kind: 'demand', layer: circle, data: zone });
    });

    locations.forEach(location => {
      const featureKey = `location:${location.id}`;
      const marker = L.marker([location.lat, location.lng], {
        icon: markerIcon(location, false),
        title: location.name,
        keyboard: true,
      });

      marker.bindPopup(buildPopup(
        location.name,
        location.kind === 'ev-hub' ? 'EV charging hub' : location.kind === 'school' ? 'School / campus' : location.type,
        location.address,
      ));
      marker.on('click', () => onSelectFeatureRef.current('location', location.id));
      marker.addTo(locationsGroup);
      bounds.extend([location.lat, location.lng]);
      trackedFeatures.current.set(featureKey, { kind: 'location', layer: marker, data: location });
    });

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [28, 28], maxZoom: 14 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demandZonesKey, locationsKey, plannedRoutesKey]);

  // Restyles/opens the popup for the selected feature without rebuilding
  // layers or reframing the viewport.
  useEffect(() => {
    trackedFeatures.current.forEach((feature, featureKey) => {
      const selected = selectedFeatureKey === featureKey;

      if (feature.kind === 'location') {
        feature.layer.setIcon(markerIcon(feature.data, selected));
      } else if (feature.kind === 'demand') {
        feature.layer.setStyle(demandCircleStyle(feature.data, selected));
      } else {
        feature.layer.setStyle(routeLineStyle(feature.data, selected));
      }

      if (selected) feature.layer.openPopup();
    });
  }, [selectedFeatureKey]);

  return (
    <div className="corridor-map-wrapper">
      <div
        ref={mapElement}
        className="corridor-map"
        role="region"
        aria-label="Interactive mobility map showing commuter demand, EV and hybrid planned routes, Access Points, transit locations, and EV charging hubs"
      />
      {tileError && (
        <p role="status" className="corridor-map-tile-error">
          Map tiles are temporarily unavailable. The map background may look incomplete or blank, but commute needs,
          planned routes, and locations are still listed below and remain fully usable.
        </p>
      )}
    </div>
  );
}
