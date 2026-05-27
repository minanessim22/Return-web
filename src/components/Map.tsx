'use client';

import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap, useMapEvents } from 'react-leaflet';
import { useEffect, useMemo, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// ── Marker Icons ──────────────────────────────────────────────────

export type MarkerPoint = {
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

// ── MapResizer – invalidates tile layout after container resize ───

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

// ── MapViewport – ONLY pans on the FIRST load ─────────────────────
// The KEY FIX: we track whether the map has been manually interacted
// with by the user. If it has, we never auto-pan again.
// Previously this component called setView() on EVERY re-render which
// is why the map kept jumping back whenever state changed.

function MapViewport({
  center,
  markers,
  zoom,
}: {
  center: [number, number];
  markers: MarkerPoint[];
  zoom: number;
}) {
  const map = useMap();
  const initializedRef = useRef(false);
  const userMovedRef = useRef(false);

  // Detect user interaction (drag / zoom)
  useEffect(() => {
    const onMove = () => { userMovedRef.current = true; };
    map.on('dragstart', onMove);
    map.on('zoomstart', onMove);
    return () => {
      map.off('dragstart', onMove);
      map.off('zoomstart', onMove);
    };
  }, [map]);

  // Only auto-center on very first render OR when a new marker appears
  // and the user hasn't moved the map yet.
  useEffect(() => {
    if (userMovedRef.current) return;

    if (!initializedRef.current) {
      // First ever render
      if (markers.length > 1) {
        const bounds = L.latLngBounds(markers.map((m) => m.position));
        map.fitBounds(bounds.pad(0.18), { animate: false });
      } else {
        map.setView(center, zoom, { animate: false });
      }
      initializedRef.current = true;
      return;
    }

    // After first init: only pan if this is the FIRST marker appearing
    // (markers going from 0 → 1) so the board location is visible.
    if (markers.length === 1) {
      map.setView(markers[0].position, zoom, { animate: true });
    }
  }, [center, map, markers, zoom]);

  return null;
}

// ── MapControls – Zoom +/- / Go-to-Device / Route buttons ────────
// Lives inside MapContainer so it can call useMap() directly.
// Buttons manipulate the Leaflet instance imperatively – zero React
// re-renders on the map canvas.

type MapControlsProps = {
  showControls?: boolean;
  /**
   * The tracked GPS device's last known position.
   * Used by the "go to device" button and as the routing destination.
   */
  deviceCenter?: [number, number];
};

function MapControls({ showControls, deviceCenter }: MapControlsProps) {
  const map = useMap();

  // ── "Go to device" state ────────────────────────────────────────
  const [locating, setLocating]     = useState(false);
  const [locateError, setLocateError] = useState(false);

  // ── Routing state ───────────────────────────────────────────────
  const [routing, setRouting]       = useState(false);   // fetching
  const [routeActive, setRouteActive] = useState(false); // route visible
  const [routeError, setRouteError] = useState(false);
  const [routeInfo, setRouteInfo]   = useState<{ dist: string; mins: string } | null>(null);

  // Route layers stored in a ref – mutated imperatively, no re-render
  const routeLayerRef = useRef<L.LayerGroup | null>(null);

  // Keep deviceCenter fresh without re-renders
  const deviceCenterRef = useRef(deviceCenter);
  useEffect(() => { deviceCenterRef.current = deviceCenter; }, [deviceCenter]);

  // Clean up route layer when component unmounts
  useEffect(() => {
    return () => {
      if (routeLayerRef.current) {
        try { map.removeLayer(routeLayerRef.current); } catch { /* map may be gone */ }
      }
    };
  }, [map]);

  if (!showControls) return null;

  // ── Handlers ─────────────────────────────────────────────────────

  const handleZoomIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    map.zoomIn(1);
  };

  const handleZoomOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    map.zoomOut(1);
  };

  /** Fly to the GPS device's last known position */
  const handleLocate = (e: React.MouseEvent) => {
    e.stopPropagation();
    const pos = deviceCenterRef.current;
    if (!pos) {
      setLocateError(true);
      setTimeout(() => setLocateError(false), 2500);
      return;
    }
    setLocating(true);
    setLocateError(false);
    map.flyTo(pos, Math.max(map.getZoom(), 15), { animate: true, duration: 1.2 });
    setTimeout(() => setLocating(false), 1400);
  };

  /**
   * Routing: get viewer's geolocation → call OSRM → draw route.
   * Second click clears the route (toggle behaviour).
   */
  const handleRoute = (e: React.MouseEvent) => {
    e.stopPropagation();

    // ── Toggle OFF ────────────────────────────────────────────────
    if (routeActive) {
      if (routeLayerRef.current) {
        map.removeLayer(routeLayerRef.current);
        routeLayerRef.current = null;
      }
      setRouteActive(false);
      setRouteInfo(null);
      return;
    }

    const devicePos = deviceCenterRef.current;
    if (!devicePos) {
      setRouteError(true);
      setTimeout(() => setRouteError(false), 2500);
      return;
    }

    setRouting(true);
    setRouteError(false);

    // ── Step 1: get viewer's browser location ──────────────────────
    navigator.geolocation.getCurrentPosition(
      async (geoPos) => {
        const viewerLat = geoPos.coords.latitude;
        const viewerLon = geoPos.coords.longitude;
        const [devLat, devLon] = devicePos;

        try {
          // ── Step 2: fetch route from OSRM (free, no key) ──────────
          // OSRM expects [lon, lat] order
          const osrmUrl =
            `https://router.project-osrm.org/route/v1/driving/` +
            `${viewerLon},${viewerLat};${devLon},${devLat}` +
            `?overview=full&geometries=geojson`;

          const res  = await fetch(osrmUrl);
          const data = await res.json() as {
            code: string;
            routes?: Array<{
              distance: number;
              duration: number;
              geometry: { coordinates: [number, number][] };
            }>;
          };

          if (data.code !== 'Ok' || !data.routes?.[0]) throw new Error('No route found');

          const route = data.routes[0];

          // OSRM returns [lon, lat] – Leaflet wants [lat, lon]
          const polyCoords: [number, number][] = route.geometry.coordinates.map(
            ([lon, lat]) => [lat, lon]
          );

          // ── Step 3: draw the route ─────────────────────────────────
          if (routeLayerRef.current) map.removeLayer(routeLayerRef.current);
          const group = L.layerGroup();

          // Shadow / halo line
          L.polyline(polyCoords, {
            color: '#014CB3',
            weight: 9,
            opacity: 0.18,
          }).addTo(group);

          // Main route line
          L.polyline(polyCoords, {
            color: '#014CB3',
            weight: 4,
            opacity: 0.92,
          }).addTo(group);

          // Animated dashed overlay to indicate direction
          L.polyline(polyCoords, {
            color: '#ffffff',
            weight: 2,
            opacity: 0.55,
            dashArray: '8 12',
          }).addTo(group);

          // Viewer position marker (blue dot)
          const viewerIcon = L.divIcon({
            className: '',
            html: `
              <div style="
                width:16px;height:16px;
                background:#014CB3;
                border:3px solid #fff;
                border-radius:50%;
                box-shadow:0 0 0 3px rgba(1,76,179,0.3),0 2px 8px rgba(0,0,0,0.35);">
              </div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          });
          L.marker([viewerLat, viewerLon], { icon: viewerIcon })
            .bindPopup('<b>📍 موقعك الحالي</b>')
            .addTo(group);

          group.addTo(map);
          routeLayerRef.current = group;

          // ── Step 4: fit map to show full route ────────────────────
          const bounds = L.latLngBounds([
            [viewerLat, viewerLon],
            [devLat,    devLon],
          ]);
          map.fitBounds(bounds.pad(0.15), { animate: true });

          // ── Step 5: show distance / ETA info ──────────────────────
          const km   = (route.distance / 1000).toFixed(1);
          const mins = Math.round(route.duration / 60);
          setRouteInfo({
            dist: `${km} km`,
            mins: mins < 60
              ? `${mins} min`
              : `${Math.floor(mins / 60)}h ${mins % 60}m`,
          });

          setRouteActive(true);
          setRouting(false);

        } catch {
          setRouting(false);
          setRouteError(true);
          setTimeout(() => setRouteError(false), 3000);
        }
      },
      () => {
        // Geolocation denied / timed-out
        setRouting(false);
        setRouteError(true);
        setTimeout(() => setRouteError(false), 3000);
      },
      { timeout: 12000, enableHighAccuracy: true }
    );
  };

  // ── Shared button style helper ───────────────────────────────────
  const btnStyle = (
    bg: string,
    border = '1px solid rgba(0,0,0,0.15)',
    shadow = '0 2px 8px rgba(0,0,0,0.18)'
  ): React.CSSProperties => ({
    width: '36px',
    height: '36px',
    background: bg,
    border,
    borderRadius: '10px',
    boxShadow: shadow,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    fontWeight: 800,
    transition: 'background 0.18s, box-shadow 0.18s, transform 0.1s',
  });

  const onEnter =
    (hoverBg: string, hoverShadow?: string) =>
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.background = hoverBg;
      if (hoverShadow) e.currentTarget.style.boxShadow = hoverShadow;
    };

  const onLeave =
    (restoreBg: string) =>
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.background = restoreBg;
      e.currentTarget.style.boxShadow  = '0 2px 8px rgba(0,0,0,0.18)';
    };

  const onDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = 'scale(0.92)';
  };
  const onUp = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = 'scale(1)';
  };

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div
      className="leaflet-top leaflet-left"
      style={{ pointerEvents: 'auto' }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="leaflet-control"
        style={{
          marginTop: '12px',
          marginLeft: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        {/* ── Zoom In ─────────────────────────────────────────────── */}
        <button
          title="Zoom in"
          onClick={handleZoomIn}
          style={{ ...btnStyle('rgba(255,255,255,0.95)'), fontSize: '20px', color: '#014CB3' }}
          onMouseEnter={onEnter('#014CB3')}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.95)'; e.currentTarget.style.color = '#014CB3'; }}
          onMouseDown={onDown}
          onMouseUp={onUp}
        >
          +
        </button>

        {/* ── Zoom Out ────────────────────────────────────────────── */}
        <button
          title="Zoom out"
          onClick={handleZoomOut}
          style={{ ...btnStyle('rgba(255,255,255,0.95)'), fontSize: '22px', color: '#014CB3' }}
          onMouseEnter={onEnter('#014CB3')}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.95)'; e.currentTarget.style.color = '#014CB3'; }}
          onMouseDown={onDown}
          onMouseUp={onUp}
        >
          −
        </button>

        {/* ── Go to Device ────────────────────────────────────────── */}
        <button
          title={locateError ? 'No device data yet' : locating ? 'Flying…' : 'Go to device'}
          onClick={handleLocate}
          style={btnStyle(
            locateError ? 'rgba(239,68,68,0.88)' : locating ? 'rgba(96,193,15,0.85)' : 'rgba(255,255,255,0.95)',
            locating ? '1px solid rgba(96,193,15,0.6)' : '1px solid rgba(0,0,0,0.15)',
            locating ? '0 0 0 3px rgba(96,193,15,0.25),0 2px 8px rgba(0,0,0,0.18)' : '0 2px 8px rgba(0,0,0,0.18)'
          )}
          onMouseEnter={onEnter('#014CB3', '0 0 0 3px rgba(1,76,179,0.2),0 2px 8px rgba(0,0,0,0.18)')}
          onMouseLeave={onLeave('rgba(255,255,255,0.95)')}
          onMouseDown={onDown}
          onMouseUp={onUp}
        >
          {locating ? '🔄' : locateError ? '✕' : '🎯'}
        </button>

        {/* ── Route ───────────────────────────────────────────────── */}
        <button
          title={
            routeError   ? 'Could not get route'
            : routing    ? 'Getting route…'
            : routeActive? 'Clear route'
            : 'Get directions to device'
          }
          onClick={handleRoute}
          style={btnStyle(
            routeError   ? 'rgba(239,68,68,0.88)'
            : routing    ? 'rgba(96,193,15,0.85)'
            : routeActive? 'rgba(1,76,179,0.92)'
            : 'rgba(255,255,255,0.95)',
            routeActive  ? '1px solid rgba(1,76,179,0.5)'
            : routing    ? '1px solid rgba(96,193,15,0.6)'
            : '1px solid rgba(0,0,0,0.15)',
            routeActive  ? '0 0 0 3px rgba(1,76,179,0.2),0 2px 8px rgba(0,0,0,0.25)'
            : '0 2px 8px rgba(0,0,0,0.18)'
          )}
          onMouseEnter={onEnter(routeActive ? 'rgba(239,68,68,0.88)' : '#60C10F')}
          onMouseLeave={onLeave(
            routeActive ? 'rgba(1,76,179,0.92)' : 'rgba(255,255,255,0.95)'
          )}
          onMouseDown={onDown}
          onMouseUp={onUp}
        >
          {routing ? '⏳' : routeError ? '✕' : routeActive ? '✕' : '🗺️'}
        </button>

        {/* ── Route info badge ─────────────────────────────────────── */}
        {routeInfo && (
          <div
            style={{
              background: 'rgba(1,76,179,0.92)',
              borderRadius: '10px',
              padding: '5px 8px',
              color: '#fff',
              fontSize: '10px',
              fontWeight: 700,
              lineHeight: 1.5,
              boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
              border: '1px solid rgba(255,255,255,0.2)',
              textAlign: 'center',
              minWidth: '36px',
            }}
          >
            <div>{routeInfo.dist}</div>
            <div style={{ color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>{routeInfo.mins}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── AnimatedMarker – smooth position transitions ──────────────────

function AnimatedMarker({ point }: { point: MarkerPoint }) {
  const markerRef = useRef<L.Marker | null>(null);
  const prevPosition = useRef<[number, number]>(point.position);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;

    const [prevLat, prevLng] = prevPosition.current;
    const [newLat, newLng] = point.position;

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
        if (step < steps) requestAnimationFrame(animate);
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
          <div style={{ whiteSpace: 'pre-line', fontSize: '13px', fontWeight: 600 }}>
            {popupContent}
          </div>
        </Popup>
      ) : null}
    </Marker>
  );
}

<<<<<<< HEAD
// ── Map – main exported component ────────────────────────────────

=======
// ── TrailPolyline – breadcrumb path renderer ─────────────────────
// Renders the device's recent movement as a fading polyline.
// The path uses two overlapping lines:
//   1. A wide, very-transparent halo for visibility on light maps
//   2. A thinner opaque-blue line for the actual trail

function TrailPolyline({ trail }: { trail: [number, number][] }) {
  if (trail.length < 2) return null;
  return (
    <>
      {/* Halo — wider, semi-transparent */}
      <Polyline
        positions={trail}
        pathOptions={{
          color: '#014CB3',
          weight: 7,
          opacity: 0.12,
          lineCap: 'round',
          lineJoin: 'round',
        }}
      />
      {/* Core trail line */}
      <Polyline
        positions={trail}
        pathOptions={{
          color: '#014CB3',
          weight: 3,
          opacity: 0.55,
          dashArray: undefined,
          lineCap: 'round',
          lineJoin: 'round',
        }}
      />
      {/* Dashed direction indicator */}
      <Polyline
        positions={trail}
        pathOptions={{
          color: '#60C10F',
          weight: 1.5,
          opacity: 0.40,
          dashArray: '6 10',
          lineCap: 'round',
        }}
      />
    </>
  );
}

// ── Map – main exported component ────────────────────────────────

// ── CircleOverlay – renders geofence circles on the map ──────────

export type CircleOverlay = {
  center: [number, number];
  radiusMeters: number;
  color?: string;
  label?: string;
};

// ── ClickHandler – captures map clicks ───────────────────────────

function ClickHandler({ onClick }: { onClick?: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      if (onClick) onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

>>>>>>> 3d11ff46db27411ede60b95464b4749c9e495782
type Props = {
  center?: [number, number];
  marker?: [number, number];
  markers?: MarkerPoint[];
  zoom?: number;
  /** Enable smooth marker animation for live tracking */
  animate?: boolean;
  /**
   * Show built-in Zoom +/- and device-locate buttons.
   * Defaults to false so existing map usages are unaffected.
   */
  showControls?: boolean;
  /** Allow scroll-wheel zoom (default: false) */
  scrollWheelZoom?: boolean;
  /**
   * The GPS device's last known position.
   * Passed to the locate button so it flies to the device,
   * NOT to the viewer's browser geolocation.
   */
  deviceCenter?: [number, number];
<<<<<<< HEAD
=======
  /**
   * Ordered array of [lat, lon] tuples representing the device's
   * recent movement path. Rendered as a semi-transparent breadcrumb trail.
   */
  trail?: [number, number][];
  /** Callback when the user clicks on the map */
  onMapClick?: (lat: number, lon: number) => void;
  /** Circles to render (e.g. geofence boundaries) */
  circles?: CircleOverlay[];
>>>>>>> 3d11ff46db27411ede60b95464b4749c9e495782
};

export default function Map({
  center = [30.0444, 31.2357],
  marker,
  markers,
  zoom = 13,
  animate = false,
  showControls = false,
  scrollWheelZoom = false,
  deviceCenter,
<<<<<<< HEAD
=======
  trail,
  onMapClick,
  circles,
>>>>>>> 3d11ff46db27411ede60b95464b4749c9e495782
}: Props) {
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
        scrollWheelZoom={scrollWheelZoom}
        style={{ height: '100%', width: '100%' }}
      >
        <MapResizer />
        <MapViewport center={center} markers={effectiveMarkers} zoom={zoom} />
        <MapControls showControls={showControls} deviceCenter={deviceCenter ?? (effectiveMarkers[0]?.position)} />
<<<<<<< HEAD
=======
        {trail && trail.length >= 2 && <TrailPolyline trail={trail} />}
        {onMapClick && <ClickHandler onClick={onMapClick} />}
        {circles && circles.map((c, i) => (
          <Circle
            key={`circle-${i}-${c.center[0]}-${c.center[1]}`}
            center={c.center}
            radius={c.radiusMeters}
            pathOptions={{
              color: c.color || '#014CB3',
              fillColor: c.color || '#014CB3',
              fillOpacity: 0.12,
              weight: 2,
              opacity: 0.6,
              dashArray: '6 4',
            }}
          >
            {c.label && <Popup>{c.label}</Popup>}
          </Circle>
        ))}
>>>>>>> 3d11ff46db27411ede60b95464b4749c9e495782
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
              <Marker
                key={`${item.position[0]}-${item.position[1]}-${index}`}
                position={item.position}
                icon={item.live ? liveMarkerIcon : markerIcon}
              >
                {item.label ? <Popup>{item.label}</Popup> : null}
              </Marker>
            ))}
      </MapContainer>
    </div>
  );
}
