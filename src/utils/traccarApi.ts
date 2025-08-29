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
  status: 'online' | 'offline' | 'idle' | 'moving' | 'unknown';
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

  // Mock data generators
  private getMockDevices(): Device[] {
    return [
      {
        id: 1,
        name: 'Fleet Vehicle 001',
        uniqueId: 'FV001',
        status: 'online',
        lastUpdate: new Date().toISOString(),
        positionId: 1,
        category: 'car',
        phone: '+977-9841234567',
        model: 'Toyota Hiace',
        contact: 'Driver: Ram Bahadur',
        attributes: {
          ignition: true,
          fuel: 75,
          battery: 95,
          gsm: 85,
          satellites: 12,
          protocol: 'meitrack',
          mdvrConnected: true,
          mediaId: 'camera1',
        },
      },
      {
        id: 2,
        name: 'Delivery Truck 002',
        uniqueId: 'DT002',
        status: 'idle',
        lastUpdate: new Date(Date.now() - 300000).toISOString(),
        positionId: 2,
        category: 'truck',
        phone: '+977-9841234568',
        model: 'Mahindra Bolero',
        contact: 'Driver: Shyam Gurung',
        attributes: {
          ignition: false,
          fuel: 45,
          battery: 78,
          gsm: 92,
          satellites: 8,
          protocol: 'meitrack',
          mdvrConnected: true,
          mediaId: 'camera2',
        },
      },
      {
        id: 3,
        name: 'Bus Route A',
        uniqueId: 'BRA001',
        status: 'moving',
        lastUpdate: new Date(Date.now() - 30000).toISOString(),
        positionId: 3,
        category: 'bus',
        phone: '+977-9841234569',
        model: 'Tata Starbus',
        contact: 'Driver: Hari Thapa',
        attributes: {
          ignition: true,
          fuel: 60,
          battery: 88,
          gsm: 78,
          satellites: 10,
          protocol: 'meitrack',
          mdvrConnected: true,
          mediaId: 'camera3',
          passengers: 45,
          maxPassengers: 60,
        },
      },
    ];
  }

  private getMockPositions(): Position[] {
    const baseTime = new Date();
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
        latitude: 27.7172,
        longitude: 85.3240,
        altitude: 1350,
        speed: 45.5,
        course: 180,
        address: 'Ratna Park, Kathmandu (Near Nepal Telecom)',
        accuracy: 3.2,
        network: {
          operator: 'Ncell',
          mcc: 429,
          mnc: 1,
          lac: 1234,
          cellId: 5678,
        },
        attributes: {
          ignition: true,
          fuel: 75,
          battery: 95,
          gsm: 85,
          satellites: 12,
          io1: true,
          adc1: 2.4,
          temp1: 28.5,
          image: 'snapshot_001.jpg',
          mediaId: 101,
          landmark: 'Ratna Park Bus Station',
          road: 'Ratna Park Road',
          city: 'Kathmandu',
          country: 'Nepal',
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
        latitude: 27.7219,
        longitude: 85.3206,
        altitude: 1345,
        speed: 0,
        course: 90,
        address: 'Thamel Chowk, Kathmandu (Near Garden of Dreams)',
        accuracy: 2.8,
        network: {
          operator: 'Nepal Telecom',
          mcc: 429,
          mnc: 2,
          lac: 1235,
          cellId: 5679,
        },
        attributes: {
          ignition: false,
          fuel: 45,
          battery: 78,
          gsm: 92,
          satellites: 8,
          io1: false,
          adc1: 1.8,
          temp1: 25.2,
          image: 'snapshot_002.jpg',
          mediaId: 102,
          landmark: 'Thamel Tourist Hub',
          road: 'Thamel Marg',
          city: 'Kathmandu',
          country: 'Nepal',
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
        latitude: 27.7089,
        longitude: 85.3206,
        altitude: 1340,
        speed: 25.0,
        course: 45,
        address: 'New Road, Kathmandu (Near Dharahara Tower)',
        accuracy: 4.1,
        network: {
          operator: 'Smart Telecom',
          mcc: 429,
          mnc: 4,
          lac: 1236,
          cellId: 5680,
        },
        attributes: {
          ignition: true,
          fuel: 60,
          battery: 88,
          gsm: 78,
          satellites: 10,
          io1: true,
          adc1: 2.1,
          temp1: 32.1,
          image: 'snapshot_003.jpg',
          mediaId: 103,
          passengers: 45,
          landmark: 'Sundhara Chowk',
          road: 'New Road',
          city: 'Kathmandu',
          country: 'Nepal',
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