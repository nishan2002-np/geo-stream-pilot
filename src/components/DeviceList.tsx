import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Smartphone,
  Truck,
  Car,
  Bus,
  MoreVertical,
  MapPin,
  Clock,
  Battery,
  Fuel,
  Signal,
} from 'lucide-react';
import { Device, Position } from '@/types/tracking';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

interface DeviceListProps {
  devices: Device[];
  positions: Position[];
  selectedDeviceId: number | null;
  onDeviceSelect: (deviceId: number | null) => void;
  searchQuery: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  loading: boolean;
}

const DeviceList: React.FC<DeviceListProps> = ({
  devices,
  positions,
  selectedDeviceId,
  onDeviceSelect,
  searchQuery,
  collapsed,
  onToggleCollapse,
  loading,
}) => {
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [protocolFilter, setProtocolFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'lastUpdate' | 'status'>('name');

  // Get device position
  const getDevicePosition = (device: Device) => {
    return positions.find(p => p.deviceId === device.id);
  };

  // Filter and sort devices
  const filteredDevices = useMemo(() => {
    let filtered = devices.filter(device => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !device.name.toLowerCase().includes(query) &&
          !device.uniqueId.toLowerCase().includes(query) &&
          !device.contact?.toLowerCase().includes(query)
        ) {
          return false;
        }
      }

      // Status filter
      if (statusFilter.length > 0 && !statusFilter.includes(device.status)) {
        return false;
      }

      // Protocol filter
      const position = getDevicePosition(device);
      if (protocolFilter !== 'all' && position?.protocol !== protocolFilter) {
        return false;
      }

      return true;
    });

    // Sort devices
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'lastUpdate':
          return new Date(b.lastUpdate).getTime() - new Date(a.lastUpdate).getTime();
         case 'status':
           const statusOrder = { moving: 0, stopped: 1, offline: 2 };
           return (statusOrder[a.status as keyof typeof statusOrder] || 3) - 
                  (statusOrder[b.status as keyof typeof statusOrder] || 3);
        default:
          return 0;
      }
    });

    return filtered;
  }, [devices, positions, searchQuery, statusFilter, protocolFilter, sortBy]);

  const getDeviceIcon = (category?: string) => {
    switch (category) {
      case 'truck':
        return <Truck className="h-4 w-4" />;
      case 'bus':
        return <Bus className="h-4 w-4" />;
      case 'bike':
        return <Smartphone className="h-4 w-4" />;
      default:
        return <Car className="h-4 w-4" />;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'moving':
        return 'badge-moving';
      case 'stopped':
        return 'badge-idle';
      case 'offline':
        return 'badge-offline';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getAttributeValue = (position: Position | undefined, key: string, defaultValue: string = '-') => {
    if (!position?.attributes) return defaultValue;
    const value = position.attributes[key];
    return value !== undefined ? String(value) : defaultValue;
  };

  // Real fuel calculation for 260L capacity with TODAY'S odometer-based consumption only
  const getFuelData = (position: Position | undefined) => {
    if (!position) return { liters: 260, odometer: 0, todayOdometer: 0 };
    
    const totalOdometer = parseInt(getAttributeValue(position, 'odometer', '0'));
    const todayOdometer = parseInt(getAttributeValue(position, 'todayOdometer', '0'));
    const fuelUsed = Math.floor(todayOdometer / 8); // 8km per 1L (TODAY'S consumption only)
    const actualLiters = Math.max(0, 260 - fuelUsed); // 260L capacity
    
    return {
      liters: actualLiters,
      odometer: totalOdometer,
      todayOdometer: todayOdometer
    };
  };

  const formatLastUpdate = (lastUpdate: string) => {
    return dayjs(lastUpdate).fromNow();
  };

  if (collapsed) {
    return (
      <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
        <div className="p-4 border-b border-sidebar-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCollapse}
            className="w-full"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-2">
            {filteredDevices.slice(0, 10).map((device) => (
              <motion.div
                key={device.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  variant={selectedDeviceId === device.id ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => onDeviceSelect(device.id)}
                  className="w-full h-12 p-0 flex flex-col items-center justify-center"
                >
                  {getDeviceIcon(device.category)}
                  <div className={`w-2 h-2 rounded-full mt-1 ${getStatusBadgeClass(device.status)}`} />
                </Button>
              </motion.div>
            ))}
          </div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Devices</h2>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {filteredDevices.length}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleCollapse}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or ID..."
              value={searchQuery}
              onChange={(e) => onDeviceSelect(null)} // Reset selection on search
              className="pl-10 bg-background/50"
            />
          </div>

          <div className="flex gap-2">
            <Select value={protocolFilter} onValueChange={setProtocolFilter}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Protocol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Protocols</SelectItem>
                <SelectItem value="meitrack">Meitrack</SelectItem>
                <SelectItem value="teltonika">Teltonika</SelectItem>
                <SelectItem value="ruptela">Ruptela</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(value) => setSortBy(value as any)}>
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="lastUpdate">Last Update</SelectItem>
                <SelectItem value="status">Status</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status filters */}
          <div className="flex gap-1 text-xs">
            {['moving', 'stopped', 'offline'].map((status) => (
              <Button
                key={status}
                variant={statusFilter.includes(status) ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setStatusFilter(prev =>
                    prev.includes(status)
                      ? prev.filter(s => s !== status)
                      : [...prev, status]
                  );
                }}
                className="h-6 px-2 text-xs capitalize"
              >
                {status}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Device List */}
      <ScrollArea className="flex-1 custom-scrollbar">
        <div className="p-2 space-y-2">
          <AnimatePresence>
            {loading ? (
              // Loading skeletons
              Array.from({ length: 5 }).map((_, i) => (
                <div key={`skeleton-${i}`} className="h-24 bg-muted/20 rounded-lg animate-pulse" />
              ))
            ) : filteredDevices.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-8 text-muted-foreground"
              >
                <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No devices found</p>
              </motion.div>
            ) : (
              filteredDevices.map((device, index) => {
                const position = getDevicePosition(device);
                const isSelected = selectedDeviceId === device.id;

                return (
                  <motion.div
                    key={device.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Link to={`/vehicle/${device.id}`} key={device.id}>
                      <Card
                        className={`cursor-pointer transition-all duration-200 hover:shadow-lg border ${
                          isSelected
                            ? 'ring-2 ring-primary bg-primary/5 border-primary'
                            : 'border-border/40 hover:border-primary/40'
                        }`}
                        onClick={() => onDeviceSelect(device.id)}
                      >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {getDeviceIcon(device.category)}
                            <div>
                              <h3 className="font-medium text-sm truncate max-w-[140px]">
                                {device.name}
                              </h3>
                              <p className="text-xs text-muted-foreground">
                                {device.uniqueId}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Badge
                              variant="outline"
                              className={`text-xs ${getStatusBadgeClass(device.status)}`}
                            >
                              {device.status}
                            </Badge>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                              <MoreVertical className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>{formatLastUpdate(device.lastUpdate)}</span>
                            </div>
                            {position && (
                              <span className="text-muted-foreground">
                                {Math.round(position.speed)} km/h
                              </span>
                            )}
                          </div>

                          {position && (
                            <>
                              <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                               {(() => {
                                 const fuelData = getFuelData(position);
                                 const batteryLevel = parseInt(getAttributeValue(position, 'battery', '100'));
                                 const signalStrength = parseInt(getAttributeValue(position, 'gsm', '95'));
                                 const protocol = position?.protocol?.toLowerCase();
                                 
                                 return (
                                   <>
                                      <div className={`flex items-center gap-1 ${device.status === 'moving' ? 'text-red-400 animate-pulse' : ''}`}>
                                        <Fuel className="h-3 w-3 text-fuel-medium" />
                                        <span>{fuelData.liters}L</span>
                                      </div>
                                     <div className="flex items-center gap-1">
                                       <Battery className="h-3 w-3 text-primary" />
                                       <span>{batteryLevel}%</span>
                                     </div>
                                     <div className="flex items-center gap-1">
                                       <Signal className="h-3 w-3 text-accent" />
                                       <span>{protocol === 'meitrack' ? 'WiFi' : 'GSM'} {signalStrength}%</span>
                                     </div>
                                   </>
                                 );
                               })()}
                              </div>
                              
                               {/* Address and Network */}
                               {position.address && (
                                 <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                   <MapPin className="h-3 w-3 flex-shrink-0" />
                                   <span>{position.address}</span>
                                 </div>
                               )}
                               
                               {/* Network Type for Meitrack */}
                               {position?.protocol?.toLowerCase() === 'meitrack' && (
                                 <div className="text-xs text-muted-foreground flex items-center gap-1">
                                   <span>📶</span>
                                   <span>Ntc router</span>
                                 </div>
                               )}
                            </>
                          )}

                          {device.contact && (
                            <p className="text-muted-foreground text-xs truncate">
                              {device.contact}
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </ScrollArea>
    </div>
  );
};

export default DeviceList;