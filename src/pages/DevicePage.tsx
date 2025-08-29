import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  AreaChart,
  Area,
} from 'recharts';
import {
  ArrowLeft,
  MapPin,
  Navigation,
  Fuel,
  Battery,
  Signal,
  Camera,
  Play,
  Download,
  Send,
  Settings,
  Clock,
  Thermometer,
  Activity,
  AlertTriangle,
} from 'lucide-react';
import { Device, Position } from '@/types/tracking';
import traccarApi from '@/utils/traccarApi';
import { resolveMediaUrl, getMockSnapshotUrl } from '@/utils/media';
import VideoPlayer from '@/components/VideoPlayer';
import dayjs from 'dayjs';

const DevicePage = () => {
  const { id } = useParams<{ id: string }>();
  const deviceId = id ? parseInt(id) : null;
  
  const [device, setDevice] = useState<Device | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const [telemetryHistory, setTelemetryHistory] = useState<any[]>([]);
  const [mediaGallery, setMediaGallery] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Load device data
  useEffect(() => {
    if (!deviceId) return;

    const loadDeviceData = async () => {
      try {
        setLoading(true);
        const devices = await traccarApi.getDevices();
        const deviceData = devices.find(d => d.id === deviceId);
        
        if (deviceData) {
          setDevice(deviceData);
          
          // Get current position
          const positions = await traccarApi.getPositions([deviceId]);
          const currentPosition = positions.find(p => p.deviceId === deviceId);
          if (currentPosition) {
            setPosition(currentPosition);
          }

          // Generate telemetry history
          const history = generateMockTelemetryHistory(deviceData, currentPosition);
          setTelemetryHistory(history);

          // Generate media gallery
          const gallery = generateMockMediaGallery(deviceData);
          setMediaGallery(gallery);
        }
      } catch (error) {
        console.error('Failed to load device data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDeviceData();
  }, [deviceId]);

  const generateMockTelemetryHistory = (device: Device, position: Position | null) => {
    const history = [];
    const now = new Date();
    
    for (let i = 23; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000);
      history.push({
        time: dayjs(timestamp).format('HH:mm'),
        speed: Math.max(0, (position?.speed || 0) + (Math.random() - 0.5) * 30),
        fuel: Math.max(10, (position?.attributes?.fuel || 50) + (Math.random() - 0.5) * 15),
        battery: Math.max(0, (position?.attributes?.battery || 80) + (Math.random() - 0.5) * 10),
        temperature: (position?.attributes?.temp1 || 25) + (Math.random() - 0.5) * 15,
        gsm: Math.max(0, (position?.attributes?.gsm || 85) + (Math.random() - 0.5) * 20),
      });
    }
    return history;
  };

  const generateMockMediaGallery = (device: Device) => {
    const gallery = [];
    const now = new Date();
    
    for (let i = 0; i < 12; i++) {
      const timestamp = new Date(now.getTime() - i * 30 * 60 * 1000);
      gallery.push({
        id: i,
        type: Math.random() > 0.7 ? 'video' : 'image',
        url: getMockSnapshotUrl(device.id, timestamp),
        timestamp: timestamp.toISOString(),
        size: `${Math.floor(Math.random() * 500 + 100)}KB`,
      });
    }
    return gallery;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading device data...</p>
        </div>
      </div>
    );
  }

  if (!device) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">Device Not Found</h2>
          <p className="text-muted-foreground mb-4">The requested device could not be found.</p>
          <Link to="/">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const telemetry = {
    speed: position ? Math.round(position.speed) : 0,
    fuel: parseInt(position?.attributes?.fuel || '0'),
    battery: parseInt(position?.attributes?.battery || '0'),
    temperature: position?.attributes?.temp1 || 0,
    gsm: parseInt(position?.attributes?.gsm || '0'),
    satellites: parseInt(position?.attributes?.satellites || '0'),
    ignition: position?.attributes?.ignition || false,
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="border-b border-border/40 bg-card/50 backdrop-blur-lg"
      >
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">{device.name}</h1>
              <p className="text-sm text-muted-foreground">
                {device.uniqueId} • {device.model || 'GPS Tracker'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Badge
              variant="outline"
              className={
                device.status === 'moving' ? 'badge-moving' :
                device.status === 'idle' ? 'badge-idle' :
                device.status === 'offline' ? 'badge-offline' :
                'badge-online'
              }
            >
              {device.status}
            </Badge>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>
      </motion.header>

      {/* Content */}
      <div className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="telemetry">Telemetry</TabsTrigger>
            <TabsTrigger value="media">Media</TabsTrigger>
            <TabsTrigger value="commands">Commands</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Current Status */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      Current Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {position && (
                      <>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Navigation className="h-4 w-4 text-primary" />
                            <span className="text-sm">Speed</span>
                          </div>
                          <span className="font-medium">{telemetry.speed} km/h</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-accent" />
                            <span className="text-sm">Location</span>
                          </div>
                          <span className="text-xs font-mono">
                            {position.latitude.toFixed(4)}, {position.longitude.toFixed(4)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">Last Update</span>
                          </div>
                          <span className="text-sm">
                            {dayjs(position.deviceTime).format('MMM D, HH:mm')}
                          </span>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Fuel & Battery */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Fuel className="h-5 w-5" />
                      Resources
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>Fuel Level</span>
                        <span>{telemetry.fuel}%</span>
                      </div>
                      <Progress value={telemetry.fuel} className="h-3" />
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>Battery</span>
                        <span>{telemetry.battery}%</span>
                      </div>
                      <Progress value={telemetry.battery} className="h-3" />
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <Signal className="h-4 w-4 text-blue-400" />
                        <span className="text-sm">Signal</span>
                      </div>
                      <span className="font-medium">{telemetry.gsm}%</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Device Info */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle>Device Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Model:</span>
                      <span>{device.model || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Phone:</span>
                      <span>{device.phone || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Contact:</span>
                      <span className="text-right">{device.contact || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Protocol:</span>
                      <span>{position?.protocol || 'N/A'}</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Live Media */}
            {device.attributes?.mdvrConnected && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Camera className="h-5 w-5" />
                      Live Camera Feed
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <VideoPlayer
                      deviceId={device.id}
                      attributes={position?.attributes || {}}
                      autoPlay={false}
                    />
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </TabsContent>

          {/* Telemetry Tab */}
          <TabsContent value="telemetry" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Speed Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Speed (Last 24 Hours)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={telemetryHistory}>
                      <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="speed"
                        stroke="hsl(var(--primary))"
                        fill="hsl(var(--primary) / 0.2)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Fuel Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Fuel Level</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={telemetryHistory}>
                      <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="fuel"
                        stroke="hsl(var(--fuel-medium))"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Battery Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Battery Level</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={telemetryHistory}>
                      <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="battery"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Temperature Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Temperature</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={telemetryHistory}>
                      <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="temperature"
                        stroke="hsl(var(--warning))"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Media Tab */}
          <TabsContent value="media" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  Media Gallery
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {mediaGallery.map((media) => (
                    <motion.div
                      key={media.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: media.id * 0.05 }}
                      className="relative group cursor-pointer"
                    >
                      <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                        <img
                          src={media.url}
                          alt={`Media ${media.id}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="flex gap-2">
                            {media.type === 'video' && (
                              <Button size="sm" variant="secondary">
                                <Play className="h-4 w-4" />
                              </Button>
                            )}
                            <Button size="sm" variant="secondary">
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        <div className="flex justify-between">
                          <span>{dayjs(media.timestamp).format('MMM D, HH:mm')}</span>
                          <span>{media.size}</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Commands Tab */}
          <TabsContent value="commands" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  Device Commands
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { name: 'Engine Stop', description: 'Remotely stop the engine', action: 'engineStop' },
                    { name: 'Engine Resume', description: 'Resume engine operation', action: 'engineResume' },
                    { name: 'Request Position', description: 'Get current GPS position', action: 'positionSingle' },
                    { name: 'Reboot Device', description: 'Restart the GPS device', action: 'rebootDevice' },
                    { name: 'Take Photo', description: 'Capture image from camera', action: 'takePhoto' },
                    { name: 'Output Control', description: 'Control device outputs', action: 'outputControl' },
                  ].map((command) => (
                    <Card key={command.action} className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="p-4">
                        <h4 className="font-medium mb-1">{command.name}</h4>
                        <p className="text-sm text-muted-foreground mb-3">{command.description}</p>
                        <Button size="sm" className="w-full">
                          <Send className="h-4 w-4 mr-2" />
                          Send Command
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Events Tab */}
          <TabsContent value="events" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Events</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No recent events for this device</p>
                  <Link to="/events">
                    <Button variant="link" className="mt-2">
                      View all events
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default DevicePage;