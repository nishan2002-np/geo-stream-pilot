// Nepal-specific geocoding and address resolution

interface Landmark {
  name: string;
  lat: number;
  lng: number;
  type: string;
  district?: string;
}

// Major landmarks in Nepal for address resolution
const NEPAL_LANDMARKS: Landmark[] = [
  // Kathmandu Valley
  { name: 'Pashupatinath Temple', lat: 27.7106, lng: 85.3486, type: 'temple', district: 'Kathmandu' },
  { name: 'Boudhanath Stupa', lat: 27.7215, lng: 85.3617, type: 'stupa', district: 'Kathmandu' },
  { name: 'Swayambhunath Temple', lat: 27.7149, lng: 85.2904, type: 'temple', district: 'Kathmandu' },
  { name: 'Durbar Square Kathmandu', lat: 27.7045, lng: 85.3077, type: 'heritage', district: 'Kathmandu' },
  { name: 'Thamel', lat: 27.7172, lng: 85.3106, type: 'area', district: 'Kathmandu' },
  { name: 'New Road', lat: 27.7025, lng: 85.3156, type: 'street', district: 'Kathmandu' },
  { name: 'Ratna Park', lat: 27.7061, lng: 85.3133, type: 'park', district: 'Kathmandu' },
  { name: 'Ring Road', lat: 27.7172, lng: 85.3240, type: 'road', district: 'Kathmandu' },
  
  // Lalitpur
  { name: 'Patan Durbar Square', lat: 27.6731, lng: 85.3261, type: 'heritage', district: 'Lalitpur' },
  { name: 'Lagankhel', lat: 27.6667, lng: 85.3244, type: 'area', district: 'Lalitpur' },
  { name: 'Pulchowk', lat: 27.6783, lng: 85.3167, type: 'area', district: 'Lalitpur' },
  
  // Bhaktapur
  { name: 'Bhaktapur Durbar Square', lat: 27.6710, lng: 85.4298, type: 'heritage', district: 'Bhaktapur' },
  { name: 'Changunarayan Temple', lat: 27.7125, lng: 85.4275, type: 'temple', district: 'Bhaktapur' },
  
  // Major Cities
  { name: 'Pokhara Lakeside', lat: 28.2096, lng: 83.9856, type: 'tourist_area', district: 'Kaski' },
  { name: 'Biratnagar Airport', lat: 26.4815, lng: 87.2640, type: 'airport', district: 'Morang' },
  { name: 'Birgunj Border', lat: 27.0108, lng: 84.8696, type: 'border', district: 'Parsa' },
  { name: 'Butwal', lat: 27.7000, lng: 83.4500, type: 'city', district: 'Rupandehi' },
  { name: 'Nepalgunj', lat: 28.0500, lng: 81.6167, type: 'city', district: 'Banke' },
  
  // Major Highways
  { name: 'Tribhuvan Highway', lat: 27.6000, lng: 85.0000, type: 'highway' },
  { name: 'Prithvi Highway', lat: 27.8000, lng: 84.5000, type: 'highway' },
  { name: 'Mahendra Highway', lat: 28.0000, lng: 82.0000, type: 'highway' },
];

// Calculate distance between two coordinates
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Find nearest landmark
export function findNearestLandmark(lat: number, lng: number): { landmark: Landmark; distance: number } | null {
  let nearest: { landmark: Landmark; distance: number } | null = null;
  
  for (const landmark of NEPAL_LANDMARKS) {
    const distance = getDistance(lat, lng, landmark.lat, landmark.lng);
    
    if (!nearest || distance < nearest.distance) {
      nearest = { landmark, distance };
    }
  }
  
  return nearest;
}

// Generate address from coordinates
export async function getAddressFromCoordinates(lat: number, lng: number): Promise<string> {
  try {
    // First try to find a nearby landmark
    const nearestLandmark = findNearestLandmark(lat, lng);
    
    if (nearestLandmark && nearestLandmark.distance < 2) { // Within 2km
      const direction = getDirection(lat, lng, nearestLandmark.landmark.lat, nearestLandmark.landmark.lng);
      const distance = Math.round(nearestLandmark.distance * 1000); // Convert to meters
      
      if (distance < 100) {
        return `Near ${nearestLandmark.landmark.name}, ${nearestLandmark.landmark.district || 'Nepal'}`;
      } else {
        return `${distance}m ${direction} of ${nearestLandmark.landmark.name}, ${nearestLandmark.landmark.district || 'Nepal'}`;
      }
    }
    
    // Try reverse geocoding with OpenStreetMap (free)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=en`
    );
    
    if (response.ok) {
      const data = await response.json();
      if (data && data.display_name) {
        return data.display_name;
      }
    }
    
    // Fallback to basic coordinate-based location
    return getBasicLocationInfo(lat, lng);
    
  } catch (error) {
    console.error('Geocoding error:', error);
    return getBasicLocationInfo(lat, lng);
  }
}

// Get basic location info from coordinates
function getBasicLocationInfo(lat: number, lng: number): string {
  // Determine if coordinates are in Nepal
  if (lat >= 26.3 && lat <= 30.4 && lng >= 80.0 && lng <= 88.2) {
    // Within Nepal bounds
    if (lat >= 27.6 && lat <= 27.8 && lng >= 85.2 && lng <= 85.5) {
      return `Kathmandu Valley - ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    } else if (lat >= 28.1 && lat <= 28.3 && lng >= 83.8 && lng <= 84.1) {
      return `Pokhara Area - ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    } else {
      return `Nepal - ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
  } else {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

// Get direction from one point to another
function getDirection(lat1: number, lng1: number, lat2: number, lng2: number): string {
  const bearing = getBearing(lat1, lng1, lat2, lng2);
  
  if (bearing >= -22.5 && bearing < 22.5) return 'North';
  if (bearing >= 22.5 && bearing < 67.5) return 'Northeast';
  if (bearing >= 67.5 && bearing < 112.5) return 'East';
  if (bearing >= 112.5 && bearing < 157.5) return 'Southeast';
  if (bearing >= 157.5 || bearing < -157.5) return 'South';
  if (bearing >= -157.5 && bearing < -112.5) return 'Southwest';
  if (bearing >= -112.5 && bearing < -67.5) return 'West';
  if (bearing >= -67.5 && bearing < -22.5) return 'Northwest';
  
  return 'North';
}

// Calculate bearing between two points
function getBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  
  const y = Math.sin(dLng) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
  
  return Math.atan2(y, x) * 180 / Math.PI;
}

// Get landmark suggestions for a given area
export function getLandmarkSuggestions(lat: number, lng: number, radius: number = 5): Landmark[] {
  return NEPAL_LANDMARKS.filter(landmark => {
    const distance = getDistance(lat, lng, landmark.lat, landmark.lng);
    return distance <= radius;
  }).sort((a, b) => {
    const distA = getDistance(lat, lng, a.lat, a.lng);
    const distB = getDistance(lat, lng, b.lat, b.lng);
    return distA - distB;
  });
}