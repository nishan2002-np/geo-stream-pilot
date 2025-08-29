// Geocoding utility for address resolution and landmarks
import axios from 'axios';

interface GeocodeResult {
  address: string;
  landmark?: string;
  road?: string;
  city?: string;
  country?: string;
}

interface NominatimResult {
  display_name: string;
  address: {
    road?: string;
    suburb?: string;
    city?: string;
    state?: string;
    country?: string;
    postcode?: string;
  };
}

// Rate limiting for Nominatim API
let lastRequest = 0;
const RATE_LIMIT_MS = 1000; // 1 request per second

// Cache for geocoding results
const geocodeCache = new Map<string, GeocodeResult>();

// Nepal-specific landmarks database
const NEPAL_LANDMARKS = {
  'kathmandu': [
    { name: 'Ratna Park Bus Station', lat: 27.7017, lng: 85.3206 },
    { name: 'Thamel Tourist Hub', lat: 27.7219, lng: 85.3147 },
    { name: 'Dharahara Tower', lat: 27.7004, lng: 85.3077 },
    { name: 'Pashupatinath Temple', lat: 27.7106, lng: 85.3482 },
    { name: 'Swayambhunath Stupa', lat: 27.7149, lng: 85.2906 },
    { name: 'Boudhanath Stupa', lat: 27.7215, lng: 85.3618 },
    { name: 'Kathmandu Durbar Square', lat: 27.7040, lng: 85.3080 },
    { name: 'Tribhuvan Airport', lat: 27.6966, lng: 85.3591 },
    { name: 'Ring Road', lat: 27.7000, lng: 85.3240 },
    { name: 'New Baneshwor', lat: 27.6934, lng: 85.3454 },
  ]
};

export async function reverseGeocode(lat: number, lng: number): Promise<GeocodeResult> {
  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  
  // Check cache first
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey)!;
  }

  // Find nearby landmarks
  const nearbyLandmark = findNearbyLandmark(lat, lng);
  
  try {
    // Rate limiting
    const now = Date.now();
    if (now - lastRequest < RATE_LIMIT_MS) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS - (now - lastRequest)));
    }
    lastRequest = Date.now();

    // Call Nominatim API
    const response = await axios.get<NominatimResult>(
      `https://nominatim.openstreetmap.org/reverse`,
      {
        params: {
          lat,
          lon: lng,
          format: 'json',
          'accept-language': 'en',
          addressdetails: 1,
        },
        headers: {
          'User-Agent': 'GPS-Tracking-App',
        },
        timeout: 5000,
      }
    );

    const result: GeocodeResult = {
      address: response.data.display_name,
      landmark: nearbyLandmark?.name,
      road: response.data.address?.road,
      city: response.data.address?.city || response.data.address?.suburb,
      country: response.data.address?.country,
    };

    // Cache the result
    geocodeCache.set(cacheKey, result);
    return result;

  } catch (error) {
    console.error('Geocoding failed:', error);
    
    // Fallback to basic coordinate display with landmark if available
    const fallback: GeocodeResult = {
      address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      landmark: nearbyLandmark?.name,
      city: 'Kathmandu',
      country: 'Nepal',
    };
    
    geocodeCache.set(cacheKey, fallback);
    return fallback;
  }
}

function findNearbyLandmark(lat: number, lng: number, maxDistance = 1000): { name: string; distance: number } | null {
  let closestLandmark = null;
  let minDistance = maxDistance;

  for (const landmarks of Object.values(NEPAL_LANDMARKS)) {
    for (const landmark of landmarks) {
      const distance = calculateDistance(lat, lng, landmark.lat, landmark.lng);
      if (distance < minDistance) {
        minDistance = distance;
        closestLandmark = { name: landmark.name, distance };
      }
    }
  }

  return closestLandmark;
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export function formatAddress(geocodeResult: GeocodeResult): string {
  const parts = [];
  
  if (geocodeResult.landmark) {
    parts.push(`Near ${geocodeResult.landmark}`);
  }
  
  if (geocodeResult.road) {
    parts.push(geocodeResult.road);
  }
  
  if (geocodeResult.city) {
    parts.push(geocodeResult.city);
  }
  
  if (geocodeResult.country) {
    parts.push(geocodeResult.country);
  }
  
  return parts.join(', ') || geocodeResult.address;
}

export function getNetworkInfo(network: any): string {
  if (!network) return 'Unknown Network';
  
  const operatorMap: Record<string, string> = {
    'Ncell': 'Ncell (TeliaSonera)',
    'Nepal Telecom': 'Nepal Telecom (NTC)',
    'Smart Telecom': 'Smart Cell',
    'UTL': 'United Telecom Limited',
  };
  
  const operator = operatorMap[network.operator] || network.operator || 'Unknown';
  const cellInfo = network.cellId ? ` | Cell: ${network.cellId}` : '';
  const lacInfo = network.lac ? ` | LAC: ${network.lac}` : '';
  
  return `${operator}${cellInfo}${lacInfo}`;
}