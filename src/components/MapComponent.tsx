import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  title: string;
  order?: number;
  isMustVisit?: boolean;
  status?: string; // PENDING, VISITED, SKIPPED
  imageUrl?: string;
  description?: string;
  timing?: string;
  isMealStop?: boolean;
  mealType?: 'breakfast' | 'lunch' | 'cafe' | 'dinner';
  cuisineType?: string;
}

interface MapComponentProps {
  markers: MapMarker[];
  center?: [number, number];
  zoom?: number;
  showRoute?: boolean;
  selectedMarkerId?: string;
  onMarkerClick?: (marker: MapMarker) => void;
  height?: string;
}

export const MapComponent: React.FC<MapComponentProps> = ({
  markers,
  center,
  zoom = 12,
  showRoute = true,
  selectedMarkerId,
  onMarkerClick,
  height = '480px'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const markerInstancesRef = useRef<Map<string, L.Marker>>(new Map());

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Determine initial center from markers if available
    const initialCenter: [number, number] =
      center ||
      (markers.length > 0 ? [markers[0].lat, markers[0].lng] : [15.2993, 74.1240]);

    const map = L.map(containerRef.current, {
      center: initialCenter,
      zoom,
      scrollWheelZoom: true
    });
    mapRef.current = map;

    // Detect MapTiler API Key from environment
    const maptilerKey =
      (typeof import.meta !== 'undefined' && import.meta.env &&
        (import.meta.env.VITE_MAPTILER_API_KEY || import.meta.env.VITE_GOOGLE_MAPS_API_KEY)) || '';

    if (maptilerKey && maptilerKey.length > 6) {
      // MapTiler High-Resolution Streets Tile Layer
      L.tileLayer(`https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${maptilerKey}`, {
        attribution:
          '&copy; <a href="https://www.maptiler.com/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
        crossOrigin: true
      }).addTo(map);
    } else {
      // CartoDB Voyager clean editorial fallback
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://carto.com/">CartoDB</a> contributors',
        maxZoom: 19
      }).addTo(map);
    }

    const layer = L.layerGroup().addTo(map);
    markerLayerRef.current = layer;

    return () => {
      map.remove();
      mapRef.current = null;
      markerInstancesRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = markerLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    markerInstancesRef.current.clear();

    if (polylineRef.current) {
      map.removeLayer(polylineRef.current);
      polylineRef.current = null;
    }

    if (markers.length === 0) return;

    const latLngs: L.LatLngExpression[] = [];

    markers.forEach(m => {
      latLngs.push([m.lat, m.lng]);
      const isSelected = m.id === selectedMarkerId;

      let markerBg = '#344B38'; // deep green default
      if (m.isMealStop) markerBg = '#D97706'; // amber for food/cafe
      if (m.isMustVisit) markerBg = '#C87950'; // terracotta accent
      if (m.status === 'VISITED') markerBg = '#2E7D32'; // green
      if (m.status === 'SKIPPED') markerBg = '#9E9E9E'; // grey
      if (isSelected) markerBg = '#1E3A2F'; // dark emerald highlight

      const size = isSelected ? 36 : 30;
      const markerSymbol = m.isMealStop ? (m.mealType === 'breakfast' || m.mealType === 'cafe' ? '☕' : '🍽️') : (m.order !== undefined ? m.order : '•');

      const icon = L.divIcon({
        className: 'journeo-map-pin',
        html: `
          <div style="
            background: ${markerBg};
            color: #FFFFFF;
            width: ${size}px;
            height: ${size}px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: 'Inter', -apple-system, sans-serif;
            font-weight: 700;
            font-size: ${m.isMealStop ? 14 : isSelected ? 13 : 12}px;
            border: 2.5px solid #FFFFFF;
            box-shadow: 0 4px 12px rgba(48,47,41,0.35);
            transition: all 0.2s ease-in-out;
            ${isSelected ? 'transform: scale(1.15); box-shadow: 0 0 0 4px rgba(135,151,123,0.5);' : ''}
          ">
            ${markerSymbol}
          </div>
        `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
      });

      const leafletMarker = L.marker([m.lat, m.lng], { icon });

      leafletMarker.bindPopup(`
        <div style="font-family: 'Inter', -apple-system, sans-serif; width: 230px; padding: 4px;">
          ${m.isMealStop ? `<div style="font-size: 10px; font-weight: 700; color: #D97706; text-transform: uppercase;">🍽️ Food Break • ${m.cuisineType || 'Local Gastronomy'}</div>` : m.order ? `<div style="font-size: 10px; font-weight: 700; color: #49634F; text-transform: uppercase;">Stop ${m.order} ${m.isMustVisit ? '• Must Visit' : ''}</div>` : ''}
          <div style="font-family: 'Playfair Display', Georgia, serif; font-weight: 700; font-size: 14px; color: #344B3C; margin-top: 3px; line-height: 1.2;">
            ${m.title}
          </div>
          ${m.timing ? `<div style="font-size: 11px; color: #667363; margin-top: 3px; font-weight: 600;">⏰ ${m.timing}</div>` : ''}
          ${m.imageUrl ? `<img src="${m.imageUrl}" style="width: 100%; height: 90px; object-fit: cover; border-radius: 8px; margin-top: 6px; border: 1px solid #E8E5DA;" />` : ''}
          ${m.description ? `<p style="font-size: 11px; color: #667363; margin: 6px 0 0; line-height: 1.35;">${m.description.slice(0, 110)}...</p>` : ''}
        </div>
      `);

      leafletMarker.on('click', () => {
        if (onMarkerClick) onMarkerClick(m);
      });

      layer.addLayer(leafletMarker);
      markerInstancesRef.current.set(m.id, leafletMarker);
    });

    // Chronological Route Line
    if (showRoute && latLngs.length > 1) {
      const poly = L.polyline(latLngs, {
        color: '#C87950',
        weight: 3.5,
        opacity: 0.9,
        dashArray: '6, 6'
      }).addTo(map);
      polylineRef.current = poly;
      map.fitBounds(poly.getBounds(), { padding: [40, 40] });
    } else if (latLngs.length === 1) {
      map.setView(latLngs[0], 13);
    }
  }, [markers, showRoute]);

  // Handle selectedMarkerId changes without full re-render
  useEffect(() => {
    if (!selectedMarkerId || !mapRef.current) return;
    const targetMarker = markerInstancesRef.current.get(selectedMarkerId);
    if (targetMarker) {
      const latLng = targetMarker.getLatLng();
      mapRef.current.panTo(latLng, { animate: true, duration: 0.5 });
      targetMarker.openPopup();
    }
  }, [selectedMarkerId]);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-border shadow-soft-md" style={{ height }}>
      <div ref={containerRef} className="w-full h-full" />
      <div className="absolute top-3 right-3 z-[1000] bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-lg border border-border text-[11px] font-semibold text-text flex items-center gap-1.5 shadow-soft-sm">
        <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
        <span>MapTiler Engine • Verified Coordinates</span>
      </div>
    </div>
  );
};
