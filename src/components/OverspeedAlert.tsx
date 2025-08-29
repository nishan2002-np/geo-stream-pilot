import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  AlertTriangle, 
  X, 
  MapPin,
  Clock,
  Gauge
} from 'lucide-react';
import { Device, Position } from '@/types/tracking';
import dayjs from 'dayjs';

interface OverspeedAlertProps {
  devices: Device[];
  positions: Position[];
  speedLimit?: number;
  onAcknowledge?: (deviceId: number) => void;
}

interface OverspeedEvent {
  deviceId: number;
  deviceName: string;
  speed: number;
  position: Position;
  timestamp: Date;
  acknowledged: boolean;
}

const OverspeedAlert: React.FC<OverspeedAlertProps> = ({
  devices,
  positions,
  speedLimit = 20,
  onAcknowledge,
}) => {
  const [overspeedEvents, setOverspeedEvents] = useState<OverspeedEvent[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Check for overspeed violations
  useEffect(() => {
    const newOverspeedEvents: OverspeedEvent[] = [];

    devices.forEach(device => {
      const position = positions.find(p => p.deviceId === device.id);
      if (position && position.speed > speedLimit) {
        // Check if we already have an unacknowledged event for this device
        const existingEvent = overspeedEvents.find(
          e => e.deviceId === device.id && !e.acknowledged
        );

        if (!existingEvent) {
          newOverspeedEvents.push({
            deviceId: device.id,
            deviceName: device.name,
            speed: position.speed,
            position,
            timestamp: new Date(),
            acknowledged: false,
          });

          // Play alert sound
          if (soundEnabled) {
            playAlertSound();
          }
        } else {
          // Update existing event with latest speed
          newOverspeedEvents.push({
            ...existingEvent,
            speed: position.speed,
            position,
          });
        }
      }
    });

    // Keep existing acknowledged events for a while
    const acknowledgedEvents = overspeedEvents.filter(e => e.acknowledged);
    setOverspeedEvents([...newOverspeedEvents, ...acknowledgedEvents]);
  }, [devices, positions, speedLimit, soundEnabled]);

  const playAlertSound = () => {
    try {
      // Create a simple beep sound
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch (error) {
      console.warn('Audio context not available:', error);
    }
  };

  const handleAcknowledge = (deviceId: number) => {
    setOverspeedEvents(events =>
      events.map(event =>
        event.deviceId === deviceId
          ? { ...event, acknowledged: true }
          : event
      )
    );
    onAcknowledge?.(deviceId);
  };

  const handleDismiss = (deviceId: number) => {
    setOverspeedEvents(events =>
      events.filter(event => event.deviceId !== deviceId)
    );
  };

  const activeAlerts = overspeedEvents.filter(e => !e.acknowledged);

  if (activeAlerts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      <AnimatePresence>
        {activeAlerts.map((event) => (
          <motion.div
            key={`overspeed-${event.deviceId}`}
            initial={{ opacity: 0, x: 300, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 300, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <Alert className="border-red-500 bg-red-50 dark:bg-red-950/20 shadow-lg">
              <AlertTriangle className="h-4 w-4 text-red-500 animate-pulse" />
              <div className="flex items-start justify-between w-full">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="destructive" className="animate-pulse">
                      OVERSPEED ALERT
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSoundEnabled(!soundEnabled)}
                      className="h-6 w-6 p-0"
                      title={soundEnabled ? 'Mute alerts' : 'Unmute alerts'}
                    >
                      {soundEnabled ? '🔊' : '🔇'}
                    </Button>
                  </div>
                  
                  <AlertDescription className="space-y-2">
                    <div className="font-medium text-red-700 dark:text-red-300">
                      {event.deviceName}
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Gauge className="h-4 w-4 text-red-500" />
                        <span className="font-bold text-red-600">
                          {Math.round(event.speed)} km/h
                        </span>
                        <span className="text-muted-foreground">
                          (limit: {speedLimit} km/h)
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{dayjs(event.timestamp).format('HH:mm:ss')}</span>
                    </div>
                    
                    {event.position.address && (
                      <div className="flex items-start gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-2">{event.position.address}</span>
                      </div>
                    )}
                    
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAcknowledge(event.deviceId)}
                        className="text-xs"
                      >
                        Acknowledge
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDismiss(event.deviceId)}
                        className="text-xs h-6 w-6 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </AlertDescription>
                </div>
              </div>
            </Alert>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default OverspeedAlert;
