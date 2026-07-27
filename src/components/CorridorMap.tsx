import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { corridorPath, MapLocation } from '../data/mapLocations';

interface CorridorMapProps {
  locations: MapLocation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
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

export function CorridorMap({ locations, selectedId, onSelect }: CorridorMapProps) {
  const mapElement = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markerLayer = useRef<L.LayerGroup | null>(null);

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
      weight: 5,
      opacity: 0.72,
      dashArray: '10 9',
    }).addTo(map);

    markerLayer.current = L.layerGroup().addTo(map);
    mapInstance.current = map;

    window.setTimeout(() => map.invalidateSize(), 0);

    return () => {
      map.remove();
      mapInstance.current = null;
      markerLayer.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstance.current;
    const layer = markerLayer.current;
    if (!map || !layer) return;

    layer.clearLayers();

    const bounds = L.latLngBounds([]);
    locations.forEach(location => {
      const marker = L.marker([location.lat, location.lng], {
        icon: markerIcon(location, location.id === selectedId),
        title: location.name,
        keyboard: true,
      });

      const popup = document.createElement('div');
      popup.className = 'map-popup';

      const title = document.createElement('strong');
      title.textContent = location.name;
      popup.appendChild(title);

      const type = document.createElement('span');
      type.textContent = location.kind === 'ev-hub' ? 'EV charging hub' : 'Candidate Anchor Point';
      popup.appendChild(type);

      const address = document.createElement('small');
      address.textContent = location.address;
      popup.appendChild(address);

      marker.bindPopup(popup);
      marker.on('click', () => onSelect(location.id));
      marker.addTo(layer);
      bounds.extend([location.lat, location.lng]);

      if (location.id === selectedId) marker.openPopup();
    });

    if (locations.length > 0) {
      map.fitBounds(bounds, { padding: [28, 28], maxZoom: 14 });
    }
  }, [locations, onSelect, selectedId]);

  return (
    <div
      ref={mapElement}
      className="corridor-map"
      role="region"
      aria-label="Interactive map of candidate Anchor Points and verified EV charging hubs"
    />
  );
}
