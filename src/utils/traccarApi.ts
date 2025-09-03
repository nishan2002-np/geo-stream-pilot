import axios, { AxiosInstance } from 'axios';

// Environment variables with defaults
const TRACCAR_URL = import.meta.env.VITE_TRACCAR_URL || 'https://system.geotrack.com.np/api';
const TRACCAR_USER = import.meta.env.VITE_TRACCAR_USER || 'nishan@geotrack.com.np';
const TRACCAR_PASS = import.meta.env.VITE_TRACCAR_PASS || '12345';
const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

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

export interface Event {
  id: number;
  type: string;
  deviceId: number;
  positionId?: number;
  geofenceId?: number;
  attributes: Record<string, any>;
  eventTime: string;
}

class TraccarAPI {
  private api: AxiosInstance;
  private wsConnection: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor() {
    this.api = axios.create({
      baseURL: TRACCAR_URL,
      auth: {
        username: TRACCAR_USER,
        password: TRACCAR_PASS,
      },
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    // Response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('Traccar API Error:', error);
        if (error.response?.status === 401) {
          console.error('Authentication failed. Check credentials.');
        }
        throw error;
      }
    );
  }

  // Get all devices
  async getDevices(): Promise<Device[]> {
    if (DEMO_MODE) {
      return this.getMockDevices();
    }

    try {
      const response = await this.api.get('/devices');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch devices:', error);
      return this.getMockDevices(); // Fallback to mock data
    }
  }

  // Get current positions
  async getPositions(deviceIds?: number[]): Promise<Position[]> {
    if (DEMO_MODE) {
      return this.getMockPositions();
    }

    try {
      const params = deviceIds ? { id: deviceIds } : {};
      const response = await this.api.get('/positions', { params });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch positions:', error);
      return this.getMockPositions();
    }
  }

  // Get position by ID
  async getPositionById(id: number): Promise<Position | null> {
    if (DEMO_MODE) {
      const positions = this.getMockPositions();
      return positions.find(p => p.id === id) || null;
    }

    try {
      const response = await this.api.get(`/positions/${id}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch position:', error);
      return null;
    }
  }

  // Get position history
  async getPositionsHistory(
    deviceId: number,
    from: Date,
    to: Date
  ): Promise<Position[]> {
    if (DEMO_MODE) {
      return this.getMockPositionHistory(deviceId, from, to);
    }

    try {
      const response = await this.api.get('/positions', {
        params: {
          deviceId,
          from: from.toISOString(),
          to: to.toISOString(),
        },
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch position history:', error);
      return this.getMockPositionHistory(deviceId, from, to);
    }
  }

  // Get media by ID
  async getMedia(mediaId: number): Promise<Blob | null> {
    if (DEMO_MODE) {
      return null;
    }

    try {
      const response = await this.api.get(`/media/${mediaId}`, {
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch media:', error);
      return null;
    }
  }

  // Get device attributes
  async getDeviceAttributes(deviceId: number): Promise<Record<string, any>> {
    if (DEMO_MODE) {
      return this.getMockDeviceAttributes(deviceId);
    }

    try {
      const response = await this.api.get(`/devices/${deviceId}`);
      return response.data.attributes || {};
    } catch (error) {
      console.error('Failed to fetch device attributes:', error);
      return {};
    }
  }

  // Send command to device
  async sendCommand(deviceId: number, command: any): Promise<boolean> {
    if (DEMO_MODE) {
      console.log('Demo mode: Command would be sent:', command);
      return true;
    }

    try {
      await this.api.post('/commands/send', {
        deviceId,
        ...command,
      });
      return true;
    } catch (error) {
      console.error('Failed to send command:', error);
      return false;
    }
  }

  // WebSocket connection for real-time updates
  connectWebSocket(onMessage: (data: any) => void): void {
    if (DEMO_MODE) {
      // Start demo polling instead
      this.startDemoPolling(onMessage);
      return;
    }

    const wsUrl = TRACCAR_URL.replace(/^http/, 'ws') + '/socket';
    
    try {
      this.wsConnection = new WebSocket(wsUrl);

      this.wsConnection.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
      };

      this.wsConnection.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.wsConnection.onclose = () => {
        console.log('WebSocket disconnected');
        this.attemptReconnect(onMessage);
      };

      this.wsConnection.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      this.startDemoPolling(onMessage);
    }
  }

  // Disconnect WebSocket
  disconnectWebSocket(): void {
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }
  }

  // Attempt WebSocket reconnection
  private attemptReconnect(onMessage: (data: any) => void): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        console.log(`Attempting WebSocket reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
        this.connectWebSocket(onMessage);
      }, 2000 * this.reconnectAttempts);
    } else {
      console.log('Max reconnection attempts reached, falling back to polling');
      this.startDemoPolling(onMessage);
    }
  }

  // Demo polling for mock data updates
  private startDemoPolling(onMessage: (data: any) => void): void {
    setInterval(async () => {
      const devices = await this.getDevices();
      const positions = await this.getPositions();
      
      onMessage({
        devices,
        positions,
        events: [], // Mock events if needed
      });
    }, 5000);
  }

  // Get proper device status based on position data
  private getDeviceStatus(deviceId: number, position?: Position): 'offline' | 'stopped' | 'moving' {
    if (!position) return 'offline';
    
    const lastUpdate = new Date(position.serverTime);
    const now = new Date();
    const minutesSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
    
    // Offline if no update for more than 10 minutes
    if (minutesSinceUpdate > 10) return 'offline';
    
    // Moving if speed > 3 km/h and ignition on
    if (position.speed > 3 && position.attributes?.ignition) return 'moving';
    
    // Otherwise stopped (includes ignition off)
    return 'stopped';
  }

  // Calculate fuel level based on TODAY'S odometer only (260L base, 1L = 8km)
  private calculateFuelLevel(todayOdometer: number): number {
    const baseFuel = 260; // 260L fuel tank capacity
    const kmPerLiter = 8; // 1 liter = 8 km
    
    // Fuel consumption based ONLY on today's distance
    const consumedLiters = Math.floor(todayOdometer / kmPerLiter);
    const remainingLiters = Math.max(0, baseFuel - consumedLiters);
    
    return remainingLiters;
  }

  // Calculate today's odometer (resets daily at midnight)
  private getTodayOdometer(baseValue: number): number {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const minutesSinceStartOfDay = (now.getTime() - startOfDay.getTime()) / (1000 * 60);
    
    // Today's distance accumulates throughout the day (max ~100km per day)
    return Math.floor((baseValue + minutesSinceStartOfDay) / 100);
  }

  // Calculate total odometer (keeps accumulating)
  private getTotalOdometer(baseValue: number): number {
    return Math.floor(baseValue);
  }

  // Mock data generators
  private getMockDevices(): Device[] {
    const mockPositions = this.getMockPositions();
    
    return [
      {
        id: 1,
        name: 'MDVR Testing Vehicle',
        uniqueId: 'MDVR001',
        status: this.getDeviceStatus(1, mockPositions.find(p => p.deviceId === 1)),
        lastUpdate: new Date().toISOString(),
        positionId: 1,
        category: 'car',
        phone: '+977-9841234567',
        model: 'Toyota Hiace with MDVR',
        contact: 'Driver: Ram Bahadur',
        attributes: {
          ignition: true,
          fuel: 85,
          battery: 95,
          gsm: 85,
          satellites: 12,
          protocol: 'meitrack',
          mdvrConnected: true,
          mediaId: 'camera1',
          testingMode: 'mdvr',
        },
      },
      {
        id: 2,
        name: 'Dashcam Testing Unit',
        uniqueId: 'DASH002',
        status: this.getDeviceStatus(2, mockPositions.find(p => p.deviceId === 2)),
        lastUpdate: new Date(Date.now() - 300000).toISOString(),
        positionId: 2,
        category: 'truck',
        phone: '+977-9841234568',
        model: 'Mahindra Bolero + Dashcam',
        contact: 'Driver: Shyam Gurung',
        attributes: {
          ignition: false,
          fuel: 60,
          battery: 78,
          gsm: 92,
          satellites: 8,
          protocol: 'meitrack',
          mdvrConnected: false,
          dashcamActive: true,
          mediaId: 'camera2',
          testingMode: 'dashcam',
        },
      },
      {
        id: 3,
        name: 'GPS Testing Vehicle',
        uniqueId: 'GPS003',
        status: this.getDeviceStatus(3, mockPositions.find(p => p.deviceId === 3)),
        lastUpdate: new Date(Date.now() - 30000).toISOString(),
        positionId: 3,
        category: 'bus',
        phone: '+977-9841234569',
        model: 'Tata Starbus GPS Unit',
        contact: 'Driver: Hari Thapa',
        attributes: {
          ignition: true,
          fuel: 75,
          battery: 88,
          gsm: 78,
          satellites: 10,
          protocol: 'meitrack',
          mdvrConnected: true,
          mediaId: 'camera3',
          passengers: 45,
          maxPassengers: 60,
          testingMode: 'gps',
        },
      },
    ];
  }

  private getMockPositions(): Position[] {
    const baseTime = new Date();
    
    // Generate dynamic data with real movement simulation and real-time odometer
    const generateDynamicPosition = (deviceId: number, basePos: { lat: number; lng: number }, speed: number) => {
      const timeOffset = (Date.now() % 300000) / 300000; // 5-minute cycle
      const movement = 0.001 * timeOffset * (speed / 50); // Scale movement by speed
      
      // Real-time odometer tracking
      const lastUpdateKey = `lastUpdate_${deviceId}`;
      const todayOdometerKey = `todayOdometer_${deviceId}`;
      const totalOdometerKey = `totalOdometer_${deviceId}`;
      const lastResetDateKey = `lastResetDate_${deviceId}`;
      
      const now = Date.now();
      const lastUpdate = parseInt(localStorage.getItem(lastUpdateKey) || now.toString());
      let todayOdometer = parseFloat(localStorage.getItem(todayOdometerKey) || '0');
      let totalOdometer = parseFloat(localStorage.getItem(totalOdometerKey) || '0');
      const lastResetDate = localStorage.getItem(lastResetDateKey) || new Date().toDateString();
      
      // Reset today's odometer if it's past 12pm and new day
      const currentDate = new Date();
      const currentDateStr = currentDate.toDateString();
      const resetTime = new Date(currentDate);
      resetTime.setHours(12, 0, 0, 0); // 12pm reset time
      
      const lastResetDateTime = new Date(lastResetDate + ' 12:00:00');
      
      if (currentDateStr !== lastResetDate || (currentDate >= resetTime && lastResetDateTime < resetTime)) {
        todayOdometer = 0;
        localStorage.setItem(lastResetDateKey, currentDateStr);
      }
      
      // Ultra-sensitive distance tracking - even 1m movement shows
      const timeDiff = Math.min((now - lastUpdate) / 1000, 30); // seconds, max 30s gap
      const increment = speed > 0.5 ? Math.max(0.001, (speed * timeDiff) / 3600) : 0; // Even 0.5km/h shows, minimum 1m (0.001km)
      
      // Update odometers
      todayOdometer += increment;
      totalOdometer += increment;
      
      // Save updated values
      localStorage.setItem(lastUpdateKey, now.toString());
      localStorage.setItem(todayOdometerKey, todayOdometer.toString());
      localStorage.setItem(totalOdometerKey, totalOdometer.toString());
      
      return {
        latitude: basePos.lat + (Math.sin(timeOffset * Math.PI * 2) * movement),
        longitude: basePos.lng + (Math.cos(timeOffset * Math.PI * 2) * movement),
        speed: Math.max(0, speed + (Math.sin(timeOffset * Math.PI * 4) * 10)), // Dynamic speed
        todayOdometer,
        totalOdometer,
      };
    };

    const vehicle1 = generateDynamicPosition(1, { lat: 27.7172, lng: 85.3240 }, 45); // MDVR Testing - Moving
    const vehicle2 = generateDynamicPosition(2, { lat: 27.7219, lng: 85.3206 }, 0);  // Dashcam Testing - Stopped
    const vehicle3 = generateDynamicPosition(3, { lat: 27.7089, lng: 85.3206 }, 25); // GPS Testing - Moving

    return [
      {
        id: 1,
        deviceId: 1,
        protocol: 'meitrack',
        deviceTime: baseTime.toISOString(),
        fixTime: baseTime.toISOString(),
        serverTime: baseTime.toISOString(),
        outdated: false,
        valid: true,
        latitude: vehicle1.latitude,
        longitude: vehicle1.longitude,
        altitude: 1350,
        speed: vehicle1.speed,
        course: 180,
        address: 'Thamel Chowk, Kathmandu (MDVR Testing Zone)',
        accuracy: 3.2,
        attributes: {
          ignition: true,
          fuel: this.calculateFuelLevel(vehicle1.todayOdometer), // Fuel based on TODAY'S odometer only
          battery: 95,
          gsm: 85 + Math.round(Math.random() * 10), // Dynamic signal
          satellites: 12,
          io1: true,
          io2: false,
          io3: true,
          adc1: 2.4,
          adc2: 1.8,
          temp1: 28.5 + (Math.random() * 5), // Dynamic temperature
          temp2: 32.1 + (Math.random() * 3),
          voltage: 12.6,
          current: 2.1,
          power: 26.5,
          rpm: 2150,
          engineHours: 1245,
          odometer: vehicle1.totalOdometer, // Total odometer (keeps accumulating)
          todayOdometer: vehicle1.todayOdometer, // Today's odometer (resets daily)
          image: 'snapshot_001.jpg',
          mediaId: 101,
          protocol: 'meitrack',
          phoneCall: false,
          event: Math.random() > 0.95 ? 35 : null, // Random overspeed event
          driverCard: 'DRIVER001',
          driverName: 'Ram Bahadur',
        },
      },
      {
        id: 2,
        deviceId: 2,
        protocol: 'meitrack',
        deviceTime: new Date(baseTime.getTime() - 300000).toISOString(),
        fixTime: new Date(baseTime.getTime() - 300000).toISOString(),
        serverTime: new Date(baseTime.getTime() - 300000).toISOString(),
        outdated: false,
        valid: true,
        latitude: vehicle2.latitude,
        longitude: vehicle2.longitude,
        altitude: 1345,
        speed: vehicle2.speed,
        course: 90,
        address: 'Ratna Park Bus Station, Kathmandu (Dashcam Test)',
        accuracy: 2.8,
        attributes: {
          ignition: false,
          fuel: this.calculateFuelLevel(vehicle2.todayOdometer), // Fuel based on TODAY'S odometer only
          battery: 78,
          gsm: 92 + Math.round(Math.random() * 8), // Dynamic WiFi signal for Meitrack
          satellites: 8,
          io1: false,
          io2: true,
          io3: false,
          adc1: 1.8,
          adc2: 2.2,
          temp1: 25.2 + (Math.random() * 3),
          temp2: 27.8 + (Math.random() * 2),
          voltage: 12.4,
          current: 0.8,
          power: 9.9,
          rpm: 0,
          engineHours: 987,
          odometer: vehicle2.totalOdometer, // Total odometer (keeps accumulating)
          todayOdometer: vehicle2.todayOdometer, // Today's odometer (resets daily)
          image: 'snapshot_002.jpg',
          mediaId: 102,
          protocol: 'meitrack',
          phoneCall: Math.random() > 0.98, // Random phone call
          event: Math.random() > 0.97 ? 42 : null, // Random ignition off event
          driverCard: 'DRIVER002',
          driverName: 'Shyam Gurung',
        },
      },
      {
        id: 3,
        deviceId: 3,
        protocol: 'meitrack',
        deviceTime: new Date(baseTime.getTime() - 30000).toISOString(),
        fixTime: new Date(baseTime.getTime() - 30000).toISOString(),
        serverTime: new Date(baseTime.getTime() - 30000).toISOString(),
        outdated: false,
        valid: true,
        latitude: vehicle3.latitude,
        longitude: vehicle3.longitude,
        altitude: 1340,
        speed: vehicle3.speed,
        course: 45,
        address: 'Durbar Square Heritage Zone, Kathmandu (GPS Test)',
        accuracy: 4.1,
        attributes: {
          ignition: true,
          fuel: this.calculateFuelLevel(vehicle3.todayOdometer), // Fuel based on TODAY'S odometer only
          battery: 88,
          gsm: 78 + Math.round(Math.random() * 12), // Dynamic signal
          satellites: 10,
          io1: true,
          io2: false,
          io3: true,
          io4: false,
          adc1: 3.1,
          adc2: 2.7,
          temp1: 30.5 + (Math.random() * 8),
          temp2: 28.9 + (Math.random() * 4),
          voltage: 41.0,
          current: 1.5,
          power: 41.0,
          rpm: 1890,
          engineHours: 2156,
          odometer: vehicle3.totalOdometer, // Total odometer (keeps accumulating)
          todayOdometer: vehicle3.todayOdometer, // Today's odometer (resets daily)
          passengers: 45,
          maxPassengers: 60,
          doorOpen: false,
          image: 'snapshot_003.jpg',
          mediaId: 103,
          protocol: 'meitrack',
          phoneCall: false,
          event: Math.random() > 0.98 ? 41 : null, // Random ignition event
          driverCard: 'DRIVER003',
          driverName: 'Hari Thapa',
        },
      },
    ];
  }

  private getMockPositionHistory(deviceId: number, from: Date, to: Date): Position[] {
    const positions: Position[] = [];
    const device = this.getMockDevices().find(d => d.id === deviceId);
    if (!device) return positions;

    const currentPos = this.getMockPositions().find(p => p.deviceId === deviceId);
    if (!currentPos) return positions;

    // Generate historical positions
    const hoursDiff = Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60));
    const stepMinutes = Math.max(1, Math.floor((hoursDiff * 60) / 100)); // Max 100 points

    for (let i = 0; i <= hoursDiff * 60; i += stepMinutes) {
      const timestamp = new Date(from.getTime() + i * 60 * 1000);
      
      // Simulate movement pattern
      const noise = (Math.random() - 0.5) * 0.001;
      const timeOffset = i / (hoursDiff * 60);
      
      positions.push({
        ...currentPos,
        id: 1000 + i,
        deviceTime: timestamp.toISOString(),
        fixTime: timestamp.toISOString(),
        serverTime: timestamp.toISOString(),
        latitude: currentPos.latitude + noise + (timeOffset * 0.01),
        longitude: currentPos.longitude + noise + (timeOffset * 0.01),
        speed: Math.max(0, currentPos.speed + (Math.random() - 0.5) * 20),
        course: (currentPos.course + (Math.random() - 0.5) * 30) % 360,
        attributes: {
          ...currentPos.attributes,
          fuel: Math.max(10, currentPos.attributes.fuel - (timeOffset * 20)),
        },
      });
    }

    return positions.reverse(); // Most recent first
  }

  private getMockDeviceAttributes(deviceId: number): Record<string, any> {
    const device = this.getMockDevices().find(d => d.id === deviceId);
    return device?.attributes || {};
  }
}

// Export singleton instance
export const traccarApi = new TraccarAPI();
export default traccarApi;