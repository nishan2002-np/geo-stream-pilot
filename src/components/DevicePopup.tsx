import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  X,
  MapPin,
  Clock,
  Navigation,
  Fuel,
  Battery,
  Signal,
  Satellite,
  Thermometer,
  Camera,
  Play,
  Download,
  ExternalLink,
} from 'lucide-react';
import { Device, Position } from '@/types/tracking';
import { resolveMediaUrl, getMockSnapshotUrl } from '@/utils/media';
import { getNetworkInfo } from '@/utils/geocoding';
import dayjs from 'dayjs';

interface DevicePopupProps {
  device: Device;
  position: Position;
  onClose: () => void;
  onViewDetails: (deviceId: number) => void;
}

const DevicePopup: React.FC<DevicePopupProps> = ({
  device,
  position,
  onClose,
  onViewDetails,
}) => {
  const [showAttributes, setShowAttributes] = useState(false);
  const [imageError, setImageError] = useState(false);

  const mediaInfo = resolveMediaUrl(position.attributes, position.id);
  const mockSnapshotUrl = getMockSnapshotUrl(device.id);

  // Get real values from server attributes
  const fuelLevel = parseInt(position.attributes?.fuel || position.attributes?.adc1 * 100 || '0');
  const batteryLevel = parseInt(position.attributes?.battery || position.attributes?.power || '0');
  const gsmSignal = parseInt(position.attributes?.gsm || position.attributes?.rssi || '0');
  const satellites = parseInt(position.attributes?.satellites || position.attributes?.sat || '0');
  const isOverspeed = position.speed > 20;
  
  const getFuelColor = (level: number) => {
    if (level > 60) return 'text-fuel-high';
    if (level > 30) return 'text-fuel-medium';
    return 'text-fuel-low';
  };

  const getSignalStrength = (signal: number) => {
    if (signal > 80) return { color: 'text-green-500', bars: 4, text: 'Excellent' };
    if (signal > 60) return { color: 'text-yellow-500', bars: 3, text: 'Good' };
    if (signal > 40) return { color: 'text-orange-500', bars: 2, text: 'Fair' };
    return { color: 'text-red-500', bars: 1, text: 'Poor' };
  };

  const signalInfo = getSignalStrength(gsmSignal);

  // Format attributes for display
  const formatAttributeValue = (key: string, value: any) => {
    if (typeof value === 'boolean') {
      return value ? '✓' : '✗';
    }
    if (typeof value === 'number') {
      if (key.includes('temp')) return `${value}°C`;
      if (key.includes('fuel') || key.includes('battery')) return `${value}%`;
      if (key.includes('speed')) return `${value} km/h`;
      return value.toString();
    }
    return String(value);
  };

  const importantAttributes = {
    'Protocol': position.protocol,
    'Ignition': position.attributes?.ignition ? '✓ ON' : '✗ OFF',
    'Fuel': `${fuelLevel}%`,
    'Battery': `${batteryLevel}%`,
    'GSM Signal': `${gsmSignal}% (${signalInfo.text})`,
    'Satellites': `${satellites} sats`,
    'Temperature': position.attributes?.temp1 ? `${position.attributes.temp1}°C` : 'N/A',
    'Network': position.network ? getNetworkInfo(position.network) : 'N/A',
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, x: -20 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.9, x: -20 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="w-80"
    >
      <Card className="shadow-xl border border-border/40 bg-card/95 backdrop-blur-lg">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg">{device.name}</CardTitle>
              <p className="text-sm text-muted-foreground">{device.uniqueId}</p>
            </div>
          <div className="flex items-center gap-2">
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
            {isOverspeed && (
              <Badge variant="destructive" className="animate-pulse">
                OVERSPEED!
              </Badge>
            )}
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Location Info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono text-xs">
                {position.latitude.toFixed(6)}, {position.longitude.toFixed(6)}
              </span>
            </div>
            {position.address && (
              <div className="pl-6 space-y-1">
                <p className="text-sm text-muted-foreground">
                  {position.address}
                </p>
                {position.attributes?.landmark && (
                  <p className="text-xs text-blue-500 font-medium">
                    📍 {position.attributes.landmark}
                  </p>
                )}
              </div>
            )}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <Navigation className={`h-4 w-4 ${isOverspeed ? 'text-red-500' : 'text-muted-foreground'}`} />
                <span className={isOverspeed ? 'text-red-500 font-bold' : ''}>{Math.round(position.speed)} km/h</span>
                {isOverspeed && <span className="text-red-500 text-xs">⚠️</span>}
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{dayjs(position.deviceTime).format('HH:mm:ss')}</span>
              </div>
              <div className="flex items-center gap-1">
                <Signal className={`h-4 w-4 ${signalInfo.color}`} />
                <div className="flex">
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className={`w-1 h-3 mr-0.5 ${i < signalInfo.bars ? signalInfo.color.replace('text-', 'bg-') : 'bg-gray-300'}`}
                      style={{ height: `${(i + 1) * 3}px` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <Fuel className={`h-4 w-4 ${getFuelColor(fuelLevel)}`} />
                <span className="text-sm font-medium">Fuel</span>
              </div>
              <Progress value={fuelLevel} className="h-2" />
              <span className="text-xs text-muted-foreground">{fuelLevel}%</span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <Battery className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Battery</span>
              </div>
              <Progress
                value={batteryLevel}
                className="h-2"
              />
              <span className="text-xs text-muted-foreground">
                {batteryLevel}%
              </span>
            </div>
          </div>

          {/* MDVR Media */}
          {(mediaInfo.url || device.attributes?.mdvrConnected) && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Camera Feed
              </h4>
              
              <div className="relative bg-muted/20 rounded-lg overflow-hidden">
                {!imageError && (mediaInfo.url || mockSnapshotUrl) ? (
                  <img
                    src={mediaInfo.url || mockSnapshotUrl}
                    alt="Device snapshot"
                    className="w-full h-32 object-cover"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <div className="w-full h-32 bg-muted/40 flex items-center justify-center">
                    <Camera className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                
                <div className="absolute bottom-2 left-2 right-2 flex justify-between">
                  <Badge variant="secondary" className="text-xs">
                    Live
                  </Badge>
                  <div className="flex gap-1">
                    {mediaInfo.isStream && (
                      <Button size="sm" variant="secondary" className="h-6 w-6 p-0">
                        <Play className="h-3 w-3" />
                      </Button>
                    )}
                    <Button size="sm" variant="secondary" className="h-6 w-6 p-0">
                      <Download className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Real-time Telemetry Grid */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Real-time Data</h4>
            <div className="grid grid-cols-1 gap-2 text-xs">
              {Object.entries(importantAttributes).map(([key, value]) => (
                <div key={key} className="flex justify-between items-center p-2 bg-muted/20 rounded">
                  <span className="text-muted-foreground">{key}:</span>
                  <span className={`font-medium ${
                    key === 'Fuel' && fuelLevel < 20 ? 'text-red-500' :
                    key === 'GSM Signal' && gsmSignal < 40 ? 'text-orange-500' :
                    key === 'Satellites' && satellites < 4 ? 'text-yellow-500' : ''
                  }`}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Attributes Toggle */}
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAttributes(!showAttributes)}
              className="w-full text-xs"
            >
              {showAttributes ? 'Hide' : 'Show'} All Attributes
            </Button>
            
            {showAttributes && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-muted/20 rounded-lg p-3 max-h-32 overflow-y-auto custom-scrollbar"
              >
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                  {JSON.stringify(position.attributes, null, 2)}
                </pre>
              </motion.div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={() => onViewDetails(device.id)}
              className="flex-1"
              size="sm"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              View Details
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                // Center map on device - this would be handled by parent
                onClose();
              }}
              size="sm"
            >
              <MapPin className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default DevicePopup;