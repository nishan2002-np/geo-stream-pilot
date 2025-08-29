export interface Device {
  id: number;
  name: string;
  uniqueId: string;
  status: 'online' | 'offline' | 'stopped' | 'moving' | 'unknown';
  lastUpdate: string;
  positionId?: number;
  category?: string;
  phone?: string;
  model?: string;
  contact?: string;
  attributes: Record<string, any>;
}

export interface Position {
  id: number;
  deviceId: number;
  protocol: string;
  deviceTime: string;
  fixTime: string;
  serverTime: string;
  outdated: boolean;
  valid: boolean;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  course: number;
  address?: string;
  accuracy?: number;
  network?: any;
  attributes: Record<string, any>;
}

export interface Alert {
  id: string;
  type: 'overspeed' | 'geofence' | 'sos' | 'fuel' | 'network' | 'weather' | 'traffic' | 'battery' | 'maintenance';
  deviceId: number;
  deviceName: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: string;
  latitude?: number;
  longitude?: number;
  acknowledged: boolean;
  positionId?: number;
  attributes?: Record<string, any>;
}

export interface Event {
  id: number;
  type: string;
  deviceId: number;
  positionId?: number;
  geofenceId?: number;
  attributes: Record<string, any>;
  eventTime: string;
}

export interface MapState {
  center: [number, number];
  zoom: number;
  selectedDeviceId?: number;
  showTrails: boolean;
  mapStyle: 'dark' | 'light' | 'satellite';
}

export interface FilterState {
  status: ('online' | 'offline' | 'stopped' | 'moving')[];
  protocols: string[];
  search: string;
  deviceTypes: string[];
}

export interface TelemetryData {
  deviceId: number;
  timestamp: string;
  speed: number;
  fuel: number;
  battery: number;
  temperature: number;
  gsm: number;
  satellites: number;
  ignition: boolean;
  inputs: Record<string, boolean>;
  outputs: Record<string, boolean>;
  adcs: Record<string, number>;
}

export interface GeofenceInfo {
  id: number;
  name: string;
  description?: string;
  area: string; // WKT format
  type: 'polygon' | 'circle';
  attributes: Record<string, any>;
}

export interface Command {
  id: number;
  deviceId: number;
  type: string;
  description: string;
  attributes: Record<string, any>;
  textChannel?: boolean;
}

export interface WeatherInfo {
  location: string;
  temperature: number;
  humidity: number;
  pressure: number;
  windSpeed: number;
  windDirection: number;
  description: string;
  icon: string;
  alerts: string[];
}

export interface TrafficInfo {
  incidents: Array<{
    id: string;
    type: 'accident' | 'construction' | 'closure' | 'congestion';
    severity: 'minor' | 'moderate' | 'major';
    description: string;
    latitude: number;
    longitude: number;
    distance: number; // km from device
  }>;
}

export interface ReportConfig {
  deviceIds: number[];
  fromDate: Date;
  toDate: Date;
  type: 'trips' | 'summary' | 'events' | 'stops';
  format: 'csv' | 'xlsx' | 'pdf';
  groupBy?: 'device' | 'date' | 'none';
}

export interface PlaybackState {
  playing: boolean;
  speed: number;
  position: number; // 0-1
  duration: number; // seconds
  currentTime: Date;
  showStops: boolean;
  stopThreshold: number; // minutes
}