import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import {
  Search,
  Filter,
  Settings,
  List,
  MapPin,
  Navigation,
  Fuel,
  Battery,
  Signal,
  Clock,
  Gauge,
  Activity,
  Camera,
  Play,
  X,
  Volume2,
  RotateCcw,
  Maximize2,
  Thermometer,
  AlertTriangle,
  TrendingDown,
  RotateCcw as TurnLeft,
  RotateCw as TurnRight,
  UserX,
  Bell,
} from 'lucide-react';
import { Device, Position } from '@/types/tracking';
import MobileMenu from '@/components/MobileMenu';
import traccarApi from '@/utils/traccarApi';
import MapView from '@/components/MapView';
import DeviceList from '@/components/DeviceList';
import VideoPlayer from '@/components/VideoPlayer';
import dayjs from 'dayjs';

const VehicleDetails = () => {
  const { id } = useParams<{ id: string }>();
  const deviceId = id ? parseInt(id) : null;
  
  const [devices, setDevices] = useState<Device[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCameraFeed, setShowCameraFeed] = useState(false);
  const [showDrivingBehavior, setShowDrivingBehavior] = useState(true);
  
  // Alert states
  const [alerts, setAlerts] = useState<any[]>([]);
  const [lastPosition, setLastPosition] = useState<Position | null>(null);
  const [lastSpeed, setLastSpeed] = useState<number>(0);
  const [lastCourse, setLastCourse] = useState<number>(0);
  const [stopStartTime, setStopStartTime] = useState<Date | null>(null);
  const [drivingEvents, setDrivingEvents] = useState<any[]>([]); // Track all driving events
  const alertCheckInterval = useRef<NodeJS.Timeout | null>(null);

  // Load data and setup real-time monitoring
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
        
        if (deviceId) {
          const device = devicesData.find(d => d.id === deviceId);
          const position = positionsData.find(p => p.deviceId === deviceId);
          setSelectedDevice(device || null);
          setSelectedPosition(position || null);
          
          if (position) {
            setLastPosition(position);
            setLastSpeed(position.speed);
            setLastCourse(position.course);
            
            // Initialize stop time if vehicle is stopped
            if (position.speed === 0) {
              setStopStartTime(new Date(position.deviceTime));
            }
          }
        }
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
    
    // Setup WebSocket for real-time updates
    traccarApi.connectWebSocket((data) => {
      if (data.devices) setDevices(data.devices);
      if (data.positions) {
        setPositions(data.positions);
        
        // Update selected position if it's for current device
        if (deviceId) {
          const updatedPosition = data.positions.find(p => p.deviceId === deviceId);
          if (updatedPosition) {
            checkForAlerts(updatedPosition);
            setSelectedPosition(updatedPosition);
          }
        }
      }
    });

    return () => {
      traccarApi.disconnectWebSocket();
      if (alertCheckInterval.current) {
        clearInterval(alertCheckInterval.current);
      }
    };
  }, [deviceId]);

  // Check for various alerts
  const checkForAlerts = (newPosition: Position) => {
    if (!lastPosition) {
      setLastPosition(newPosition);
      setLastSpeed(newPosition.speed);
      setLastCourse(newPosition.course);
      return;
    }

    const now = new Date();
    const newAlerts: any[] = [];

    // 1. Harsh Braking Alert (speed drop > 10 km/h)
    if (lastSpeed > 10 && newPosition.speed < lastSpeed - 10) {
      newAlerts.push({
        id: `harsh-brake-${Date.now()}`,
        type: 'harsh-braking',
        severity: 'high',
        title: 'Harsh Braking Detected',
        message: `Speed dropped from ${Math.round(lastSpeed)} to ${Math.round(newPosition.speed)} km/h`,
        timestamp: now,
        icon: TrendingDown,
        color: 'text-red-500',
      });
    }

    // 2. Sharp Turn Detection (course change > 45 degrees)
    const courseChange = Math.abs(newPosition.course - lastCourse);
    const normalizedCourseChange = courseChange > 180 ? 360 - courseChange : courseChange;
    
    if (normalizedCourseChange > 45 && newPosition.speed > 5) {
      const turnDirection = ((newPosition.course - lastCourse + 360) % 360) > 180 ? 'left' : 'right';
      newAlerts.push({
        id: `sharp-turn-${Date.now()}`,
        type: 'harsh-cornering',
        severity: 'medium',
        title: `Harsh ${turnDirection.charAt(0).toUpperCase() + turnDirection.slice(1)} Cornering`,
        message: `${Math.round(normalizedCourseChange)}° turn at ${Math.round(newPosition.speed)} km/h`,
        timestamp: now,
        icon: turnDirection === 'left' ? TurnLeft : TurnRight,
        color: 'text-yellow-500',
      });
    }

    // 3. Harsh Acceleration Alert (speed increase > 20 km/h)
    if (newPosition.speed > lastSpeed + 20) {
      newAlerts.push({
        id: `harsh-acceleration-${Date.now()}`,
        type: 'harsh-acceleration',
        severity: 'medium',
        title: 'Harsh Acceleration Detected',
        message: `Speed increased from ${Math.round(lastSpeed)} to ${Math.round(newPosition.speed)} km/h`,
        timestamp: now,
        icon: Activity,
        color: 'text-orange-500',
      });
    }

    // 4. Driver Missing Alert (stopped > 2 minutes)
    if (newPosition.speed === 0) {
      if (!stopStartTime) {
        setStopStartTime(new Date(newPosition.deviceTime));
      } else {
        const stopDuration = (new Date(newPosition.deviceTime).getTime() - stopStartTime.getTime()) / 1000 / 60;
        if (stopDuration > 2) {
          newAlerts.push({
            id: `driver-missing-${Date.now()}`,
            type: 'driver-missing',
            severity: 'high',
            title: 'Driver Missing Alert',
            message: `Vehicle stopped for ${Math.round(stopDuration)} minutes`,
            timestamp: now,
            icon: UserX,
            color: 'text-red-600',
          });
        }
      }
    } else {
      setStopStartTime(null); // Reset if vehicle is moving
    }

    // Add new alerts and track events
    if (newAlerts.length > 0) {
      setAlerts(prev => [...newAlerts, ...prev].slice(0, 10)); // Keep last 10 alerts
      setDrivingEvents(prev => [...newAlerts, ...prev].slice(0, 50)); // Keep last 50 events for analysis
    }

    // Update last position data
    setLastPosition(newPosition);
    setLastSpeed(newPosition.speed);
    setLastCourse(newPosition.course);
  };

  // Auto-dismiss alerts after 30 seconds
  useEffect(() => {
    if (alerts.length > 0) {
      const timer = setTimeout(() => {
        setAlerts(prev => prev.slice(0, -1));
      }, 30000);
      return () => clearTimeout(timer);
    }
  }, [alerts]);

  // Real vehicle data calculations
  const realVehicleData = selectedPosition ? {
    currentSpeed: Math.round(selectedPosition.speed),
    todayOdometer: selectedPosition.attributes?.todayOdometer || 0,
    totalOdometer: selectedPosition.attributes?.totalOdometer || selectedPosition.attributes?.odometer || 0,
    fuelUsed: Math.floor((selectedPosition.attributes?.todayOdometer || 0) / 2), // 2km per liter (1L = 2km)
    fuelRemaining: Math.max(0, 260 - Math.floor((selectedPosition.attributes?.todayOdometer || 0) / 2)),
    batteryLevel: parseInt(selectedPosition.attributes?.battery || '100'),
    temperature: Math.round(selectedPosition.attributes?.temp1 || 25),
    signalStrength: parseInt(selectedPosition.attributes?.gsm || '95'),
    lastUpdate: selectedPosition.deviceTime,
    ignition: selectedPosition.attributes?.ignition || false,
    course: Math.round(selectedPosition.course),
    address: selectedPosition.address || 'Loading address...'
  } : null;

  // Calculate real dashboard statistics from devices
  const dashboardStats = {
    all: devices.length,
    running: devices.filter(d => d.status === 'moving').length,
    stopped: devices.filter(d => d.status === 'stopped').length,
    offline: devices.filter(d => d.status === 'offline').length,
    idle: devices.filter(d => d.status === 'unknown').length,
    unreachable: devices.filter(d => d.status === 'offline').length
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading vehicle data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <motion.header 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="border-b border-border/40 bg-card/50 backdrop-blur-lg"
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between px-3 sm:px-4 py-2">
          <div className="flex items-center justify-between mb-2 lg:mb-0">
            <div className="flex items-center gap-2">
              <Navigation className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              <h1 className="text-base sm:text-lg font-bold">
                <span className="hidden sm:inline">Vehicle Tracking System</span>
                <span className="sm:hidden">Vehicle Tracker</span>
              </h1>
            </div>
            
            {/* Mobile Controls */}
            <div className="flex lg:hidden items-center gap-2">
              <MobileMenu 
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                alerts={alerts}
                currentPage="vehicle"
              />
            </div>
          </div>
          
          {/* Desktop Header Controls */}
          <div className="hidden lg:flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search Vehicle"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-40 h-8 text-sm"
              />
            </div>
            <Button variant="outline" size="sm" className="h-8">
              <Filter className="h-3 w-3 mr-1" />
              Filter
            </Button>
            <Button variant="outline" size="sm" className="h-8">
              <Settings className="h-3 w-3 mr-1" />
              Setting
            </Button>
          </div>

          {/* Status Badges */}
          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto">
            <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs whitespace-nowrap">
              {dashboardStats.all} All
            </Badge>
            <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30 text-xs whitespace-nowrap">
              {dashboardStats.running} Moving
            </Badge>
            <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30 text-xs whitespace-nowrap">
              {dashboardStats.stopped} Stopped
            </Badge>
            <Badge variant="outline" className="bg-gray-500/20 text-gray-400 border-gray-500/30 text-xs whitespace-nowrap">
              {dashboardStats.offline} Offline
            </Badge>
            <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs whitespace-nowrap">
              {dashboardStats.idle} Idle
            </Badge>
          </div>
        </div>
      </motion.header>

      {/* Alert Notifications */}
      <AnimatePresence>
        {alerts.map((alert, index) => (
          <motion.div
            key={alert.id}
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            className={`fixed top-16 sm:top-20 right-2 sm:right-4 z-50`}
            style={{ top: `${64 + index * 70}px` }}
          >
            <Alert className="w-72 sm:w-80 bg-card border-l-4 border-l-red-500 shadow-lg">
              <div className="flex items-center gap-3">
                <alert.icon className={`h-5 w-5 ${alert.color}`} />
                <div className="flex-1">
                  <div className="font-semibold text-sm">{alert.title}</div>
                  <AlertDescription className="text-xs">
                    {alert.message}
                  </AlertDescription>
                  <div className="text-xs text-muted-foreground mt-1">
                    {dayjs(alert.timestamp).format('HH:mm:ss')}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAlerts(prev => prev.filter(a => a.id !== alert.id))}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </Alert>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden flex-col lg:flex-row">
        {/* Left Sidebar - Alerts Panel */}
        <motion.aside
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="w-full lg:w-80 max-h-64 lg:max-h-none border-b lg:border-b-0 lg:border-r border-border/40 bg-sidebar/95 backdrop-blur-lg overflow-y-auto"
        >
          {/* Alerts based on device logic */}
          <div className="flex flex-col h-full">
            <div className="p-4 border-b border-sidebar-border">
              <div className="flex items-center gap-2 mb-4">
                <Bell className="h-5 w-5 text-warning" />
                <h2 className="text-lg font-semibold">Vehicle Alerts</h2>
                {alerts.length > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {alerts.length}
                  </Badge>
                )}
              </div>
              
              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="bg-background/20 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-red-400">
                    {alerts.filter(a => a.severity === 'high').length}
                  </div>
                  <div className="text-xs text-muted-foreground">Critical</div>
                </div>
                <div className="bg-background/20 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-yellow-400">
                    {alerts.filter(a => a.severity === 'medium').length}
                  </div>
                  <div className="text-xs text-muted-foreground">Warning</div>
                </div>
              </div>
            </div>

            {/* Real-time alerts display */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <AnimatePresence>
                {alerts.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-8 text-muted-foreground"
                  >
                    <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No active alerts</p>
                    <p className="text-xs mt-1">System monitoring for events...</p>
                  </motion.div>
                ) : (
                  alerts.map((alert, index) => (
                    <motion.div
                      key={alert.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ delay: index * 0.1 }}
                      className={`p-3 rounded-lg border ${
                        alert.severity === 'high' ? 'border-red-500/30 bg-red-500/10' :
                        alert.severity === 'medium' ? 'border-yellow-500/30 bg-yellow-500/10' :
                        'border-blue-500/30 bg-blue-500/10'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <alert.icon className={`h-5 w-5 mt-0.5 ${alert.color}`} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${
                                alert.severity === 'high' ? 'border-red-500/50 text-red-400' :
                                alert.severity === 'medium' ? 'border-yellow-500/50 text-yellow-400' :
                                'border-blue-500/50 text-blue-400'
                              }`}
                            >
                              {alert.severity}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {dayjs(alert.timestamp).format('HH:mm:ss')}
                            </span>
                          </div>
                          <h4 className="font-medium text-sm mb-1">{alert.title}</h4>
                          <p className="text-xs text-muted-foreground">{alert.message}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.aside>

        {/* Center - Map */}
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex-1 relative min-h-[300px] lg:min-h-0 min-w-0"
        >
          <MapView
            devices={devices}
            positions={positions}
            selectedDeviceId={deviceId}
            onDeviceSelect={(id) => {
              const device = devices.find(d => d.id === id);
              const position = positions.find(p => p.deviceId === id);
              setSelectedDevice(device || null);
              setSelectedPosition(position || null);
            }}
            alerts={[]}
          />
          
          {/* Route Deviation Alert */}
          <div className="absolute top-2 left-2 sm:top-4 sm:left-4 bg-red-500 text-white px-2 py-1 sm:px-3 sm:py-1 rounded text-xs sm:text-sm font-medium">
            Route Deviated
          </div>
        </motion.div>

        {/* Right Sidebar - Vehicle List (Hidden on smaller screens) */}
        <motion.aside
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="hidden xl:block w-80 border-l border-border/40 bg-sidebar/95 backdrop-blur-lg"
        >
          <div className="p-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">VEHICLE LIST</h3>
              <List className="h-4 w-4 text-muted-foreground" />
            </div>
            
            <DeviceList
              devices={devices}
              positions={positions}
              selectedDeviceId={deviceId}
              onDeviceSelect={(id) => window.location.href = `/vehicle/${id}`}
              searchQuery={searchQuery}
              collapsed={false}
              onToggleCollapse={() => {}}
              loading={loading}
            />
          </div>
        </motion.aside>
      </div>

      {/* Camera Feed Popup */}
      {showCameraFeed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card rounded-lg p-3 sm:p-4 w-full max-w-4xl max-h-[90vh] sm:max-h-[80vh]"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Camera Feed - {selectedDevice?.name}</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCameraFeed(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="aspect-video bg-black rounded-lg overflow-hidden">
              <VideoPlayer
                deviceId={deviceId || 0}
                attributes={selectedPosition?.attributes || {}}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default VehicleDetails;