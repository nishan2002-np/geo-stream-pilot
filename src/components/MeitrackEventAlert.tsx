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
import { Device, Position, Alert as AlertType } from '@/types/tracking';

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
  onEventGenerated: (alert: AlertType) => void; // Add callback to send alerts to main alerts system
}

// Complete Meitrack event code mappings
const MEITRACK_EVENTS: Record<number, { name: string; severity: 'low' | 'medium' | 'high' | 'critical'; icon: any }> = {
  // Basic events
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
  
  // Extended Meitrack events
  46: { name: 'Panic Button', severity: 'critical', icon: Shield },
  47: { name: 'Remove Alert', severity: 'high', icon: AlertTriangle },
  48: { name: 'Low Battery', severity: 'medium', icon: Zap },
  49: { name: 'Vibration Alert', severity: 'medium', icon: AlertTriangle },
  50: { name: 'Maintenance Alert', severity: 'low', icon: Clock },
  51: { name: 'Towing Alert', severity: 'high', icon: AlertTriangle },
  52: { name: 'Door Open', severity: 'low', icon: Navigation },
  53: { name: 'Door Close', severity: 'low', icon: Navigation },
  54: { name: 'AC On', severity: 'low', icon: Zap },
  55: { name: 'AC Off', severity: 'low', icon: Zap },
  56: { name: 'Temperature Alert', severity: 'medium', icon: AlertTriangle },
  57: { name: 'Fuel Theft', severity: 'high', icon: Fuel },
  58: { name: 'Fuel Fill', severity: 'low', icon: Fuel },
  59: { name: 'GPS Lost', severity: 'medium', icon: Navigation },
  60: { name: 'GPS Recovered', severity: 'low', icon: Navigation },
  61: { name: 'Driver Card Inserted', severity: 'low', icon: Shield },
  62: { name: 'Driver Card Removed', severity: 'low', icon: Shield },
  63: { name: 'Phone Call Start', severity: 'low', icon: Clock },
  64: { name: 'Phone Call End', severity: 'low', icon: Clock },
  65: { name: 'RFID Card', severity: 'low', icon: Shield },
};

const MeitrackEventAlert: React.FC<MeitrackEventAlertProps> = ({
  devices,
  positions,
  onAcknowledge,
  onEventGenerated,
}) => {
  const [events, setEvents] = useState<MeitrackEvent[]>([]);
  const [lastPositionIds, setLastPositionIds] = useState<Map<number, number>>(new Map());
  const [eventCooldowns, setEventCooldowns] = useState<Map<string, number>>(new Map());

  // Monitor positions for Meitrack events - only trigger on position changes
  useEffect(() => {
    const checkForEvents = () => {
      const newEvents: MeitrackEvent[] = [];
      const currentTime = Date.now();

      positions.forEach(position => {
        const device = devices.find(d => d.id === position.deviceId);
        if (!device || position.protocol?.toLowerCase() !== 'meitrack') return;

        // Only process events if position actually changed
        const lastPositionId = lastPositionIds.get(device.id);
        if (lastPositionId === position.id) return; // No position change

        // Update last position ID
        setLastPositionIds(prev => new Map(prev).set(device.id, position.id));

        const attributes = position.attributes || {};

        // Check cooldown for this device
        const cooldownKey = `${device.id}`;
        const lastEventTime = eventCooldowns.get(cooldownKey);
        if (lastEventTime && currentTime - lastEventTime < 30000) return; // 30 second cooldown

        // Real Meitrack event from attributes
        if (attributes.event && MEITRACK_EVENTS[attributes.event]) {
          const eventCode = attributes.event;
          const eventInfo = MEITRACK_EVENTS[eventCode];
          
          const meitrackEvent = {
            id: `${device.id}-meitrack-${eventCode}-${currentTime}`,
            deviceId: device.id,
            deviceName: device.name,
            eventCode,
            eventName: eventInfo.name,
            message: `${eventInfo.name} - ${device.name} at ${position.address || 'Unknown location'}. Signal: ${attributes.gsm || 0}%, Speed: ${Math.round(position.speed)}km/h`,
            severity: eventInfo.severity,
            timestamp: new Date().toISOString(),
            position,
            acknowledged: false,
          };

          newEvents.push(meitrackEvent);

          // Convert to Alert for main system
          const alert: AlertType = {
            id: meitrackEvent.id,
            type: 'overspeed', // Map to closest type
            deviceId: device.id,
            deviceName: device.name,
            severity: eventInfo.severity,
            message: meitrackEvent.message,
            timestamp: meitrackEvent.timestamp,
            latitude: position.latitude,
            longitude: position.longitude,
            acknowledged: false,
            positionId: position.id,
            attributes: {
              eventCode,
              eventName: eventInfo.name,
              protocol: 'meitrack',
              ...attributes
            }
          };

          onEventGenerated(alert);
        }

        // Overspeed event (code 35) - only if actually overspeeding
        if (position.speed > 60) { // 60 km/h limit for Nepal roads
          const eventCode = 35;
          const meitrackEvent = {
            id: `${device.id}-overspeed-${currentTime}`,
            deviceId: device.id,
            deviceName: device.name,
            eventCode,
            eventName: 'Overspeed Alert',
            message: `Overspeed detected: ${Math.round(position.speed)} km/h at ${position.address || 'Unknown location'}`,
            severity: 'high' as const,
            timestamp: new Date().toISOString(),
            position,
            acknowledged: false,
          };

          newEvents.push(meitrackEvent);

          const alert: AlertType = {
            id: meitrackEvent.id,
            type: 'overspeed',
            deviceId: device.id,
            deviceName: device.name,
            severity: 'high',
            message: meitrackEvent.message,
            timestamp: meitrackEvent.timestamp,
            latitude: position.latitude,
            longitude: position.longitude,
            acknowledged: false,
            positionId: position.id,
            attributes: { eventCode: 35, protocol: 'meitrack' }
          };

          onEventGenerated(alert);
        }

        // Low fuel event (code 39) - but since all online devices should have 100% fuel, this is rare
        const fuelLevel = parseInt(attributes.fuel || '100');
        if (fuelLevel < 20) {
          const eventCode = 39;
          const meitrackEvent = {
            id: `${device.id}-lowfuel-${currentTime}`,
            deviceId: device.id,
            deviceName: device.name,
            eventCode,
            eventName: 'Low Fuel Warning',
            message: `Low fuel: ${fuelLevel}% remaining at ${position.address || 'Unknown location'}`,
            severity: 'medium' as const,
            timestamp: new Date().toISOString(),
            position,
            acknowledged: false,
          };

          newEvents.push(meitrackEvent);

          const alert: AlertType = {
            id: meitrackEvent.id,
            type: 'fuel',
            deviceId: device.id,
            deviceName: device.name,
            severity: 'medium',
            message: meitrackEvent.message,
            timestamp: meitrackEvent.timestamp,
            latitude: position.latitude,
            longitude: position.longitude,
            acknowledged: false,
            positionId: position.id,
            attributes: { eventCode: 39, protocol: 'meitrack' }
          };

          onEventGenerated(alert);
        }

        // Phone call event (code 63/64)
        if (attributes.phoneCall) {
          const eventCode = 63;
          const meitrackEvent = {
            id: `${device.id}-phonecall-${currentTime}`,
            deviceId: device.id,
            deviceName: device.name,
            eventCode,
            eventName: 'Phone Call Active',
            message: `Driver on phone call at ${position.address || 'Unknown location'}`,
            severity: 'low' as const,
            timestamp: new Date().toISOString(),
            position,
            acknowledged: false,
          };

          newEvents.push(meitrackEvent);

          const alert: AlertType = {
            id: meitrackEvent.id,
            type: 'network',
            deviceId: device.id,
            deviceName: device.name,
            severity: 'low',
            message: meitrackEvent.message,
            timestamp: meitrackEvent.timestamp,
            latitude: position.latitude,
            longitude: position.longitude,
            acknowledged: false,
            positionId: position.id,
            attributes: { eventCode: 63, protocol: 'meitrack' }
          };

          onEventGenerated(alert);
        }

        // Update cooldown
        if (newEvents.length > 0) {
          setEventCooldowns(prev => new Map(prev).set(cooldownKey, currentTime));
        }
      });

      // Add new events 
      if (newEvents.length > 0) {
        setEvents(prev => {
          const existingIds = new Set(prev.map(e => e.id));
          const uniqueNewEvents = newEvents.filter(e => !existingIds.has(e.id));
          return [...prev, ...uniqueNewEvents];
        });
      }
    };

    checkForEvents();
    const interval = setInterval(checkForEvents, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [devices, positions, onEventGenerated, lastPositionIds, eventCooldowns]);

  const unacknowledgedEvents = events.filter(e => !e.acknowledged);

  // Don't render the popup anymore - all events go to main alerts panel
  return null;
};

export default MeitrackEventAlert;