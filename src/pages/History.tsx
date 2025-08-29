import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Calendar,
  Clock,
  Download,
  Route,
  MapPin,
  Navigation,
} from 'lucide-react';
import { Device, Position, PlaybackState } from '@/types/tracking';
import traccarApi from '@/utils/traccarApi';
import MapView from '@/components/MapView';
import dayjs from 'dayjs';

const History = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null);
  const [historicalPositions, setHistoricalPositions] = useState<Position[]>([]);
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    playing: false,
    speed: 1,
    position: 0,
    duration: 0,
    currentTime: new Date(),
    showStops: true,
    stopThreshold: 5,
  });
  
  const [dateRange, setDateRange] = useState({
    from: dayjs().subtract(1, 'day').toDate(),
    to: new Date(),
  });
  
  const [loading, setLoading] = useState(false);

  // Load devices
  useEffect(() => {
    const loadDevices = async () => {
      try {
        const devicesData = await traccarApi.getDevices();
        setDevices(devicesData);
        if (devicesData.length > 0) {
          setSelectedDeviceId(devicesData[0].id);
        }
      } catch (error) {
        console.error('Failed to load devices:', error);
      }
    };

    loadDevices();
  }, []);

  // Load historical data
  const loadHistory = async () => {
    if (!selectedDeviceId) return;

    setLoading(true);
    try {
      const positions = await traccarApi.getPositionsHistory(
        selectedDeviceId,
        dateRange.from,
        dateRange.to
      );
      setHistoricalPositions(positions);
      
      if (positions.length > 0) {
        setPlaybackState(prev => ({
          ...prev,
          duration: positions.length - 1,
          position: 0,
          currentTime: new Date(positions[0].deviceTime),
        }));
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDeviceId) {
      loadHistory();
    }
  }, [selectedDeviceId, dateRange]);

  // Playback controls
  const togglePlayback = () => {
    setPlaybackState(prev => ({ ...prev, playing: !prev.playing }));
  };

  const stepForward = () => {
    setPlaybackState(prev => ({
      ...prev,
      position: Math.min(prev.position + 1, prev.duration),
      currentTime: historicalPositions[Math.min(prev.position + 1, prev.duration)]
        ? new Date(historicalPositions[Math.min(prev.position + 1, prev.duration)].deviceTime)
        : prev.currentTime,
    }));
  };

  const stepBackward = () => {
    setPlaybackState(prev => ({
      ...prev,
      position: Math.max(prev.position - 1, 0),
      currentTime: historicalPositions[Math.max(prev.position - 1, 0)]
        ? new Date(historicalPositions[Math.max(prev.position - 1, 0)].deviceTime)
        : prev.currentTime,
    }));
  };

  const setPlaybackPosition = (position: number) => {
    setPlaybackState(prev => ({
      ...prev,
      position,
      currentTime: historicalPositions[position]
        ? new Date(historicalPositions[position].deviceTime)
        : prev.currentTime,
    }));
  };

  // Auto playback
  useEffect(() => {
    if (!playbackState.playing || historicalPositions.length === 0) return;

    const interval = setInterval(() => {
      setPlaybackState(prev => {
        const nextPosition = prev.position + 1;
        if (nextPosition > prev.duration) {
          return { ...prev, playing: false };
        }
        
        return {
          ...prev,
          position: nextPosition,
          currentTime: historicalPositions[nextPosition]
            ? new Date(historicalPositions[nextPosition].deviceTime)
            : prev.currentTime,
        };
      });
    }, 1000 / playbackState.speed);

    return () => clearInterval(interval);
  }, [playbackState.playing, playbackState.speed, historicalPositions]);

  const currentPosition = historicalPositions[playbackState.position];
  const selectedDevice = devices.find(d => d.id === selectedDeviceId);

  const exportRoute = () => {
    if (historicalPositions.length === 0) return;

    // Generate GPX format
    const gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="GPS Tracker Pro">
  <trk>
    <name>${selectedDevice?.name || 'Route'} - ${dayjs(dateRange.from).format('YYYY-MM-DD')}</name>
    <trkseg>
      ${historicalPositions.map(pos => `
      <trkpt lat="${pos.latitude}" lon="${pos.longitude}">
        <ele>${pos.altitude}</ele>
        <time>${dayjs(pos.deviceTime).toISOString()}</time>
        <extensions>
          <speed>${pos.speed}</speed>
          <course>${pos.course}</course>
        </extensions>
      </trkpt>`).join('')}
    </trkseg>
  </trk>
</gpx>`;

    const blob = new Blob([gpxContent], { type: 'application/gpx+xml' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `route-${selectedDevice?.name}-${dayjs().format('YYYY-MM-DD')}.gpx`;
    a.click();
  };

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
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Route History</h1>
              <p className="text-sm text-muted-foreground">
                {selectedDevice ? `${selectedDevice.name} - ${historicalPositions.length} points` : 'Select a device'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button onClick={exportRoute} variant="outline" size="sm" disabled={!currentPosition}>
              <Download className="h-4 w-4 mr-2" />
              Export GPX
            </Button>
          </div>
        </div>
      </motion.header>

      <div className="flex flex-1">
        {/* Left Sidebar - Controls */}
        <motion.aside
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="w-80 border-r border-border/40 bg-sidebar flex flex-col"
        >
          <div className="p-6 space-y-6">
            {/* Device Selection */}
            <div>
              <label className="text-sm font-medium mb-2 block">Device</label>
              <Select 
                value={selectedDeviceId?.toString() || ''} 
                onValueChange={(value) => setSelectedDeviceId(parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select device" />
                </SelectTrigger>
                <SelectContent>
                  {devices.map(device => (
                    <SelectItem key={device.id} value={device.id.toString()}>
                      {device.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Range */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">From Date</label>
                <Input
                  type="datetime-local"
                  value={dayjs(dateRange.from).format('YYYY-MM-DDTHH:mm')}
                  onChange={(e) => setDateRange(prev => ({
                    ...prev,
                    from: new Date(e.target.value),
                  }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">To Date</label>
                <Input
                  type="datetime-local"
                  value={dayjs(dateRange.to).format('YYYY-MM-DDTHH:mm')}
                  onChange={(e) => setDateRange(prev => ({
                    ...prev,
                    to: new Date(e.target.value),
                  }))}
                />
              </div>
              <Button onClick={loadHistory} className="w-full" disabled={loading}>
                {loading ? 'Loading...' : 'Load History'}
              </Button>
            </div>

            {/* Current Position Info */}
            {currentPosition && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Current Position</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4" />
                    <span>{dayjs(currentPosition.deviceTime).format('MMM D, HH:mm:ss')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Navigation className="h-4 w-4" />
                    <span>{Math.round(currentPosition.speed)} km/h</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4" />
                    <span className="font-mono text-xs">
                      {currentPosition.latitude.toFixed(6)}, {currentPosition.longitude.toFixed(6)}
                    </span>
                  </div>
                  {currentPosition.address && (
                    <p className="text-xs text-muted-foreground">
                      {currentPosition.address}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Route Statistics */}
            {historicalPositions.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Route Statistics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Duration:</span>
                    <span className="font-medium">
                      {dayjs.duration(
                        new Date(historicalPositions[historicalPositions.length - 1].deviceTime).getTime() - 
                        new Date(historicalPositions[0].deviceTime).getTime()
                      ).humanize()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Points:</span>
                    <span className="font-medium">{historicalPositions.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Max Speed:</span>
                    <span className="font-medium">
                      {Math.max(...historicalPositions.map(p => p.speed)).toFixed(1)} km/h
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg Speed:</span>
                    <span className="font-medium">
                      {(historicalPositions.reduce((sum, p) => sum + p.speed, 0) / historicalPositions.length).toFixed(1)} km/h
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </motion.aside>

        {/* Map */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex-1 relative"
        >
          {currentPosition && selectedDevice ? (
            <MapView
              devices={[selectedDevice]}
              positions={[currentPosition]}
              selectedDeviceId={selectedDeviceId}
              onDeviceSelect={setSelectedDeviceId}
              alerts={[]}
            />
          ) : (
            <div className="h-full bg-muted/10 flex items-center justify-center">
              <div className="text-center">
                <Route className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-medium mb-2">No Route Data</h3>
                <p className="text-muted-foreground">
                  Select a device and date range to view history
                </p>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Playback Controls */}
      {historicalPositions.length > 0 && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="border-t border-border/40 bg-card/95 backdrop-blur-lg p-4"
        >
          <div className="flex items-center gap-4">
            {/* Playback Buttons */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={stepBackward}>
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={togglePlayback}>
                {playbackState.playing ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={stepForward}>
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>

            {/* Speed Control */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Speed:</span>
              <Select
                value={playbackState.speed.toString()}
                onValueChange={(value) => setPlaybackState(prev => ({
                  ...prev,
                  speed: parseFloat(value),
                }))}
              >
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.5">0.5x</SelectItem>
                  <SelectItem value="1">1x</SelectItem>
                  <SelectItem value="2">2x</SelectItem>
                  <SelectItem value="4">4x</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Progress Slider */}
            <div className="flex-1 mx-4">
              <Slider
                value={[playbackState.position]}
                onValueChange={([value]) => setPlaybackPosition(value)}
                max={playbackState.duration}
                step={1}
                className="w-full"
              />
            </div>

            {/* Time Display */}
            <div className="text-sm text-muted-foreground">
              {playbackState.position + 1} / {playbackState.duration + 1}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default History;