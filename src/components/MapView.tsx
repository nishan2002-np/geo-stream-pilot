import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { motion } from 'framer-motion';
import { Device, Position, Alert } from '@/types/tracking';
import DevicePopup from './DevicePopup';
import { Button } from '@/components/ui/button';
import { 
  Layers, 
  MapPin, 
  Satellite, 
  Route,
  ZoomIn,
  ZoomOut,
  Locate
} from 'lucide-react';

// Fix Leaflet default markers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapViewProps {
  devices: Device[];
  positions: Position[];
  selectedDeviceId: number | null;
  onDeviceSelect: (deviceId: number | null) => void;
  alerts: Alert[];
}

type MapStyle = 'dark' | 'light' | 'satellite';

const MAP_STYLES = {
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
};

const MapView: React.FC<MapViewProps> = ({
  devices,
  positions,
  selectedDeviceId,
  onDeviceSelect,
  alerts,
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Map<number, L.Marker>>(new Map());
  const trailsRef = useRef<Map<number, L.Polyline>>(new Map());
  const [mapStyle, setMapStyle] = useState<MapStyle>('dark');
  const [showTrails, setShowTrails] = useState(true);
  const [popupDevice, setPopupDevice] = useState<{ device: Device; position: Position } | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = L.map(mapContainer.current, {
      center: [27.7172, 85.3240], // Kathmandu
      zoom: 13,
      zoomControl: false,
      attributionControl: false,
    });

    // Add tile layer
    L.tileLayer(MAP_STYLES[mapStyle], {
      maxZoom: 18,
      attribution: '© MapView',
    }).addTo(map);

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update map style
  useEffect(() => {
    if (!mapRef.current) return;

    mapRef.current.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        mapRef.current!.removeLayer(layer);
      }
    });

    L.tileLayer(MAP_STYLES[mapStyle], {
      maxZoom: 18,
      attribution: '© MapView',
    }).addTo(mapRef.current);
  }, [mapStyle]);

  // Create and update device markers with smooth animation
  useEffect(() => {
    if (!mapRef.current) return;

    // Update or create markers
    devices.forEach(device => {
      const position = positions.find(p => p.deviceId === device.id);
      if (!position) return;

      const existingMarker = markersRef.current.get(device.id);
      const icon = createDeviceIcon(device, position);
      
      if (existingMarker) {
        // Smooth position update
        const currentLatLng = existingMarker.getLatLng();
        const newLatLng = L.latLng(position.latitude, position.longitude);
        
        // Only update if position changed significantly
        if (currentLatLng.distanceTo(newLatLng) > 1) {
          // Animate marker to new position
          existingMarker.setLatLng(newLatLng);
          existingMarker.setIcon(icon);
        }
      } else {
        // Create new marker
        const marker = L.marker([position.latitude, position.longitude], { icon })
          .addTo(mapRef.current!);

        // Add click handler
        marker.on('click', () => {
          onDeviceSelect(device.id);
          setPopupDevice({ device, position });
        });

        markersRef.current.set(device.id, marker);
      }
    });

    // Remove markers for devices no longer present
    markersRef.current.forEach((marker, deviceId) => {
      if (!devices.find(d => d.id === deviceId)) {
        mapRef.current!.removeLayer(marker);
        markersRef.current.delete(deviceId);
      }
    });

    // Fit bounds only on initial load
    if (devices.length > 0 && positions.length > 0 && markersRef.current.size === devices.length) {
      const bounds = L.latLngBounds(
        positions.map(p => [p.latitude, p.longitude])
      );
      mapRef.current.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [devices, positions, onDeviceSelect]);

  // Update trails
  useEffect(() => {
    if (!mapRef.current || !showTrails) return;

    // Clear existing trails
    trailsRef.current.forEach(trail => {
      mapRef.current!.removeLayer(trail);
    });
    trailsRef.current.clear();

    if (selectedDeviceId) {
      const device = devices.find(d => d.id === selectedDeviceId);
      const devicePositions = positions.filter(p => p.deviceId === selectedDeviceId);
      
      if (device && devicePositions.length > 1) {
        const trail = L.polyline(
          devicePositions.map(p => [p.latitude, p.longitude]),
          {
            color: getStatusColor(device.status),
            weight: 3,
            opacity: 0.8,
          }
        ).addTo(mapRef.current!);

        trailsRef.current.set(selectedDeviceId, trail);
      }
    }
  }, [selectedDeviceId, devices, positions, showTrails]);

  // Center on selected device
  useEffect(() => {
    if (!mapRef.current || !selectedDeviceId) return;

    const position = positions.find(p => p.deviceId === selectedDeviceId);
    if (position) {
      mapRef.current.setView([position.latitude, position.longitude], 16);
    }
  }, [selectedDeviceId, positions]);

  const createDeviceIcon = (device: Device, position: Position) => {
    const statusColor = getStatusColor(device.status);
    const iconSize = selectedDeviceId === device.id ? 36 : 28;
    const isOverspeed = position.speed > 20;
    
    return L.divIcon({
      className: 'custom-marker',
      html: `
        <div class="relative transition-all duration-500 ease-in-out">
          <div class="rounded-full border-2 border-white shadow-lg transition-all duration-300 ${
            selectedDeviceId === device.id ? 'scale-125' : ''
          } ${isOverspeed ? 'animate-pulse-danger' : ''}" 
          style="width: ${iconSize}px; height: ${iconSize}px; background-color: ${statusColor}; display: flex; align-items: center; justify-content: center;">
            <span style="font-size: ${iconSize/2.5}px; filter: drop-shadow(0 1px 1px rgba(0,0,0,0.5));">
              ${getDeviceIcon(device.category || 'car')}
            </span>
          </div>
          ${device.status === 'moving' ? `
            <div class="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary animate-pulse"></div>
          ` : ''}
          ${isOverspeed ? `
            <div class="absolute -top-2 -left-2 w-4 h-4 rounded-full bg-red-500 animate-ping"></div>
          ` : ''}
          <div class="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs font-bold text-white bg-black/70 px-1 rounded" style="text-shadow: 1px 1px 1px rgba(0,0,0,0.8);">
            ${Math.round(position.speed)}
          </div>
        </div>
      `,
      iconSize: [iconSize + 20, iconSize + 20],
      iconAnchor: [(iconSize + 20)/2, (iconSize + 20)/2],
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
      case 'moving':
        return 'hsl(var(--gps-moving))';
      case 'idle':
        return 'hsl(var(--gps-idle))';
      case 'offline':
        return 'hsl(var(--gps-offline))';
      default:
        return 'hsl(var(--muted))';
    }
  };

  const getDeviceIcon = (category: string) => {
    const iconMap: Record<string, string> = {
      car: '🚗',
      truck: '🚛',
      bus: '🚌',
      bike: '🏍️',
      default: '📍',
    };
    return `<span class="text-xs">${iconMap[category] || iconMap.default}</span>`;
  };

  const handleLocateUser = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          mapRef.current?.setView([latitude, longitude], 16);
        },
        (error) => {
          console.error('Geolocation error:', error);
        }
      );
    }
  };

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="absolute inset-0 z-0" />
      
      {/* Map Controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        <motion.div
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="flex flex-col gap-2"
        >
          {/* Style Toggle */}
          <div className="flex gap-1 bg-card/80 backdrop-blur-sm rounded-lg p-1 border border-border/40">
            <Button
              variant={mapStyle === 'dark' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setMapStyle('dark')}
              className="h-8 w-8 p-0"
            >
              <MapPin className="h-4 w-4" />
            </Button>
            <Button
              variant={mapStyle === 'light' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setMapStyle('light')}
              className="h-8 w-8 p-0"
            >
              <Layers className="h-4 w-4" />
            </Button>
            <Button
              variant={mapStyle === 'satellite' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setMapStyle('satellite')}
              className="h-8 w-8 p-0"
            >
              <Satellite className="h-4 w-4" />
            </Button>
          </div>

          {/* Trail Toggle */}
          <Button
            variant={showTrails ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowTrails(!showTrails)}
            className="map-control"
          >
            <Route className="h-4 w-4" />
          </Button>

          {/* Zoom Controls */}
          <div className="flex flex-col gap-1 bg-card/80 backdrop-blur-sm rounded-lg p-1 border border-border/40">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => mapRef.current?.zoomIn()}
              className="h-8 w-8 p-0"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => mapRef.current?.zoomOut()}
              className="h-8 w-8 p-0"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
          </div>

          {/* Locate User */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleLocateUser}
            className="map-control"
          >
            <Locate className="h-4 w-4" />
          </Button>
        </motion.div>
      </div>

      {/* Device Popup */}
      {popupDevice && (
        <div className="absolute top-4 left-4 z-20">
          <DevicePopup
            device={popupDevice.device}
            position={popupDevice.position}
            onClose={() => setPopupDevice(null)}
            onViewDetails={(deviceId) => {
              // Navigate to device page
              window.location.href = `/device/${deviceId}`;
            }}
          />
        </div>
      )}

      {/* Legend */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="absolute bottom-4 left-4 z-10 bg-card/80 backdrop-blur-sm rounded-lg p-3 border border-border/40"
      >
        <h4 className="text-xs font-medium mb-2 text-muted-foreground">Status</h4>
        <div className="flex flex-col gap-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gps-moving"></div>
            <span>Moving ({devices.filter(d => d.status === 'moving').length})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gps-idle"></div>
            <span>Idle ({devices.filter(d => d.status === 'idle').length})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gps-offline"></div>
            <span>Offline ({devices.filter(d => d.status === 'offline').length})</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default MapView;