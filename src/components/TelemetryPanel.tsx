import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  X,
  Gauge,
  Fuel,
  Battery,
  Thermometer,
  Signal,
  Navigation,
  Clock,
  TrendingUp,
  Zap,
  MoreVertical,
} from 'lucide-react';
import { Device, Position } from '@/types/tracking';
import dayjs from 'dayjs';

interface TelemetryPanelProps {
  device: Device;
  position: Position;
  onClose: () => void;
}

const TelemetryPanel: React.FC<TelemetryPanelProps> = ({
  device,
  position,
  onClose,
}) => {
  const [historicalData, setHistoricalData] = useState<any[]>([]);

  // Generate mock historical data for charts
  useEffect(() => {
    const generateMockData = () => {
      const data = [];
      const now = new Date();
      
      for (let i = 19; i >= 0; i--) {
        const timestamp = new Date(now.getTime() - i * 5 * 60 * 1000); // 5 minute intervals
        data.push({
          time: dayjs(timestamp).format('HH:mm'),
          speed: Math.max(0, position.speed + (Math.random() - 0.5) * 20),
          fuel: Math.max(10, (position.attributes?.fuel || 50) + (Math.random() - 0.5) * 10),
          battery: Math.max(0, (position.attributes?.battery || 80) + (Math.random() - 0.5) * 5),
          temperature: (position.attributes?.temp1 || 25) + (Math.random() - 0.5) * 10,
        });
      }
      return data;
    };

    setHistoricalData(generateMockData());
  }, [device.id, position]);

  // Current telemetry values
  const telemetry = {
    speed: Math.round(position.speed),
    fuel: parseInt(position.attributes?.fuel || '0'),
    battery: parseInt(position.attributes?.battery || '0'),
    temperature: position.attributes?.temp1 || 25,
    gsm: parseInt(position.attributes?.gsm || '0'),
    satellites: parseInt(position.attributes?.satellites || '0'),
    ignition: position.attributes?.ignition || false,
    course: Math.round(position.course),
    altitude: Math.round(position.altitude),
  };

  // Gauge component for circular displays
  const CircularGauge = ({ 
    value, 
    max, 
    label, 
    unit, 
    color, 
    icon: Icon 
  }: { 
    value: number; 
    max: number; 
    label: string; 
    unit: string; 
    color: string; 
    icon: any; 
  }) => {
    const percentage = Math.min((value / max) * 100, 100);
    const data = [
      { name: 'Value', value: percentage, fill: color },
      { name: 'Empty', value: 100 - percentage, fill: 'hsl(var(--muted))' },
    ];

    return (
      <div className="flex flex-col items-center">
        <div className="relative w-16 h-16">
          <PieChart width={64} height={64}>
            <Pie
              data={data}
              cx={32}
              cy={32}
              innerRadius={20}
              outerRadius={30}
              startAngle={90}
              endAngle={-270}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
          </PieChart>
          <div className="absolute inset-0 flex items-center justify-center">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
        <div className="text-center mt-1">
          <div className="text-sm font-medium">{value}{unit}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 20, opacity: 0 }}
      className="h-64 border-t border-border/40 bg-card/95 backdrop-blur-lg"
    >
      <div className="flex h-full">
        {/* Device Info */}
        <div className="w-64 border-r border-border/40 p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-sm">{device.name}</h3>
              <p className="text-xs text-muted-foreground">{device.uniqueId}</p>
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

          {/* Live Metrics */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-primary" />
                <span>Speed</span>
              </div>
              <span className="font-medium">{telemetry.speed} km/h</span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Navigation className="h-4 w-4 text-accent" />
                <span>Course</span>
              </div>
              <span className="font-medium">{telemetry.course}°</span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-warning" />
                <span>Ignition</span>
              </div>
              <span className={`font-medium ${telemetry.ignition ? 'text-success' : 'text-muted-foreground'}`}>
                {telemetry.ignition ? 'ON' : 'OFF'}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Signal className="h-4 w-4 text-blue-400" />
                <span>Satellites</span>
              </div>
              <span className="font-medium">{telemetry.satellites}</span>
            </div>

            <div className="text-xs text-muted-foreground pt-2 border-t border-border/40">
              Last update: {dayjs(position.deviceTime).format('MMM D, HH:mm:ss')}
            </div>
          </div>
        </div>

        {/* Circular Gauges */}
        <div className="w-80 p-4">
          <h4 className="text-sm font-medium mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Live Telemetry
          </h4>
          
          <div className="grid grid-cols-4 gap-4">
            <CircularGauge
              value={telemetry.fuel}
              max={100}
              label="Fuel"
              unit="%"
              color="hsl(var(--fuel-medium))"
              icon={Fuel}
            />
            <CircularGauge
              value={telemetry.battery}
              max={100}
              label="Battery"
              unit="%"
              color="hsl(var(--primary))"
              icon={Battery}
            />
            <CircularGauge
              value={telemetry.gsm}
              max={100}
              label="Signal"
              unit="%"
              color="hsl(var(--accent))"
              icon={Signal}
            />
            <CircularGauge
              value={telemetry.temperature}
              max={60}
              label="Temp"
              unit="°C"
              color="hsl(var(--warning))"
              icon={Thermometer}
            />
          </div>

          {/* Progress Bars */}
          <div className="mt-4 space-y-2">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Fuel Level</span>
                <span>{telemetry.fuel}%</span>
              </div>
              <Progress value={telemetry.fuel} className="h-2" />
            </div>
            
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Battery</span>
                <span>{telemetry.battery}%</span>
              </div>
              <Progress value={telemetry.battery} className="h-2" />
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="flex-1 p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium">Historical Data (Last 2 Hours)</h4>
            <Button variant="ghost" size="sm">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4 h-[180px]">
            {/* Speed Chart */}
            <div>
              <h5 className="text-xs text-muted-foreground mb-2">Speed (km/h)</h5>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historicalData}>
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
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="speed"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Fuel Chart */}
            <div>
              <h5 className="text-xs text-muted-foreground mb-2">Fuel Level (%)</h5>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historicalData}>
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
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="fuel"
                    stroke="hsl(var(--fuel-medium))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default TelemetryPanel;