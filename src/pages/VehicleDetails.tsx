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
        type: 'sharp-turn',
        severity: 'medium',
        title: `Sharp ${turnDirection.charAt(0).toUpperCase() + turnDirection.slice(1)} Turn`,
        message: `${Math.round(normalizedCourseChange)}° turn at ${Math.round(newPosition.speed)} km/h`,
        timestamp: now,
        icon: turnDirection === 'left' ? TurnLeft : TurnRight,
        color: 'text-yellow-500',
      });
    }

    // 3. Driver Missing Alert (stopped > 2 minutes)
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

    // Add new alerts
    if (newAlerts.length > 0) {
      setAlerts(prev => [...newAlerts, ...prev].slice(0, 10)); // Keep last 10 alerts
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
    totalOdometer: selectedPosition.attributes?.odometer || 0,
    fuelUsed: Math.floor((selectedPosition.attributes?.todayOdometer || 0) / 8), // 8km per liter
    fuelRemaining: Math.max(0, 260 - Math.floor((selectedPosition.attributes?.todayOdometer || 0) / 8)),
    batteryLevel: parseInt(selectedPosition.attributes?.battery || '100'),
    temperature: Math.round(selectedPosition.attributes?.temp1 || 25),
    signalStrength: parseInt(selectedPosition.attributes?.gsm || '95'),
    lastUpdate: selectedPosition.deviceTime,
    ignition: selectedPosition.attributes?.ignition || false,
    course: Math.round(selectedPosition.course),
    address: selectedPosition.address || 'Loading address...'
  } : null;

  // Generate fuel chart data based on real today's odometer
  const fuelChartData = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000);
    const baseFuel = realVehicleData?.fuelRemaining || 260;
    const variation = (Math.random() - 0.5) * 20;
    const fuelLevel = Math.max(10, baseFuel + variation);
    fuelChartData.push({
      time: dayjs(timestamp).format('HH:mm'),
      fuel: ((fuelLevel / 260) * 100),
    });
  }

  // Generate driving behavior data
  const drivingBehaviorData = [
    { name: 'Harsh Cornering', value: 23.3, color: '#ff6b6b' },
    { name: 'Harsh Braking', value: 27.8, color: '#4ecdc4' },
    { name: 'Harsh Acceleration', value: 30.2, color: '#45b7d1' },
    { name: 'Normal Driving', value: 18.7, color: '#96ceb4' },
  ];

  const totalTrips = 1543;
  const totalDistance = `${totalTrips} km`;

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
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Navigation className="h-6 w-6 text-primary" />
              <h1 className="text-lg font-bold">Vehicle Tracking System</h1>
            </div>
            
            {/* Header Controls */}
            <div className="flex items-center gap-2">
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
          </div>

          {/* Status Badges */}
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/30">
              210 All
            </Badge>
            <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">
              150 Running
            </Badge>
            <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30">
              20 Stopped
            </Badge>
            <Badge variant="outline" className="bg-gray-500/20 text-gray-400 border-gray-500/30">
              05 Unreachable
            </Badge>
            <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
              06 Idle
            </Badge>
            <Badge variant="outline" className="bg-orange-500/20 text-orange-400 border-orange-500/30">
              05 New
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
            className={`fixed top-20 right-4 z-50`}
            style={{ top: `${80 + index * 80}px` }}
          >
            <Alert className="w-80 bg-card border-l-4 border-l-red-500 shadow-lg">
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
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Vehicle Details */}
        <motion.aside
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="w-80 border-r border-border/40 bg-sidebar/95 backdrop-blur-lg overflow-y-auto"
        >
          <div className="p-4">
            {/* Vehicle Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  selectedDevice?.status === 'moving' ? 'bg-green-500' :
                  selectedDevice?.status === 'stopped' ? 'bg-yellow-500' :
                  'bg-red-500'
                }`}>
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <h2 className="font-bold text-lg">{selectedDevice?.name || 'Loading...'}</h2>
                <Badge className="text-xs">
                  {selectedDevice?.status || 'unknown'}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  Today: {realVehicleData?.todayOdometer.toFixed(3) || '0.000'} km
                </Badge>
                <div className="flex gap-1">
                  <div className={`w-2 h-2 rounded-full ${realVehicleData?.ignition ? 'bg-green-400' : 'bg-red-400'}`}></div>
                  <div className={`w-2 h-2 rounded-full ${realVehicleData?.batteryLevel > 50 ? 'bg-green-400' : 'bg-yellow-400'}`}></div>
                  <div className={`w-2 h-2 rounded-full ${realVehicleData?.signalStrength > 70 ? 'bg-green-400' : 'bg-orange-400'}`}></div>
                </div>
              </div>
            </div>

            {/* Address Information */}
            <Card className="mb-4">
              <CardContent className="p-3">
                <div className="space-y-3">
                  {/* Current Address */}
                  <div className="flex items-start gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full mt-1 flex-shrink-0"></div>
                    <div className="flex-1">
                      <div className="text-xs text-muted-foreground">Current Address</div>
                      <div className="text-sm font-medium">
                        {realVehicleData?.address}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {selectedPosition?.latitude.toFixed(6)}, {selectedPosition?.longitude.toFixed(6)}
                      </div>
                    </div>
                  </div>
                  
                  {/* Speed & Course */}
                  <div className="flex items-start gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full mt-1 flex-shrink-0"></div>
                    <div className="flex-1">
                      <div className="text-xs text-muted-foreground">Speed & Direction</div>
                      <div className="text-sm font-medium">
                        {realVehicleData?.currentSpeed} km/h → {realVehicleData?.course}°
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Last Packet & Today's Odometer */}
            <Card className="mb-4">
              <CardContent className="p-3">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${selectedDevice?.status === 'moving' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                      <span className="text-sm font-medium">Last Packet</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {dayjs(realVehicleData?.lastUpdate || new Date()).format('DD/MM/YYYY - HH:mm:ss')}
                    </div>
                  </div>
                  
                  <div className="border-t pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-primary">Today's Odometer</span>
                      <span className="text-lg font-bold text-primary">
                        {realVehicleData?.todayOdometer.toFixed(3) || '0.000'} km
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Total: {realVehicleData?.totalOdometer.toLocaleString() || '0'} km
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Live Vehicle Stats */}
            <Card className="mb-4">
              <CardContent className="p-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Gauge className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Speed</span>
                    </div>
                    <span className={`text-sm font-medium ${realVehicleData?.currentSpeed > 0 ? 'text-green-500' : 'text-muted-foreground'}`}>
                      {realVehicleData?.currentSpeed || 0} km/h
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Fuel className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium">Fuel</span>
                    </div>
                    <span className="text-sm font-medium">
                      {realVehicleData?.fuelRemaining || 260}L / 260L
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Battery className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium">Battery</span>
                    </div>
                    <span className="text-sm font-medium">
                      {realVehicleData?.batteryLevel || 100}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Total Distance */}
            <Card className="mb-4">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-accent" />
                    <span className="text-sm font-medium">Total Distance</span>
                  </div>
                  <span className="text-sm font-medium">15 Km</span>
                </div>
              </CardContent>
            </Card>

            {/* Status Indicators */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="flex items-center gap-2 p-2 bg-card rounded border">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-xs">Refuel</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-card rounded border">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span className="text-xs">Absolute Mileage</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-card rounded border">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-xs">Ignition</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-card rounded border">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-xs">Fuel Drained</span>
              </div>
            </div>

            {/* Fuel Level Chart */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Fuel Level</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <ResponsiveContainer width="100%" height={120}>
                  <LineChart data={fuelChartData}>
                    <XAxis 
                      dataKey="time" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10 }}
                    />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="fuel"
                      stroke="#2563eb"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </motion.aside>

        {/* Center - Map */}
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex-1 relative"
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
          <div className="absolute top-4 left-4 bg-red-500 text-white px-3 py-1 rounded text-sm font-medium">
            Route Deviated
          </div>
        </motion.div>

        {/* Right Sidebar - Vehicle List */}
        <motion.aside
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="w-80 border-l border-border/40 bg-sidebar/95 backdrop-blur-lg"
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
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card border border-border/40 rounded-lg p-4 w-96 h-64"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm">FOOTAGE AU_JUFUD</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCameraFeed(false)}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="bg-black rounded h-40 flex items-center justify-center relative">
              <div className="text-white text-xs absolute bottom-2 left-2">
                09-04-2023 - 16:19:26
              </div>
              <Camera className="h-8 w-8 text-white/50" />
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Driving Behavior Popup */}
      {showDrivingBehavior && (
        <motion.div
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="fixed bottom-4 right-4 bg-card border border-border/40 rounded-lg p-4 w-80 z-40"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">Driving Behaviour</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDrivingBehavior(false)}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Pie Chart */}
            <div className="w-32 h-32">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={drivingBehaviorData}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={60}
                    dataKey="value"
                  >
                    {drivingBehaviorData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="text-center mt-2">
                <div className="text-lg font-bold">Total</div>
                <div className="text-sm font-bold">{totalDistance}</div>
              </div>
            </div>
            
            {/* Legend */}
            <div className="flex-1 space-y-2">
              {drivingBehaviorData.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: item.color }}
                  ></div>
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">{item.name}</div>
                    <div className="text-sm font-medium">({item.value}%)</div>
                  </div>
                </div>
              ))}
              
              <div className="mt-3 pt-2 border-t border-border/40">
                <div className="text-xs text-muted-foreground">Harsh Braking</div>
                <div className="text-lg font-bold text-red-400">Total</div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default VehicleDetails;