import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle, 
  Shield, 
  Zap, 
  Fuel, 
  Navigation,
  Clock,
  X,
  Volume2,
  VolumeX
} from 'lucide-react';
import { Device, Position } from '@/types/tracking';

interface MeitrackEvent {
  id: string;
  deviceId: number;
  deviceName: string;
  eventCode: number;
  eventName: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  position?: Position;
  acknowledged: boolean;
}

interface MeitrackEventAlertProps {
  devices: Device[];
  positions: Position[];
  onAcknowledge: (eventId: string) => void;
}

// Meitrack event code mappings
const MEITRACK_EVENTS: Record<number, { name: string; severity: 'low' | 'medium' | 'high' | 'critical'; icon: any }> = {
  35: { name: 'Overspeed Alert', severity: 'high', icon: AlertTriangle },
  36: { name: 'Geofence Exit', severity: 'medium', icon: Navigation },
  37: { name: 'Geofence Entry', severity: 'low', icon: Navigation },
  38: { name: 'SOS Emergency', severity: 'critical', icon: Shield },
  39: { name: 'Low Fuel Warning', severity: 'medium', icon: Fuel },
  40: { name: 'Battery Disconnect', severity: 'high', icon: Zap },
  41: { name: 'Ignition On', severity: 'low', icon: Zap },
  42: { name: 'Ignition Off', severity: 'low', icon: Zap },
  43: { name: 'Harsh Braking', severity: 'medium', icon: AlertTriangle },
  44: { name: 'Harsh Acceleration', severity: 'medium', icon: AlertTriangle },
  45: { name: 'Harsh Cornering', severity: 'medium', icon: AlertTriangle },
};

const MeitrackEventAlert: React.FC<MeitrackEventAlertProps> = ({
  devices,
  positions,
  onAcknowledge,
}) => {
  const [events, setEvents] = useState<MeitrackEvent[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Monitor positions for Meitrack events
  useEffect(() => {
    const checkForEvents = () => {
      const newEvents: MeitrackEvent[] = [];

      positions.forEach(position => {
        const device = devices.find(d => d.id === position.deviceId);
        if (!device || position.protocol?.toLowerCase() !== 'meitrack') return;

        // Check for various event conditions
        const attributes = position.attributes || {};

        // Overspeed event (code 35)
        if (position.speed > 80) { // 80 km/h speed limit
          newEvents.push({
            id: `${device.id}-overspeed-${Date.now()}`,
            deviceId: device.id,
            deviceName: device.name,
            eventCode: 35,
            eventName: 'Overspeed Alert',
            message: `Vehicle exceeding speed limit: ${Math.round(position.speed)} km/h`,
            severity: 'high',
            timestamp: new Date().toISOString(),
            position,
            acknowledged: false,
          });
        }

        // Low fuel event (code 39)
        const fuelLevel = parseInt(attributes.fuel || '100');
        if (fuelLevel < 20) {
          newEvents.push({
            id: `${device.id}-lowfuel-${Date.now()}`,
            deviceId: device.id,
            deviceName: device.name,
            eventCode: 39,
            eventName: 'Low Fuel Warning',
            message: `Low fuel level detected: ${fuelLevel}% remaining`,
            severity: 'medium',
            timestamp: new Date().toISOString(),
            position,
            acknowledged: false,
          });
        }

        // Ignition events (codes 41, 42)
        if (attributes.ignition !== undefined) {
          const eventCode = attributes.ignition ? 41 : 42;
          const eventName = attributes.ignition ? 'Ignition On' : 'Ignition Off';
          
          // Only create event if it's a recent change
          const lastEventTime = localStorage.getItem(`last-ignition-${device.id}`);
          const currentTime = Date.now();
          
          if (!lastEventTime || currentTime - parseInt(lastEventTime) > 60000) { // 1 minute cooldown
            newEvents.push({
              id: `${device.id}-ignition-${currentTime}`,
              deviceId: device.id,
              deviceName: device.name,
              eventCode,
              eventName,
              message: `Vehicle ignition ${attributes.ignition ? 'turned on' : 'turned off'}`,
              severity: 'low',
              timestamp: new Date().toISOString(),
              position,
              acknowledged: false,
            });
            
            localStorage.setItem(`last-ignition-${device.id}`, currentTime.toString());
          }
        }

        // Check for custom event codes in attributes
        Object.keys(attributes).forEach(key => {
          if (key.startsWith('event') && MEITRACK_EVENTS[parseInt(attributes[key])]) {
            const eventCode = parseInt(attributes[key]);
            const eventInfo = MEITRACK_EVENTS[eventCode];
            
            newEvents.push({
              id: `${device.id}-event${eventCode}-${Date.now()}`,
              deviceId: device.id,
              deviceName: device.name,
              eventCode,
              eventName: eventInfo.name,
              message: `${eventInfo.name} detected for ${device.name}`,
              severity: eventInfo.severity,
              timestamp: new Date().toISOString(),
              position,
              acknowledged: false,
            });
          }
        });
      });

      // Add new events and play sound
      if (newEvents.length > 0) {
        setEvents(prev => {
          const existingIds = new Set(prev.map(e => e.id));
          const uniqueNewEvents = newEvents.filter(e => !existingIds.has(e.id));
          
          if (uniqueNewEvents.length > 0 && soundEnabled) {
            playAlertSound();
          }
          
          return [...prev, ...uniqueNewEvents];
        });
      }
    };

    checkForEvents();
    const interval = setInterval(checkForEvents, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [devices, positions, soundEnabled]);

  const playAlertSound = () => {
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt2Yo9CRxivO3SgSoFKIPP8NuTQQwXZrmPrJBhNjVgodDbq2EcBj+a2/LDecUFLIHO8tiJOAgZaLvt2Yo9CRxivO3SgSoFKIPP8NuTQQwXZrmPrJBhNjVgodDbq2EcBj+a2/LDecUFLIHO8tiJOAgZaLvt2Yo9CRxivO3SgSoFKIPP8NuTQQwXZrmPrJBhNjVgodDbq2EcBj+a2/LDecUFLIHO8tiJOAgZaLvt2Yo9CRxivO3SgSoFKIPP8NuTQQwXZrmPrJBhNjVgodDbq2EcBj+a2/LDecUFLIHO8tiJOAgZaLvt2Yo9CRxivO3SgSoFKIPP8NuTQQwXZrk=');
      audio.volume = 0.3;
      audio.play().catch(console.error);
    } catch (error) {
      console.error('Failed to play alert sound:', error);
    }
  };

  const getSeverityColor = (severity: 'low' | 'medium' | 'high' | 'critical'): "default" | "destructive" => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'default';
    }
  };

  const getEventIcon = (eventCode: number) => {
    const eventInfo = MEITRACK_EVENTS[eventCode];
    if (eventInfo?.icon) {
      const IconComponent = eventInfo.icon;
      return <IconComponent className="h-4 w-4" />;
    }
    return <AlertTriangle className="h-4 w-4" />;
  };

  const handleAcknowledge = (eventId: string) => {
    setEvents(prev => prev.map(event => 
      event.id === eventId 
        ? { ...event, acknowledged: true }
        : event
    ));
    onAcknowledge(eventId);
  };

  const unacknowledgedEvents = events.filter(e => !e.acknowledged);

  if (unacknowledgedEvents.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-50 space-y-2 max-w-sm">
      <div className="flex items-center justify-between mb-2">
        <Badge variant="destructive" className="animate-pulse">
          {unacknowledgedEvents.length} New Events
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="h-6 w-6 p-0"
        >
          {soundEnabled ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
        </Button>
      </div>

      <AnimatePresence>
        {unacknowledgedEvents.slice(0, 5).map((event) => (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, x: 300, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 300, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            <Alert variant={getSeverityColor(event.severity)} className="border-l-4 shadow-lg">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-2">
                  {getEventIcon(event.eventCode)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        Code {event.eventCode}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {event.severity.toUpperCase()}
                      </Badge>
                    </div>
                    <AlertDescription className="text-sm">
                      <div className="font-medium">{event.deviceName}</div>
                      <div>{event.message}</div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <Clock className="h-3 w-3" />
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </div>
                    </AlertDescription>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleAcknowledge(event.id)}
                  className="h-6 w-6 p-0 ml-2"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </Alert>
          </motion.div>
        ))}
      </AnimatePresence>

      {unacknowledgedEvents.length > 5 && (
        <div className="text-center">
          <Badge variant="outline" className="text-xs">
            +{unacknowledgedEvents.length - 5} more events
          </Badge>
        </div>
      )}
    </div>
  );
};

export default MeitrackEventAlert;