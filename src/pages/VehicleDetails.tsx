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

  // Generate driving behavior data based on real events
  const drivingBehaviorData = (() => {
    const eventCounts = {
      'harsh-cornering': drivingEvents.filter(e => e.type === 'harsh-cornering').length,
      'harsh-braking': drivingEvents.filter(e => e.type === 'harsh-braking').length,
      'harsh-acceleration': drivingEvents.filter(e => e.type === 'harsh-acceleration').length,
      'driver-missing': drivingEvents.filter(e => e.type === 'driver-missing').length
    };
    
    const totalEvents = Object.values(eventCounts).reduce((a, b) => a + b, 0);
    const normalDriving = Math.max(0, 100 - totalEvents * 2); // Each event reduces normal driving by 2%
    
    return [
      { 
        name: 'Harsh Cornering', 
        value: totalEvents > 0 ? Math.round((eventCounts['harsh-cornering'] / totalEvents) * (100 - normalDriving)) : 0, 
        color: '#ff6b6b',
        count: eventCounts['harsh-cornering']
      },
      { 
        name: 'Harsh Braking', 
        value: totalEvents > 0 ? Math.round((eventCounts['harsh-braking'] / totalEvents) * (100 - normalDriving)) : 0, 
        color: '#4ecdc4',
        count: eventCounts['harsh-braking']
      },
      { 
        name: 'Harsh Acceleration', 
        value: totalEvents > 0 ? Math.round((eventCounts['harsh-acceleration'] / totalEvents) * (100 - normalDriving)) : 0, 
        color: '#45b7d1',
        count: eventCounts['harsh-acceleration']
      },
      { 
        name: 'Normal Driving', 
        value: Math.round(normalDriving), 
        color: '#96ceb4',
        count: 0
      },
    ];
  })();

  // Generate driving events chart data
  const drivingEventsChartData = [];
  const currentTime = new Date();
  for (let i = 11; i >= 0; i--) {
    const timestamp = new Date(currentTime.getTime() - i * 60 * 60 * 1000);
    const hourEvents = drivingEvents.filter(event => {
      const eventTime = new Date(event.timestamp);
      return eventTime >= new Date(timestamp.getTime() - 30 * 60 * 1000) && eventTime < new Date(timestamp.getTime() + 30 * 60 * 1000);
    });
    
    drivingEventsChartData.push({
      time: dayjs(timestamp).format('HH:mm'),
      events: hourEvents.length,
      harshBraking: hourEvents.filter(e => e.type === 'harsh-braking').length,
      harshCornering: hourEvents.filter(e => e.type === 'harsh-cornering').length,
      harshAcceleration: hourEvents.filter(e => e.type === 'harsh-acceleration').length,
    });
  }

  // AI Driving Analysis
  const generateAIAnalysis = () => {
    const totalEvents = drivingEvents.length;
    const harshBrakingCount = drivingEvents.filter(e => e.type === 'harsh-braking').length;
    const harshCorneringCount = drivingEvents.filter(e => e.type === 'harsh-cornering').length; 
    const harshAccelerationCount = drivingEvents.filter(e => e.type === 'harsh-acceleration').length;
    const driverMissingCount = drivingEvents.filter(e => e.type === 'driver-missing').length;

    let drivingScore = 100;
    let analysis = [];
    let recommendations = [];

    // Calculate driving score
    drivingScore -= harshBrakingCount * 5; // -5 points per harsh braking
    drivingScore -= harshCorneringCount * 4; // -4 points per harsh cornering
    drivingScore -= harshAccelerationCount * 3; // -3 points per harsh acceleration
    drivingScore -= driverMissingCount * 2; // -2 points per driver missing
    drivingScore = Math.max(0, Math.min(100, drivingScore));

    // Generate analysis
    if (drivingScore >= 90) {
      analysis.push("🟢 Excellent driving behavior detected");
      recommendations.push("Continue maintaining safe driving practices");
    } else if (drivingScore >= 75) {
      analysis.push("🟡 Good driving with room for improvement");
      recommendations.push("Focus on smoother acceleration and braking");
    } else if (drivingScore >= 60) {
      analysis.push("🟠 Average driving behavior with safety concerns");
      recommendations.push("Consider driver training for safer habits");
    } else {
      analysis.push("🔴 Poor driving behavior - immediate attention required");
      recommendations.push("Urgent driver coaching needed for safety");
    }

    // Specific behavior analysis
    if (harshBrakingCount > 5) {
      analysis.push(`⚠️ Frequent harsh braking detected (${harshBrakingCount} events)`);
      recommendations.push("Maintain safe following distance and anticipate traffic");
    }
    
    if (harshCorneringCount > 3) {
      analysis.push(`⚠️ Aggressive cornering behavior (${harshCorneringCount} events)`);
      recommendations.push("Reduce speed when turning and follow proper cornering techniques");
    }

    if (harshAccelerationCount > 3) {
      analysis.push(`⚠️ Excessive acceleration detected (${harshAccelerationCount} events)`);
      recommendations.push("Practice gradual acceleration to improve fuel efficiency");
    }

    return { drivingScore, analysis, recommendations };
  };

  const aiAnalysis = generateAIAnalysis();

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
              {dashboardStats.all} All
            </Badge>
            <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">
              {dashboardStats.running} Moving
            </Badge>
            <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30">
              {dashboardStats.stopped} Stopped
            </Badge>
            <Badge variant="outline" className="bg-gray-500/20 text-gray-400 border-gray-500/30">
              {dashboardStats.offline} Offline
            </Badge>
            <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
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
          className="fixed bottom-4 right-4 bg-card border border-border/40 rounded-lg p-4 w-96 z-40 max-h-96 overflow-y-auto"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">AI Driving Behaviour Analysis</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDrivingBehavior(false)}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* AI Driving Score */}
          <div className="mb-4 p-3 bg-background/50 rounded border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">AI Driving Score</span>
              <span className={`text-lg font-bold ${
                aiAnalysis.drivingScore >= 90 ? 'text-green-500' :
                aiAnalysis.drivingScore >= 75 ? 'text-yellow-500' :
                aiAnalysis.drivingScore >= 60 ? 'text-orange-500' : 'text-red-500'
              }`}>
                {aiAnalysis.drivingScore}/100
              </span>
            </div>
            <Progress value={aiAnalysis.drivingScore} className="h-2" />
          </div>

          {/* AI Analysis */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold mb-2 text-muted-foreground">AI ANALYSIS</h4>
            <div className="space-y-1">
              {aiAnalysis.analysis.map((item, index) => (
                <div key={index} className="text-xs">{item}</div>
              ))}
            </div>
          </div>

          {/* Recommendations */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold mb-2 text-muted-foreground">RECOMMENDATIONS</h4>
            <div className="space-y-1">
              {aiAnalysis.recommendations.map((item, index) => (
                <div key={index} className="text-xs text-muted-foreground">• {item}</div>
              ))}
            </div>
          </div>

          {/* Behavior Chart */}
          <div className="flex items-center gap-4 mb-4">
            {/* Pie Chart */}
            <div className="w-24 h-24">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={drivingBehaviorData}
                    cx="50%"
                    cy="50%"
                    innerRadius={20}
                    outerRadius={40}
                    dataKey="value"
                  >
                    {drivingBehaviorData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            {/* Legend with Event Counts */}
            <div className="flex-1 space-y-1">
              {drivingBehaviorData.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: item.color }}
                  ></div>
                  <div className="flex-1">
                    <div className="text-xs">{item.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.count > 0 ? `${item.count} events` : `${item.value}%`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Events Timeline Chart */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold mb-2 text-muted-foreground">EVENTS TIMELINE (12H)</h4>
            <ResponsiveContainer width="100%" height={80}>
              <LineChart data={drivingEventsChartData}>
                <XAxis 
                  dataKey="time" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 8 }}
                />
                <YAxis hide />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="events"
                  stroke="#ff6b6b"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Recent Events */}
          <div>
            <h4 className="text-xs font-semibold mb-2 text-muted-foreground">RECENT EVENTS</h4>
            <div className="space-y-1 max-h-20 overflow-y-auto">
              {drivingEvents.slice(0, 3).map((event, index) => (
                <div key={event.id} className="flex items-center gap-2 text-xs">
                  <event.icon className={`h-3 w-3 ${event.color}`} />
                  <span className="flex-1">{event.title}</span>
                  <span className="text-muted-foreground">
                    {dayjs(event.timestamp).format('HH:mm')}
                  </span>
                </div>
              ))}
              {drivingEvents.length === 0 && (
                <div className="text-xs text-muted-foreground">No events recorded today</div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default VehicleDetails;