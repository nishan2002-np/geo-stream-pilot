import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Search,
  Filter,
  Download,
  Calendar,
  AlertTriangle,
  Zap,
  Fuel,
  Navigation,
  Wifi,
  Cloud,
  Eye,
  CheckCircle,
} from 'lucide-react';
import { Alert } from '@/types/tracking';
import dayjs from 'dayjs';

const Events = () => {
  const [events, setEvents] = useState<Alert[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<Alert[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [dateRange, setDateRange] = useState('today');
  const [loading, setLoading] = useState(true);

  // Mock events data
  useEffect(() => {
    const generateMockEvents = (): Alert[] => {
      const eventTypes = ['overspeed', 'fuel', 'network', 'weather', 'geofence', 'sos'];
      const severities = ['low', 'medium', 'high', 'critical'];
      const devices = [
        { id: 1, name: 'Fleet Vehicle 001' },
        { id: 2, name: 'Delivery Truck 002' },
        { id: 3, name: 'Bus Route A' },
      ];

      const mockEvents: Alert[] = [];
      
      for (let i = 0; i < 50; i++) {
        const device = devices[Math.floor(Math.random() * devices.length)];
        const type = eventTypes[Math.floor(Math.random() * eventTypes.length)];
        const severity = severities[Math.floor(Math.random() * severities.length)];
        const timestamp = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);

        const messages = {
          overspeed: `Vehicle exceeding speed limit (${60 + Math.floor(Math.random() * 40)} km/h in 50 km/h zone)`,
          fuel: `Low fuel level detected (${Math.floor(Math.random() * 30)}% remaining)`,
          network: 'GPS signal lost - device offline',
          weather: 'Severe weather alert - heavy rainfall detected in area',
          geofence: 'Vehicle entered restricted zone',
          sos: 'Emergency SOS button activated by driver',
        };

        mockEvents.push({
          id: `event-${i}`,
          type: type as any,
          deviceId: device.id,
          deviceName: device.name,
          severity: severity as any,
          message: messages[type as keyof typeof messages],
          timestamp: timestamp.toISOString(),
          latitude: 27.7172 + (Math.random() - 0.5) * 0.1,
          longitude: 85.3240 + (Math.random() - 0.5) * 0.1,
          acknowledged: Math.random() > 0.3,
        });
      }

      return mockEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    };

    setEvents(generateMockEvents());
    setLoading(false);
  }, []);

  // Filter events
  useEffect(() => {
    let filtered = events;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(event =>
        event.deviceName.toLowerCase().includes(query) ||
        event.message.toLowerCase().includes(query) ||
        event.type.toLowerCase().includes(query)
      );
    }

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(event => event.type === typeFilter);
    }

    // Severity filter
    if (severityFilter !== 'all') {
      filtered = filtered.filter(event => event.severity === severityFilter);
    }

    // Date range filter
    const now = new Date();
    if (dateRange !== 'all') {
      let startDate: Date;
      switch (dateRange) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        default:
          startDate = new Date(0);
      }
      filtered = filtered.filter(event => new Date(event.timestamp) >= startDate);
    }

    setFilteredEvents(filtered);
  }, [events, searchQuery, typeFilter, severityFilter, dateRange]);

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'overspeed':
        return <Zap className="h-4 w-4" />;
      case 'fuel':
        return <Fuel className="h-4 w-4" />;
      case 'network':
        return <Wifi className="h-4 w-4" />;
      case 'weather':
        return <Cloud className="h-4 w-4" />;
      case 'geofence':
        return <Navigation className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-destructive';
      case 'high':
        return 'text-warning';
      case 'medium':
        return 'text-accent';
      default:
        return 'text-muted-foreground';
    }
  };

  const exportEvents = () => {
    const csvContent = [
      ['Timestamp', 'Device', 'Type', 'Severity', 'Message', 'Acknowledged'].join(','),
      ...filteredEvents.map(event => [
        dayjs(event.timestamp).format('YYYY-MM-DD HH:mm:ss'),
        event.deviceName,
        event.type,
        event.severity,
        `"${event.message}"`,
        event.acknowledged ? 'Yes' : 'No'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `events-${dayjs().format('YYYY-MM-DD')}.csv`;
    a.click();
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
              <h1 className="text-2xl font-bold">Events & Alerts</h1>
              <p className="text-sm text-muted-foreground">
                Showing {filteredEvents.length} of {events.length} events
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button onClick={exportEvents} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </motion.header>

      <div className="flex">
        {/* Filters Sidebar */}
        <motion.aside
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="w-80 border-r border-border/40 bg-sidebar"
        >
          <div className="p-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Filters</h3>
              
              <div className="space-y-4">
                {/* Search */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search events..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Date Range */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Date Range</label>
                  <Select value={dateRange} onValueChange={setDateRange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="week">Last 7 days</SelectItem>
                      <SelectItem value="month">This month</SelectItem>
                      <SelectItem value="all">All time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Event Type */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Event Type</label>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="overspeed">Overspeed</SelectItem>
                      <SelectItem value="fuel">Fuel</SelectItem>
                      <SelectItem value="network">Network</SelectItem>
                      <SelectItem value="weather">Weather</SelectItem>
                      <SelectItem value="geofence">Geofence</SelectItem>
                      <SelectItem value="sos">SOS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Severity */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Severity</label>
                  <Select value={severityFilter} onValueChange={setSeverityFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Severities</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Statistics */}
            <div>
              <h4 className="text-sm font-medium mb-3">Statistics</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Total Events:</span>
                  <span className="font-medium">{events.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Unacknowledged:</span>
                  <span className="font-medium text-warning">
                    {events.filter(e => !e.acknowledged).length}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Critical:</span>
                  <span className="font-medium text-destructive">
                    {events.filter(e => e.severity === 'critical').length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.aside>

        {/* Events List */}
        <motion.main
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex-1"
        >
          <ScrollArea className="h-[calc(100vh-80px)] custom-scrollbar">
            <div className="p-6 space-y-4">
              {loading ? (
                // Loading skeletons
                Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="h-20 bg-muted/20 rounded-lg animate-pulse" />
                ))
              ) : filteredEvents.length === 0 ? (
                <div className="text-center py-12">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No events found</h3>
                  <p className="text-muted-foreground">
                    Try adjusting your filters or date range
                  </p>
                </div>
              ) : (
                filteredEvents.map((event, index) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card
                      className={`transition-all duration-200 hover:shadow-lg cursor-pointer ${
                        event.acknowledged 
                          ? 'bg-muted/20 border-border/40' 
                          : 'bg-card border-warning/40'
                      } ${
                        event.severity === 'critical' && !event.acknowledged
                          ? 'ring-1 ring-destructive/30'
                          : ''
                      }`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className={`mt-1 ${getSeverityColor(event.severity)}`}>
                            {getEventIcon(event.type)}
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-3">
                                <h3 className="font-medium">{event.deviceName}</h3>
                                <Badge
                                  variant="outline"
                                  className={`text-xs ${
                                    event.severity === 'critical' ? 'border-destructive text-destructive' :
                                    event.severity === 'high' ? 'border-warning text-warning' :
                                    event.severity === 'medium' ? 'border-accent text-accent' :
                                    'border-muted text-muted-foreground'
                                  }`}
                                >
                                  {event.severity}
                                </Badge>
                                <Badge variant="outline" className="text-xs capitalize">
                                  {event.type}
                                </Badge>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                {event.acknowledged && (
                                  <CheckCircle className="h-4 w-4 text-success" />
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    // Navigate to device view
                                    window.location.href = `/device/${event.deviceId}`;
                                  }}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            
                            <p className="text-sm text-muted-foreground mb-3">
                              {event.message}
                            </p>
                            
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                <span>{dayjs(event.timestamp).format('MMM D, YYYY HH:mm:ss')}</span>
                              </div>
                              <span>{dayjs(event.timestamp).fromNow()}</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))
              )}
            </div>
          </ScrollArea>
        </motion.main>
      </div>
    </div>
  );
};

export default Events;