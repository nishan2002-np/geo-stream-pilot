# GPS Tracker Pro

A comprehensive real-time GPS tracking application with Traccar integration, featuring advanced device monitoring, live video streaming, and analytics.

## Features

- **Real-time Device Tracking** - Live GPS positions with smooth marker animations
- **Interactive Map** - Dark/light/satellite themes with clustering and trails
- **Media Integration** - Meitrack MDVR support with HLS video and snapshot fallback
- **Events & Alerts** - Comprehensive alerting system with filters and export
- **Route History** - Time-based playback with telemetry charts
- **Device Management** - Detailed device pages with commands and media gallery

## Quick Start

### Prerequisites

- Node.js 16+ and npm
- Modern web browser with WebGL support

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd gps-tracker-pro

# Install dependencies
npm install

# Start development server
npm start
```

The application will be available at `http://localhost:8080`

### Production Build

```bash
npm run build
```

## Environment Configuration

Create a `.env` file in the project root:

```env
# Traccar Server Configuration
REACT_APP_TRACCAR_URL=https://system.geotrack.com.np/api
REACT_APP_TRACCAR_USER=nishan@geotrack.com.np
REACT_APP_TRACCAR_PASS=12345

# Optional Features
REACT_APP_OPENWEATHERMAP_KEY=your_weather_api_key
REACT_APP_USE_WEATHER=true
REACT_APP_USE_TRAFFIC=true

# Demo Mode (uses mock data)
REACT_APP_DEMO_MODE=false
```

## Traccar Integration

### Default Configuration

The app comes pre-configured with demo credentials:
- **Server**: https://system.geotrack.com.np/api
- **Username**: nishan@geotrack.com.np
- **Password**: 12345

### CORS Configuration

For production, ensure your Traccar server allows CORS:

```xml
<!-- In traccar.xml -->
<entry key='web.origin'>*</entry>
<entry key='web.path'>./web</entry>
```

Or use a reverse proxy like NGINX:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location /api {
        proxy_pass http://traccar-server:8082;
        add_header 'Access-Control-Allow-Origin' '*';
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS';
        add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization';
    }
}
```

## Meitrack MDVR Video Integration

### HLS Streaming (Recommended)

For live video streaming, set up an HLS proxy:

```bash
# Using FFmpeg
ffmpeg -i rtsp://device-ip:554/live \
  -c:v libx264 -preset veryfast -tune zerolatency \
  -c:a aac -ar 44100 \
  -f hls -hls_time 1 -hls_list_size 3 \
  -hls_flags delete_segments \
  output.m3u8

# Using NGINX with RTMP module
rtmp {
    server {
        listen 1935;
        chunk_size 4096;
        
        application live {
            live on;
            hls on;
            hls_path /var/www/hls;
            hls_fragment 1s;
            hls_playlist_length 3s;
        }
    }
}
```

### Snapshot Fallback

The app automatically falls back to snapshot polling when HLS is unavailable:

- **Interval**: Configurable (1-10 seconds)
- **Format**: JPEG images via `/api/media/{id}` endpoint
- **Animation**: Smooth crossfade transitions

### Media URL Patterns

The app handles various Meitrack media URL formats:

```javascript
// Direct URLs
"image": "http://device-ip/snapshot.jpg"
"hlsUrl": "http://proxy-server/device1.m3u8"

// Traccar media endpoints
"mediaId": 12345  // → /api/media/12345
"positionId": 67890  // → /api/media/positions/67890

// Base64 data
"imageData": "data:image/jpeg;base64,/9j/4AAQ..."
```

## Features Overview

### Dashboard
- Live device list with status indicators
- Interactive map with custom markers
- Real-time alerts panel
- Telemetry display for selected device

### Events Page
- Chronological event feed
- Advanced filtering by type, severity, date
- CSV/XLSX export functionality
- Event acknowledgment and management

### History Page
- Route playback with time controls
- Speed adjustment (0.5x to 4x)
- GPX/KML route export
- Telemetry timeline synchronization

### Device Pages
- Comprehensive device information
- Live media feeds and gallery
- Remote command sending
- Historical telemetry charts

## Troubleshooting

### Common Issues

**CORS Errors**
- Configure Traccar server CORS headers
- Use reverse proxy (NGINX recommended)
- Check browser console for specific errors

**Video Not Loading**
- Verify RTSP stream accessibility
- Check HLS proxy configuration
- Enable snapshot fallback mode

**Devices Not Appearing**
- Verify Traccar credentials
- Check server connectivity
- Enable demo mode for testing

**Map Issues**
- Check internet connection for tiles
- Verify Leaflet CSS imports
- Clear browser cache

### Debug Mode

Enable debug logging:

```javascript
// In browser console
localStorage.setItem('debug', 'traccar:*');
```

## Performance Optimization

### Production Deployment

```bash
# Build optimized bundle
npm run build

# Serve with nginx
server {
    root /path/to/build;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /static/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Large Fleet Optimization

- **Device Clustering**: Automatic clustering for 100+ devices
- **Lazy Loading**: Media loaded on-demand
- **WebSocket**: Preferred over polling for real-time updates
- **Debounced Search**: Reduced API calls during filtering

## API Reference

### Core Functions

```typescript
// Get all devices
const devices = await traccarApi.getDevices();

// Get current positions
const positions = await traccarApi.getPositions([deviceId]);

// Get historical data
const history = await traccarApi.getPositionsHistory(
  deviceId, 
  fromDate, 
  toDate
);

// Send command
await traccarApi.sendCommand(deviceId, {
  type: 'engineStop'
});
```

### Media Utils

```typescript
// Resolve media URL
const mediaInfo = resolveMediaUrl(attributes, positionId);

// Extract stream info
const streamInfo = extractStreamInfo(attributes);

// Fetch media blob
const blobUrl = await fetchMediaBlob(mediaId);
```

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

This project is licensed under the MIT License. See LICENSE file for details.

## Support

For support and questions:
- Check the troubleshooting section above
- Review Traccar documentation: https://www.traccar.org/documentation/
- Open an issue on GitHub

---

**Built with React, TypeScript, Tailwind CSS, and Leaflet** 🚗📍