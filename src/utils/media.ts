import traccarApi from './traccarApi';

const TRACCAR_URL = import.meta.env.VITE_TRACCAR_URL || 'https://system.geotrack.com.np/api';

export interface MediaInfo {
  type: 'image' | 'video' | 'snapshot' | 'hls' | 'rtsp' | 'unknown';
  url: string | null;
  mediaId?: number;
  isStream?: boolean;
  isLive?: boolean;
}

/**
 * Resolve media URL from Meitrack attributes
 * Handles various media formats and sources from Traccar/Meitrack MDVR
 */
export function resolveMediaUrl(attributes: any, positionId?: number): MediaInfo {
  if (!attributes) {
    return { type: 'unknown', url: null };
  }

  // Check for direct media URLs in attributes
  const mediaFields = [
    'image', 'photo', 'snapshot', 'mediaUrl', 'imageUrl',
    'video', 'videoUrl', 'stream', 'streamUrl', 'hlsUrl',
    'rtspUrl', 'rtmpUrl', 'mjpegUrl'
  ];

  for (const field of mediaFields) {
    const value = attributes[field];
    if (value && typeof value === 'string') {
      return classifyMediaUrl(value);
    }
  }

  // Check for numeric media ID
  const mediaIdFields = ['mediaId', 'imageId', 'videoId', 'attachmentId'];
  for (const field of mediaIdFields) {
    const value = attributes[field];
    if (value && (typeof value === 'number' || !isNaN(parseInt(value)))) {
      const mediaId = typeof value === 'number' ? value : parseInt(value);
      return {
        type: 'image',
        url: `${TRACCAR_URL}/media/${mediaId}`,
        mediaId,
      };
    }
  }

  // Check for position-based media
  if (positionId) {
    return {
      type: 'snapshot',
      url: `${TRACCAR_URL}/media/positions/${positionId}`,
      mediaId: positionId,
    };
  }

  // Check for base64 encoded data
  const base64Fields = ['imageData', 'photoData', 'snapshotData'];
  for (const field of base64Fields) {
    const value = attributes[field];
    if (value && typeof value === 'string' && value.startsWith('data:')) {
      return {
        type: 'image',
        url: value,
      };
    }
  }

  // Look for Meitrack-specific patterns
  if (attributes.protocol === 'meitrack' || attributes.mdvrConnected) {
    // Try to construct snapshot URL for Meitrack devices
    const deviceChannel = attributes.channel || attributes.cameraChannel || 1;
    if (positionId) {
      return {
        type: 'snapshot',
        url: `${TRACCAR_URL}/media/positions/${positionId}?channel=${deviceChannel}`,
        mediaId: positionId,
      };
    }
  }

  return { type: 'unknown', url: null };
}

/**
 * Classify media URL based on extension and patterns
 */
function classifyMediaUrl(url: string): MediaInfo {
  const lowerUrl = url.toLowerCase();

  // Handle relative URLs
  let fullUrl = url;
  if (url.startsWith('/')) {
    fullUrl = TRACCAR_URL + url;
  } else if (!url.startsWith('http') && !url.startsWith('data:')) {
    fullUrl = `${TRACCAR_URL}/${url}`;
  }

  // Video streaming protocols
  if (lowerUrl.includes('.m3u8') || lowerUrl.includes('hls')) {
    return {
      type: 'hls',
      url: fullUrl,
      isStream: true,
      isLive: true,
    };
  }

  if (lowerUrl.startsWith('rtsp://')) {
    return {
      type: 'rtsp',
      url: fullUrl,
      isStream: true,
      isLive: true,
    };
  }

  if (lowerUrl.startsWith('rtmp://')) {
    return {
      type: 'video',
      url: fullUrl,
      isStream: true,
      isLive: true,
    };
  }

  // Video files
  const videoExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv'];
  if (videoExtensions.some(ext => lowerUrl.includes(ext))) {
    return {
      type: 'video',
      url: fullUrl,
      isStream: false,
    };
  }

  // Image files
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
  if (imageExtensions.some(ext => lowerUrl.includes(ext)) || lowerUrl.includes('image') || lowerUrl.includes('snapshot')) {
    return {
      type: 'image',
      url: fullUrl,
    };
  }

  // MJPEG streams
  if (lowerUrl.includes('mjpeg') || lowerUrl.includes('motion')) {
    return {
      type: 'video',
      url: fullUrl,
      isStream: true,
      isLive: true,
    };
  }

  // Default to image for unknown types
  return {
    type: 'image',
    url: fullUrl,
  };
}

/**
 * Fetch media blob for display
 */
export async function fetchMediaBlob(mediaId: number | string): Promise<string | null> {
  try {
    const blob = await traccarApi.getMedia(Number(mediaId));
    if (!blob) return null;

    return URL.createObjectURL(blob);
  } catch (error) {
    console.error('Failed to fetch media blob:', error);
    return null;
  }
}

/**
 * Generate mock snapshot URL for demo mode
 */
export function getMockSnapshotUrl(deviceId: number, timestamp?: Date): string {
  // Generate a consistent but varied snapshot URL for demo
  const time = timestamp || new Date();
  const seed = deviceId + Math.floor(time.getTime() / (5 * 60 * 1000)); // Change every 5 minutes
  
  // Use Picsum for demo snapshots with vehicle/road themes
  const imageIds = [1002, 1003, 1005, 1011, 1015, 1018, 1021, 1024];
  const imageId = imageIds[seed % imageIds.length];
  
  return `https://picsum.photos/640/480?random=${imageId}&t=${Math.floor(time.getTime() / 60000)}`;
}

/**
 * Extract video stream info from Meitrack attributes
 */
export function extractStreamInfo(attributes: any): {
  hasHLS: boolean;
  hasRTSP: boolean;
  hlsUrl?: string;
  rtspUrl?: string;
  channels: number[];
} {
  const result: {
    hasHLS: boolean;
    hasRTSP: boolean;
    hlsUrl?: string;
    rtspUrl?: string;
    channels: number[];
  } = {
    hasHLS: false,
    hasRTSP: false,
    channels: [1], // Default channel
  };

  if (!attributes) return result;

  // Check for stream URLs
  const hlsFields = ['hlsUrl', 'streamUrl', 'liveUrl', 'm3u8Url'];
  for (const field of hlsFields) {
    if (attributes[field] && typeof attributes[field] === 'string') {
      result.hasHLS = true;
      result.hlsUrl = attributes[field];
      break;
    }
  }

  const rtspFields = ['rtspUrl', 'rtspStream', 'cameraUrl'];
  for (const field of rtspFields) {
    if (attributes[field] && typeof attributes[field] === 'string') {
      result.hasRTSP = true;
      result.rtspUrl = attributes[field];
      break;
    }
  }

  // Extract channel information
  if (attributes.channels && Array.isArray(attributes.channels)) {
    result.channels = attributes.channels;
  } else if (attributes.cameraChannels) {
    const channels = String(attributes.cameraChannels).split(',').map(Number).filter(n => !isNaN(n));
    if (channels.length > 0) {
      result.channels = channels;
    }
  }

  return result;
}

/**
 * Create blob URL from base64 data
 */
export function createBlobFromBase64(base64Data: string, mimeType: string = 'image/jpeg'): string {
  const byteCharacters = atob(base64Data.split(',')[1] || base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType });
  
  return URL.createObjectURL(blob);
}

/**
 * Validate if URL is accessible (for CORS checking)
 */
export async function validateMediaUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD', mode: 'no-cors' });
    return true;
  } catch (error) {
    console.warn('Media URL validation failed:', url, error);
    return false;
  }
}