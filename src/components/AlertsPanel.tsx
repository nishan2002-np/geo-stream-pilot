import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  Zap,
  Fuel,
  Wifi,
  Cloud,
  Navigation,
  CheckCircle,
  X,
  Bell,
  BellOff,
  Filter,
  Download,
  Eye,
} from 'lucide-react';
import { Alert } from '@/types/tracking';
import dayjs from 'dayjs';

interface AlertsPanelProps {
  alerts: Alert[];
  onAcknowledge: (alertId: string) => void;
  onViewDevice: (deviceId: number) => void;
}

const AlertsPanel: React.FC<AlertsPanelProps> = ({
  alerts,
  onAcknowledge,
  onViewDevice,
}) => {
  const [filter, setFilter] = useState<{
    severity: string[];
    type: string[];
    acknowledged: boolean | null;
  }>({
    severity: [],
    type: [],
    acknowledged: null,
  });
  const [soundEnabled, setSoundEnabled] = useState(true);

  const getAlertIcon = (type: string, severity: string) => {
    const iconClass = severity === 'critical' ? 'text-destructive' :
                     severity === 'high' ? 'text-warning' :
                     severity === 'medium' ? 'text-accent' : 'text-muted-foreground';

    switch (type) {
      case 'overspeed':
        return <Zap className={`h-4 w-4 ${iconClass}`} />;
      case 'fuel':
        return <Fuel className={`h-4 w-4 ${iconClass}`} />;
      case 'network':
        return <Wifi className={`h-4 w-4 ${iconClass}`} />;
      case 'weather':
        return <Cloud className={`h-4 w-4 ${iconClass}`} />;
      case 'geofence':
        return <Navigation className={`h-4 w-4 ${iconClass}`} />;
      case 'sos':
        return <AlertTriangle className={`h-4 w-4 ${iconClass}`} />;
      default:
        return <AlertCircle className={`h-4 w-4 ${iconClass}`} />;
    }
  };

  const getSeverityBadgeClass = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'high':
        return 'bg-warning/10 text-warning border-warning/20';
      case 'medium':
        return 'bg-accent/10 text-accent border-accent/20';
      default:
        return 'bg-muted/10 text-muted-foreground border-muted/20';
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    if (filter.severity.length > 0 && !filter.severity.includes(alert.severity)) {
      return false;
    }
    if (filter.type.length > 0 && !filter.type.includes(alert.type)) {
      return false;
    }
    if (filter.acknowledged !== null && alert.acknowledged !== filter.acknowledged) {
      return false;
    }
    return true;
  });

  const unacknowledgedCount = alerts.filter(a => !a.acknowledged).length;
  const criticalCount = alerts.filter(a => a.severity === 'critical' && !a.acknowledged).length;

  const alertTypes = ['overspeed', 'fuel', 'network', 'weather', 'geofence', 'sos', 'battery'];
  const severityLevels = ['low', 'medium', 'high', 'critical'];

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <h2 className="text-lg font-semibold">Alerts</h2>
            {unacknowledgedCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {unacknowledgedCount}
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSoundEnabled(!soundEnabled)}
            >
              {soundEnabled ? (
                <Bell className="h-4 w-4" />
              ) : (
                <BellOff className="h-4 w-4" />
              )}
            </Button>
            <Button variant="ghost" size="sm">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-background/20 rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-destructive">{criticalCount}</div>
            <div className="text-xs text-muted-foreground">Critical</div>
          </div>
          <div className="bg-background/20 rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-warning">
              {alerts.filter(a => a.severity === 'high' && !a.acknowledged).length}
            </div>
            <div className="text-xs text-muted-foreground">High</div>
          </div>
        </div>

        {/* Filters */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <Filter className="h-3 w-3" />
            <span>Quick Filters:</span>
          </div>
          
          <div className="flex flex-wrap gap-1">
            <Button
              variant={filter.acknowledged === false ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(prev => ({ 
                ...prev, 
                acknowledged: prev.acknowledged === false ? null : false 
              }))}
              className="h-6 px-2 text-xs"
            >
              Unack.
            </Button>
            <Button
              variant={filter.severity.includes('critical') ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(prev => ({
                ...prev,
                severity: prev.severity.includes('critical') 
                  ? prev.severity.filter(s => s !== 'critical')
                  : [...prev.severity, 'critical']
              }))}
              className="h-6 px-2 text-xs"
            >
              Critical
            </Button>
            <Button
              variant={filter.type.includes('overspeed') ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(prev => ({
                ...prev,
                type: prev.type.includes('overspeed')
                  ? prev.type.filter(t => t !== 'overspeed')
                  : [...prev.type, 'overspeed']
              }))}
              className="h-6 px-2 text-xs"
            >
              Speed
            </Button>
          </div>
        </div>
      </div>

      {/* Alerts List */}
      <ScrollArea className="flex-1 custom-scrollbar">
        <div className="p-2 space-y-2">
          <AnimatePresence>
            {filteredAlerts.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-8 text-muted-foreground"
              >
                <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No alerts to display</p>
              </motion.div>
            ) : (
              filteredAlerts.map((alert, index) => (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ scale: 1.02 }}
                >
                  <Card
                    className={`cursor-pointer border transition-all duration-200 hover:shadow-md ${
                      alert.acknowledged 
                        ? 'bg-muted/20 border-border/40' 
                        : 'bg-card border-warning/40 shadow-sm'
                    } ${
                      alert.severity === 'critical' && !alert.acknowledged
                        ? 'ring-1 ring-destructive/30'
                        : ''
                    }`}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                          {getAlertIcon(alert.type, alert.severity)}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className={`text-xs ${getSeverityBadgeClass(alert.severity)}`}
                              >
                                {alert.severity}
                              </Badge>
                              <Badge variant="outline" className="text-xs capitalize">
                                {alert.type}
                              </Badge>
                            </div>
                            {alert.acknowledged && (
                              <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
                            )}
                          </div>
                          
                          <h4 className="font-medium text-sm mb-1 truncate">
                            {alert.deviceName}
                          </h4>
                          
                          <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                            {alert.message}
                          </p>
                          
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{dayjs(alert.timestamp).format('MMM D, HH:mm')}</span>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onViewDevice(alert.deviceId);
                                }}
                                className="h-6 w-6 p-0"
                              >
                                <Eye className="h-3 w-3" />
                              </Button>
                              {!alert.acknowledged && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onAcknowledge(alert.id);
                                  }}
                                  className="h-6 w-6 p-0"
                                >
                                  <CheckCircle className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </ScrollArea>

      {/* Action Bar */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const unacknowledged = filteredAlerts.filter(a => !a.acknowledged);
              unacknowledged.forEach(alert => onAcknowledge(alert.id));
            }}
            disabled={filteredAlerts.filter(a => !a.acknowledged).length === 0}
            className="flex-1"
          >
            Ack All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilter({ severity: [], type: [], acknowledged: null })}
            className="flex-1"
          >
            Clear Filters
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AlertsPanel;