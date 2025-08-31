import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import MapView from '@/components/MapView';
import DeviceList from '@/components/DeviceList';
import AlertsPanel from '@/components/AlertsPanel';
import TelemetryPanel from '@/components/TelemetryPanel';
import MeitrackEventAlert from '@/components/MeitrackEventAlert';
import { Alert } from '@/types/tracking';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  Settings, 
  Map as MapIcon, 
  Navigation, 
  Activity,
  Zap,
  AlertTriangle
} from 'lucide-react';
import traccarApi from '@/utils/traccarApi';
import { Device, Position } from '@/types/tracking';

const Dashboard = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [devicesData, positionsData] = await Promise.all([
          traccarApi.getDevices(),
          traccarApi.getPositions(),
        ]);
        
        setDevices(devicesData);
        setPositions(positionsData);
        
        // Generate real alerts only based on actual conditions
        const generateRealAlerts = (devices: Device[], positions: Position[]): Alert[] => {
          const alerts: Alert[] = [];
          
          devices.forEach(device => {
            const position = positions.find(p => p.deviceId === device.id);
            if (!position) return;
            
            // Real overspeed alert
            if (position.speed > 60) {
              alerts.push({
                id: `speed-${device.id}`,
                type: 'overspeed',
                deviceId: device.id,
                deviceName: device.name,
                severity: 'high',
                message: `Vehicle exceeding speed limit (${Math.round(position.speed)} km/h)`,
                timestamp: position.deviceTime,
                latitude: position.latitude,
                longitude: position.longitude,
                acknowledged: false,
                attributes: { speed: Math.round(position.speed), speedLimit: 60 }
              });
            }
            
            // Real low fuel alert
            if (parseInt(position.attributes?.fuel || '100') < 20) {
              alerts.push({
                id: `fuel-${device.id}`,
                type: 'fuel',
                deviceId: device.id,
                deviceName: device.name,
                severity: 'medium',
                message: `Low fuel level: ${position.attributes?.fuel}%`,
                timestamp: position.deviceTime,
                acknowledged: false,
                attributes: { fuelLevel: parseInt(position.attributes?.fuel || '0') }
              });
            }
            
            // Real battery alert
            if (parseInt(position.attributes?.battery || '100') < 30) {
              alerts.push({
                id: `battery-${device.id}`,
                type: 'battery',
                deviceId: device.id,
                deviceName: device.name,
                severity: 'medium',
                message: `Low battery: ${position.attributes?.battery}%`,
                timestamp: position.deviceTime,
                acknowledged: false,
                attributes: { batteryLevel: parseInt(position.attributes?.battery || '0') }
              });
            }
            
            // Real offline alert
            if (device.status === 'offline') {
              alerts.push({
                id: `offline-${device.id}`,
                type: 'network',
                deviceId: device.id,
                deviceName: device.name,
                severity: 'high',
                message: 'Device is offline - No communication',
                timestamp: device.lastUpdate,
                acknowledged: false,
                attributes: { status: 'offline' }
              });
            }
            
            // Real temperature alert
            const temp = position.attributes?.temp1;
            if (temp && temp > 50) {
              alerts.push({
                id: `temp-${device.id}`,
                type: 'maintenance',
                deviceId: device.id,
                deviceName: device.name,
                severity: 'medium',
                message: `High temperature detected: ${Math.round(temp)}°C`,
                timestamp: position.deviceTime,
                acknowledged: false,
                attributes: { temperature: Math.round(temp) }
              });
            }
            
            // Real phone call alert
            if (position.attributes?.phoneCall) {
              alerts.push({
                id: `phone-${device.id}`,
                type: 'communication',
                deviceId: device.id,
                deviceName: device.name,
                severity: 'low',
                message: 'Driver on phone call',
                timestamp: position.deviceTime,
                acknowledged: false,
                attributes: { phoneCall: true }
              });
            }
          });
          
          return alerts;
        };
        
        setAlerts(generateRealAlerts(devicesData, positionsData));
        
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // Setup WebSocket connection for real-time updates
    traccarApi.connectWebSocket((data) => {
      if (data.devices) setDevices(data.devices);
      if (data.positions) setPositions(data.positions);
    });

    return () => {
      traccarApi.disconnectWebSocket();
    };
  }, []);

  const selectedDevice = selectedDeviceId 
    ? devices.find(d => d.id === selectedDeviceId)
    : null;

  const selectedPosition = selectedDevice?.positionId
    ? positions.find(p => p.id === selectedDevice.positionId)
    : null;

  const onlineDevices = devices.filter(d => d.status !== 'offline').length;
  const movingDevices = devices.filter(d => d.status === 'moving').length;
  const stoppedDevices = devices.filter(d => d.status === 'stopped').length;
  const offlineDevices = devices.filter(d => d.status === 'offline').length;

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <motion.header 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="border-b border-border/40 bg-card/50 backdrop-blur-lg"
      >
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Navigation className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                GPS Tracker Pro
              </h1>
            </div>
            
            <div className="hidden md:flex items-center gap-4 text-sm">
              <Badge variant="outline" className="badge-online">
                <Activity className="h-3 w-3 mr-1" />
                {onlineDevices} Online
              </Badge>
              <Badge variant="outline" className="badge-moving">
                <Zap className="h-3 w-3 mr-1" />
                {movingDevices} Moving
              </Badge>
              <Badge variant="outline" className="badge-idle">
                {stoppedDevices} Stopped
              </Badge>
              <Badge variant="outline" className="badge-offline">
                {offlineDevices} Offline
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search devices..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-64 bg-background/50"
              />
            </div>
            
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Device List */}
        <motion.aside
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className={`${
            sidebarCollapsed ? 'w-16' : 'w-80'
          } transition-all duration-300 border-r border-border/40 bg-sidebar backdrop-blur-lg`}
        >
          <DeviceList
            devices={devices}
            positions={positions}
            selectedDeviceId={selectedDeviceId}
            onDeviceSelect={setSelectedDeviceId}
            searchQuery={searchQuery}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            loading={loading}
          />
        </motion.aside>

        {/* Center - Map */}
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex-1 relative"
        >
          <MapView
            devices={devices}
            positions={positions}
            selectedDeviceId={selectedDeviceId}
            onDeviceSelect={setSelectedDeviceId}
            alerts={alerts}
          />
        </motion.div>

        {/* Right Sidebar - Alerts */}
        <motion.aside
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="w-80 border-l border-border/40 bg-sidebar backdrop-blur-lg"
        >
          <AlertsPanel
            alerts={alerts}
            onAcknowledge={(alertId) => {
              setAlerts(prev => prev.map(alert => 
                alert.id === alertId 
                  ? { ...alert, acknowledged: true }
                  : alert
              ));
            }}
            onViewDevice={(deviceId) => setSelectedDeviceId(deviceId)}
          />
        </motion.aside>
      </div>

      {/* Meitrack Event Alerts */}
      <MeitrackEventAlert
        devices={devices}
        positions={positions}
        onAcknowledge={(eventId) => {
          console.log('Event acknowledged:', eventId);
        }}
        onEventGenerated={(alert) => setAlerts(prev => [...prev, alert])}
      />

      {/* Bottom Panel - Live Telemetry (shows immediately when device selected) */}
      {selectedDeviceId && (() => {
        const device = devices.find(d => d.id === selectedDeviceId);
        const position = positions.find(p => p.deviceId === selectedDeviceId);
        
        if (device && position) {
          return (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="border-t border-border/40 bg-card/50 backdrop-blur-lg"
            >
              <TelemetryPanel
                device={device}
                position={position}
                onClose={() => setSelectedDeviceId(null)}
              />
            </motion.div>
          );
        }
        return null;
      })()}
    </div>
  );
};

export default Dashboard;