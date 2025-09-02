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

type MapStyle = 'dark' | 'light' | 'satellite' | 'google' | 'hybrid';

const MAP_STYLES = {
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  google: 'https://mt1.google.com/vt/lyrs=r&x={x}&y={y}&z={z}',
  hybrid: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
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

  // Create device markers with smooth updates
  useEffect(() => {
    if (!mapRef.current) return;

    // Update existing markers or create new ones
    devices.forEach(device => {
      const position = positions.find(p => p.deviceId === device.id);
      if (!position) return;

      const existingMarker = markersRef.current.get(device.id);
      const newLatLng = L.latLng(position.latitude, position.longitude);
      
      if (existingMarker) {
        // Smooth marker movement
        const currentLatLng = existingMarker.getLatLng();
        if (currentLatLng.lat !== newLatLng.lat || currentLatLng.lng !== newLatLng.lng) {
          // Animate marker to new position
          existingMarker.setLatLng(newLatLng);
          
          // Update trail for moving devices
          if (device.status === 'moving' && showTrails) {
            updateDeviceTrail(device.id, newLatLng);
          }
        }
        
        // Update marker icon for status changes
        const newIcon = createDeviceIcon(device, position);
        existingMarker.setIcon(newIcon);
      } else {
        // Create new marker
        const icon = createDeviceIcon(device, position);
        const marker = L.marker([position.latitude, position.longitude], { icon })
          .addTo(mapRef.current!);

        // Add click handler - only show popup, don't set selection
        marker.on('click', () => {
          setPopupDevice({ device, position });
        });

        markersRef.current.set(device.id, marker);
      }
    });

    // Remove markers for devices that no longer exist
    markersRef.current.forEach((marker, deviceId) => {
      if (!devices.find(d => d.id === deviceId)) {
        mapRef.current!.removeLayer(marker);
        markersRef.current.delete(deviceId);
        trailsRef.current.get(deviceId)?.remove();
        trailsRef.current.delete(deviceId);
      }
    });

    // Initial fit bounds only on first load
    if (devices.length > 0 && positions.length > 0 && markersRef.current.size === devices.length) {
      const bounds = L.latLngBounds(
        positions.map(p => [p.latitude, p.longitude])
      );
      if (bounds.isValid()) {
        mapRef.current.fitBounds(bounds, { padding: [20, 20], maxZoom: 15 });
      }
    }
  }, [devices, positions, onDeviceSelect, showTrails]);

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
    
    // Real-time data from API with corrected fuel calculation (260L capacity)
    const odometerKm = position.attributes?.odometer || 0;
    const todayOdometer = position.attributes?.todayOdometer || 0;
    const fuelUsed = Math.floor(todayOdometer / 8); // 8km per 1L based on TODAY'S distance only
    const fuelLevel = Math.max(0, 260 - fuelUsed); // 260L capacity
    const batteryLevel = parseInt(position.attributes?.battery || '100');
    const temperature = Math.round(position.attributes?.temp1 || position.attributes?.temperature || 25);
    const ignition = position.attributes?.ignition ? 'ON' : 'OFF';
    const gsmSignal = parseInt(position.attributes?.gsm || '95');
    
    // Exact status display
    const statusText = device.status === 'moving' ? 'MOVING' : 
                      device.status === 'stopped' ? 'STOPPED' : 
                      device.status === 'offline' ? 'OFFLINE' : 'ONLINE';
    
    return L.divIcon({
      className: 'custom-marker',
      html: `
        <div class="relative">
          <div class="flex flex-col items-center">
            <div class="w-${Math.floor(iconSize/4)} h-${Math.floor(iconSize/4)} rounded-full border-2 border-white shadow-lg transform transition-all duration-300 ${
              selectedDeviceId === device.id ? 'scale-125' : ''
            }" style="background-color: ${statusColor};">
              ${getDeviceIcon(device.category || 'car')}
            </div>
            <div class="mt-1 text-xs bg-black/80 text-white px-1 rounded text-center leading-tight">
              <div>${statusText} • IGN ${ignition}</div>
              <div>⛽${fuelLevel}L 🔋${batteryLevel}%</div>
              <div>🌡️${temperature}°C ${position.protocol?.toLowerCase() === 'meitrack' ? '📶' : '📡'}${gsmSignal}%</div>
            </div>
          </div>
          ${device.status === 'moving' ? `
            <div class="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary animate-pulse-gps"></div>
          ` : ''}
          ${position.attributes?.phoneCall ? `
            <div class="absolute -top-2 -left-2 w-4 h-4 rounded-full bg-yellow-500 flex items-center justify-center text-xs animate-pulse">📞</div>
          ` : ''}
        </div>
      `,
      iconSize: [iconSize + 20, iconSize + 30],
      iconAnchor: [(iconSize + 20)/2, iconSize + 30],
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
      case 'moving':
        return 'hsl(var(--gps-moving))';
      case 'stopped':
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

  // Update device trail for smooth movement
  const updateDeviceTrail = (deviceId: number, newLatLng: L.LatLng) => {
    let trail = trailsRef.current.get(deviceId);
    const device = devices.find(d => d.id === deviceId);
    
    if (!trail && device) {
      // Create new trail
      trail = L.polyline([newLatLng], {
        color: getStatusColor(device.status),
        weight: 3,
        opacity: 0.8,
      }).addTo(mapRef.current!);
      trailsRef.current.set(deviceId, trail);
    } else if (trail) {
      // Add point to existing trail
      const latlngs = trail.getLatLngs() as L.LatLng[];
      latlngs.push(newLatLng);
      
      // Keep only last 50 points to avoid performance issues
      if (latlngs.length > 50) {
        latlngs.shift();
      }
      
      trail.setLatLngs(latlngs);
    }
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
          {/* Single Map Style Toggle */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const styles: MapStyle[] = ['dark', 'google', 'satellite', 'hybrid'];
                const currentIndex = styles.indexOf(mapStyle);
                const nextIndex = (currentIndex + 1) % styles.length;
                setMapStyle(styles[nextIndex]);
              }}
              className="bg-card/80 backdrop-blur-sm border border-border/40 px-3 py-2 h-auto"
            >
              <div className="flex items-center gap-2">
                {mapStyle === 'dark' && <><MapPin className="h-4 w-4" /> <span className="text-xs">OSM</span></>}
                {mapStyle === 'google' && <>🗺️ <span className="text-xs">Google</span></>}
                {mapStyle === 'satellite' && <><Satellite className="h-4 w-4" /> <span className="text-xs">Satellite</span></>}
                {mapStyle === 'hybrid' && <>🛰️ <span className="text-xs">Hybrid</span></>}
              </div>
            </Button>
          </div>

          {/* Trail Toggle */}
          <Button
            variant={showTrails ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowTrails(!showTrails)}
            className="bg-card/80 backdrop-blur-sm border border-border/40"
          >
            <Route className="h-4 w-4" />
          </Button>

          {/* Enhanced Zoom Controls */}
          <div className="flex flex-col gap-1 bg-card/80 backdrop-blur-sm rounded-lg p-2 border border-border/40">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => mapRef.current?.zoomIn()}
              className="h-10 w-10 p-0 hover:bg-primary/20"
            >
              <ZoomIn className="h-5 w-5" />
            </Button>
            <div className="w-full h-px bg-border/40 my-1"></div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => mapRef.current?.zoomOut()}
              className="h-10 w-10 p-0 hover:bg-primary/20"
            >
              <ZoomOut className="h-5 w-5" />
            </Button>
          </div>

          {/* Locate User */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleLocateUser}
            className="bg-card/80 backdrop-blur-sm border border-border/40"
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
    </div>
  );
};

export default MapView;