'use client';

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useEffect, useMemo, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

type MarkerPoint = {
  position: [number, number];
  label?: string;
  /** Optional: battery level 0-100 */
  battery?: number;
  /** Optional: last seen ISO timestamp */
  lastSeen?: string;
  /** Optional: true if this marker is receiving live updates */
  live?: boolean;
};

const markerIcon = L.divIcon({
  className: 'return-map-marker-wrapper',
  html: '<span class="return-map-marker-pin"></span>',
  iconSize: [26, 26],
  iconAnchor: [13, 26],
  popupAnchor: [0, -24]
});

const liveMarkerIcon = L.divIcon({
  className: 'return-map-marker-wrapper',
  html: '<span class="return-map-marker-pin return-map-marker-live"></span>',
  iconSize: [26, 26],
  iconAnchor: [13, 26],
  popupAnchor: [0, -24]
});

function MapResizer() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

function MapViewport({ center, markers, zoom }: { center: [number, number]; markers: MarkerPoint[]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (markers.length > 1) {
      const bounds = L.latLngBounds(markers.map((item) => item.position));
      map.fitBounds(bounds.pad(0.18), { animate: false });
      return;
    }
    map.setView(center, zoom, { animate: false });
  }, [center, map, markers, zoom]);
  return null;
}

/** Smoothly animate a marker to a new position */
function AnimatedMarker({ point }: { point: MarkerPoint }) {
  const markerRef = useRef<L.Marker | null>(null);
  const prevPosition = useRef<[number, number]>(point.position);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;

    const [prevLat, prevLng] = prevPosition.current;
    const [newLat, newLng] = point.position;

    // Only animate if position actually changed
    if (prevLat !== newLat || prevLng !== newLng) {
      const steps = 30;
      const dLat = (newLat - prevLat) / steps;
      const dLng = (newLng - prevLng) / steps;
      let step = 0;

      const animate = () => {
        step++;
        const lat = prevLat + dLat * step;
        const lng = prevLng + dLng * step;
        marker.setLatLng([lat, lng]);
        if (step < steps) {
          requestAnimationFrame(animate);
        }
      };

      requestAnimationFrame(animate);
      prevPosition.current = point.position;
    }
  }, [point.position]);

  const icon = point.live ? liveMarkerIcon : markerIcon;

  const popupContent = [
    point.label,
    point.battery !== undefined ? `🔋 ${point.battery}%` : null,
    point.lastSeen ? `📡 ${new Date(point.lastSeen).toLocaleTimeString()}` : null,
    point.live ? '🟢 Live' : null,
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <Marker ref={markerRef} position={point.position} icon={icon}>
      {popupContent ? (
        <Popup>
          <div style={{ whiteSpace: 'pre-line', fontSize: '13px', fontWeight: 600 }}>{popupContent}</div>
        </Popup>
      ) : null}
    </Marker>
  );
}

type Props = {
  center?: [number, number];
  marker?: [number, number];
  markers?: MarkerPoint[];
  zoom?: number;
  /** Enable smooth marker animation for live tracking */
  animate?: boolean;
};

export default function Map({ center = [30.0444, 31.2357], marker, markers, zoom = 13, animate = false }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const effectiveMarkers = useMemo(() => {
    if (markers && markers.length > 0) return markers;
    const markerPos = marker || center;
    return [{ position: markerPos }];
  }, [center, marker, markers]);

  if (!mounted) {
    return <div className="h-full w-full bg-gray-100" />;
  }

  return (
    <div className="relative h-full w-full">
      <style jsx global>{`
        .return-map-marker-wrapper {
          background: transparent;
          border: 0;
        }
        .return-map-marker-pin {
          position: relative;
          display: block;
          width: 22px;
          height: 22px;
          border-radius: 9999px 9999px 9999px 0;
          background: #014cb3;
          border: 3px solid #ffffff;
          box-shadow: 0 8px 18px rgba(1, 76, 179, 0.35);
          transform: rotate(-45deg);
        }
        .return-map-marker-pin::after {
          content: '';
          position: absolute;
          width: 8px;
          height: 8px;
          border-radius: 9999px;
          background: #60c10f;
          top: 7px;
          left: 7px;
        }
        .return-map-marker-live {
          background: #60c10f;
          border-color: #ffffff;
          box-shadow: 0 0 0 4px rgba(96, 193, 15, 0.3), 0 8px 18px rgba(96, 193, 15, 0.35);
          animation: return-marker-pulse 2s ease-in-out infinite;
        }
        .return-map-marker-live::after {
          background: #ffffff;
        }
        @keyframes return-marker-pulse {
          0%, 100% { box-shadow: 0 0 0 4px rgba(96, 193, 15, 0.3), 0 8px 18px rgba(96, 193, 15, 0.35); }
          50%       { box-shadow: 0 0 0 10px rgba(96, 193, 15, 0.1), 0 8px 18px rgba(96, 193, 15, 0.5); }
        }
      `}</style>
      <MapContainer
        center={center}
        zoom={zoom}
        zoomControl={false}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        <MapResizer />
        <MapViewport center={center} markers={effectiveMarkers} zoom={zoom} />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        {animate
          ? effectiveMarkers.map((item, index) => (
              <AnimatedMarker
                key={`anim-${item.label || index}-${item.position[0]}-${item.position[1]}`}
                point={item}
              />
            ))
          : effectiveMarkers.map((item, index) => (
              <Marker key={`${item.position[0]}-${item.position[1]}-${index}`} position={item.position} icon={item.live ? liveMarkerIcon : markerIcon}>
                {item.label ? <Popup>{item.label}</Popup> : null}
              </Marker>
            ))}
      </MapContainer>
    </div>
  );
}

export type { MarkerPoint };
