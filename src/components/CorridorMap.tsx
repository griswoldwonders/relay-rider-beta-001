import { useEffect, useRef } from 'react';
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
}

const markerIcon = (location: MapLocation, selected: boolean) =>
  L.divIcon({
    className: '',
    html: `<span class="map-marker map-marker--${location.kind}${selected ? ' map-marker--selected' : ''}" aria-hidden="true">${
      location.kind === 'ev-hub' ? '⚡' : '●'
    }</span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
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
}: CorridorMapProps) {
  const mapElement = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const locationLayer = useRef<L.LayerGroup | null>(null);
  const demandLayer = useRef<L.LayerGroup | null>(null);
  const routeLayer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapElement.current || mapInstance.current) return;

    const map = L.map(mapElement.current, {
      center: [34.14, -118.19],
      zoom: 12,
      zoomControl: true,
      scrollWheelZoom: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

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
    };
  }, []);

  useEffect(() => {
    const map = mapInstance.current;
    const locationsGroup = locationLayer.current;
    const demandGroup = demandLayer.current;
    const routesGroup = routeLayer.current;
    if (!map || !locationsGroup || !demandGroup || !routesGroup) return;

    locationsGroup.clearLayers();
    demandGroup.clearLayers();
    routesGroup.clearLayers();

    const bounds = L.latLngBounds([]);

    plannedRoutes.forEach(route => {
      const featureKey = `planned-route:${route.id}`;
      const selected = selectedFeatureKey === featureKey;
      const line = L.polyline(route.path, {
        color: route.source === 'session' ? '#0b7a5c' : '#176b87',
        weight: selected ? 8 : Math.min(7, 3.5 + route.routeCount * 0.35),
        opacity: selected ? 0.95 : 0.72,
        dashArray: route.source === 'simulated' ? '12 8' : undefined,
      });

      line.bindPopup(buildPopup(
        route.name,
        `${route.routeCount} planned route signal${route.routeCount === 1 ? '' : 's'} · ${route.evCount} EV · ${route.hybridCount} hybrid`,
        `${route.peakWindow} · ${route.source === 'simulated' ? 'Simulated aggregate' : 'Your session signal'}`,
      ));
      line.on('click', () => onSelectFeature('planned-route', route.id));
      line.addTo(routesGroup);
      route.path.forEach(point => bounds.extend(point));

      if (selected) line.openPopup();
    });

    demandZones.forEach(zone => {
      const featureKey = `demand:${zone.id}`;
      const selected = selectedFeatureKey === featureKey;
      const circle = L.circle([zone.lat, zone.lng], {
        radius: Math.max(320, Math.min(900, 250 + zone.commuterCount * 35)),
        color: selected ? '#5434a5' : '#7057b7',
        weight: selected ? 4 : 2,
        fillColor: '#8b75c9',
        fillOpacity: selected ? 0.3 : 0.18,
      });

      circle.bindPopup(buildPopup(
        zone.name,
        `${zone.commuterCount} commute need${zone.commuterCount === 1 ? '' : 's'} · ${zone.peakWindow}`,
        `${zone.accessPointWillingCount} Access Point willing · ${zone.source === 'simulated' ? 'Simulated aggregate' : 'Your session signal'}`,
      ));
      circle.on('click', () => onSelectFeature('demand', zone.id));
      circle.addTo(demandGroup);
      bounds.extend([zone.lat, zone.lng]);

      if (selected) circle.openPopup();
    });

    locations.forEach(location => {
      const featureKey = `location:${location.id}`;
      const selected = selectedFeatureKey === featureKey;
      const marker = L.marker([location.lat, location.lng], {
        icon: markerIcon(location, selected),
        title: location.name,
        keyboard: true,
      });

      marker.bindPopup(buildPopup(
        location.name,
        location.kind === 'ev-hub' ? 'EV charging hub' : location.type,
        location.address,
      ));
      marker.on('click', () => onSelectFeature('location', location.id));
      marker.addTo(locationsGroup);
      bounds.extend([location.lat, location.lng]);

      if (selected) marker.openPopup();
    });

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [28, 28], maxZoom: 14 });
    }
  }, [demandZones, locations, onSelectFeature, plannedRoutes, selectedFeatureKey]);

  return (
    <div
      ref={mapElement}
      className="corridor-map"
      role="region"
      aria-label="Interactive mobility map showing commuter demand, EV and hybrid planned routes, Access Points, transit locations, and EV charging hubs"
    />
  );
}
