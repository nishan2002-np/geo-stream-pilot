import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Play,
  Pause,
  Download,
  Camera,
  AlertCircle,
  Wifi,
  WifiOff,
  RefreshCw,
  Volume2,
  VolumeX,
  Maximize,
} from 'lucide-react';
import { resolveMediaUrl, extractStreamInfo, getMockSnapshotUrl } from '@/utils/media';

interface VideoPlayerProps {
  deviceId: number;
  attributes: Record<string, any>;
  autoPlay?: boolean;
  className?: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  deviceId,
  attributes,
  autoPlay = false,
  className = '',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const [mode, setMode] = useState<'hls' | 'snapshot' | 'error'>('snapshot');
  const [isPlaying, setIsPlaying] = useState(false);
  const [snapshotUrl, setSnapshotUrl] = useState<string>('');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [error, setError] = useState<string>('');
  const [streamHealth, setStreamHealth] = useState<'good' | 'poor' | 'disconnected'>('good');
  const [snapshotInterval, setSnapshotInterval] = useState(3000); // 3 seconds
  const [volume, setVolume] = useState(0.5);
  const [muted, setMuted] = useState(false);

  // Extract stream information
  const streamInfo = extractStreamInfo(attributes);
  const mediaInfo = resolveMediaUrl(attributes);

  // Initialize video player based on available streams
  useEffect(() => {
    initializePlayer();
    return cleanup;
  }, [deviceId, attributes]);

  const initializePlayer = async () => {
    setError('');
    
    // Try HLS first if available
    if (streamInfo.hasHLS && streamInfo.hlsUrl) {
      try {
        await setupHLSPlayer(streamInfo.hlsUrl);
        setMode('hls');
        return;
      } catch (err) {
        console.warn('HLS setup failed, falling back to snapshot mode:', err);
      }
    }

    // Fallback to snapshot mode
    setMode('snapshot');
    startSnapshotPolling();
  };

  const setupHLSPlayer = async (hlsUrl: string): Promise<void> => {
    if (!videoRef.current) throw new Error('Video element not available');

    return new Promise((resolve, reject) => {
      const video = videoRef.current!;

      // Check if HLS.js is available (would need to be added to dependencies)
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari)
        video.src = hlsUrl;
        video.addEventListener('loadedmetadata', () => resolve());
        video.addEventListener('error', () => reject(new Error('HLS playback failed')));
      } else {
        // For non-Safari browsers, we'd need HLS.js
        // For now, fall back to snapshot mode
        reject(new Error('HLS not supported in this browser'));
      }
    });
  };

  const startSnapshotPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    const updateSnapshot = async () => {
      try {
        // In a real implementation, this would fetch from the actual media endpoint
        const mockUrl = getMockSnapshotUrl(deviceId, new Date());
        setSnapshotUrl(mockUrl);
        setLastUpdate(new Date());
        setStreamHealth('good');
      } catch (err) {
        console.error('Failed to update snapshot:', err);
        setStreamHealth('poor');
        setError('Failed to load snapshot');
      }
    };

    // Initial snapshot
    updateSnapshot();

    // Start polling
    if (isPlaying) {
      intervalRef.current = setInterval(updateSnapshot, snapshotInterval);
    }
  };

  const cleanup = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const togglePlayback = () => {
    if (mode === 'hls' && videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    } else if (mode === 'snapshot') {
      setIsPlaying(!isPlaying);
    }
  };

  const downloadSnapshot = () => {
    if (snapshotUrl) {
      const a = document.createElement('a');
      a.href = snapshotUrl;
      a.download = `snapshot-${deviceId}-${Date.now()}.jpg`;
      a.click();
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !muted;
      setMuted(!muted);
    }
  };

  const handleVolumeChange = (value: number) => {
    setVolume(value);
    if (videoRef.current) {
      videoRef.current.volume = value;
    }
  };

  // Effect for snapshot polling
  useEffect(() => {
    if (mode === 'snapshot') {
      if (isPlaying) {
        startSnapshotPolling();
      } else {
        cleanup();
      }
    }
    return cleanup;
  }, [isPlaying, mode, snapshotInterval]);

  const getStreamHealthIcon = () => {
    switch (streamHealth) {
      case 'good':
        return <Wifi className="h-4 w-4 text-success" />;
      case 'poor':
        return <Wifi className="h-4 w-4 text-warning" />;
      default:
        return <WifiOff className="h-4 w-4 text-destructive" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`relative ${className}`}
    >
      <Card className="overflow-hidden">
        <div className="relative bg-black aspect-video">
          {/* HLS Video Player */}
          {mode === 'hls' && (
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              controls={false}
              autoPlay={autoPlay}
              muted={muted}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onError={() => {
                setError('Video playback failed');
                setMode('snapshot');
                startSnapshotPolling();
              }}
            />
          )}

          {/* Snapshot Display */}
          {mode === 'snapshot' && (
            <div className="w-full h-full flex items-center justify-center">
              {snapshotUrl ? (
                <motion.img
                  key={snapshotUrl}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  src={snapshotUrl}
                  alt="Live snapshot"
                  className="w-full h-full object-cover"
                  onError={() => setError('Failed to load snapshot')}
                />
              ) : (
                <div className="text-center text-white">
                  <Camera className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No snapshot available</p>
                </div>
              )}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
              <div className="text-center text-white">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 text-destructive" />
                <p className="text-sm">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    setError('');
                    initializePlayer();
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              </div>
            </div>
          )}

          {/* Overlay Controls */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 hover:opacity-100 transition-opacity">
            <div className="absolute bottom-4 left-4 right-4">
              <div className="flex items-center justify-between">
                {/* Playback Controls */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={togglePlayback}
                    className="h-8 w-8 p-0"
                  >
                    {isPlaying ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>

                  {mode === 'hls' && (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={toggleMute}
                        className="h-8 w-8 p-0"
                      >
                        {muted ? (
                          <VolumeX className="h-4 w-4" />
                        ) : (
                          <Volume2 className="h-4 w-4" />
                        )}
                      </Button>
                      
                      <div className="w-20">
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={volume}
                          onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                          className="w-full h-1 bg-white/30 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={downloadSnapshot}
                    className="h-8 w-8 p-0"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-8 w-8 p-0"
                  >
                    <Maximize className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Status Indicators */}
          <div className="absolute top-4 left-4 flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {mode === 'hls' ? 'HLS' : 'Snapshot'}
            </Badge>
            
            {mode === 'snapshot' && isPlaying && (
              <Badge variant="outline" className="text-xs">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse mr-1" />
                Live
              </Badge>
            )}
          </div>

          <div className="absolute top-4 right-4 flex items-center gap-2">
            {getStreamHealthIcon()}
            
            {mode === 'snapshot' && (
              <Badge variant="outline" className="text-xs">
                {snapshotInterval / 1000}s
              </Badge>
            )}
          </div>
        </div>

        {/* Stream Info */}
        <div className="p-3 bg-card border-t">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <span className="text-muted-foreground">
                Mode: <span className="font-medium">{mode.toUpperCase()}</span>
              </span>
              
              {mode === 'snapshot' && (
                <span className="text-muted-foreground">
                  Last update: <span className="font-medium">{lastUpdate.toLocaleTimeString()}</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {streamInfo.hasRTSP && (
                <Badge variant="outline" className="text-xs">
                  RTSP Available
                </Badge>
              )}
              
              {mode === 'snapshot' && (
                <select
                  value={snapshotInterval}
                  onChange={(e) => setSnapshotInterval(parseInt(e.target.value))}
                  className="text-xs bg-background border border-border rounded px-2 py-1"
                >
                  <option value={1000}>1s</option>
                  <option value={3000}>3s</option>
                  <option value={5000}>5s</option>
                  <option value={10000}>10s</option>
                </select>
              )}
            </div>
          </div>

          {/* RTSP Instructions */}
          {streamInfo.hasRTSP && mode !== 'hls' && (
            <div className="mt-2 p-2 bg-muted/20 rounded text-xs text-muted-foreground">
              <p className="font-medium mb-1">RTSP Stream Available:</p>
              <p>For live video, set up an RTSP→HLS proxy (FFmpeg/NGINX) and configure the HLS URL.</p>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
};

export default VideoPlayer;