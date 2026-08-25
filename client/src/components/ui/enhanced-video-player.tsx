import { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EnhancedVideoPlayerProps {
  src: string;
  className?: string;
  poster?: string;
  title?: string;
  autoPlay?: boolean;
  muted?: boolean;
  controls?: boolean;
  onVideoClick?: () => void;
}

export default function EnhancedVideoPlayer({ 
  src, 
  className = "", 
  poster,
  title = "Video",
  autoPlay = false,
  muted = false,
  controls = true,
  onVideoClick
}: EnhancedVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(muted);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const [volume, setVolume] = useState(1);
  const [aspectRatio, setAspectRatio] = useState<string>("16 / 9");
  const [isVerticalVideo, setIsVerticalVideo] = useState(false);

  // Helper function to get the correct video URL (similar to getMemoryImageUrl)
  const getVideoUrl = (videoUrl: string): string => {
    if (!videoUrl) return '';
    
    // Memory videos are served directly from /public, so we need to ensure the URL is correct
    if (videoUrl.startsWith('/uploads/')) {
      return `/public${videoUrl}`;
    }
    if (videoUrl.startsWith('/public/uploads/')) {
      return videoUrl;
    }
    // If it doesn't start with uploads, assume it's already a full URL
    return videoUrl;
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      // Set proper aspect ratio based on video dimensions
      const video = videoRef.current;
      const ratio = `${video.videoWidth} / ${video.videoHeight}`;
      setAspectRatio(ratio);
      
      // Detect if this is a vertical video (9:16 or similar)
      const isVertical = video.videoHeight > video.videoWidth;
      setIsVerticalVideo(isVertical);
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (videoRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const newTime = (clickX / rect.width) * duration;
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setIsMuted(newVolume === 0);
    }
  };

  const handleFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    // Set initial volume
    video.volume = volume;
    video.muted = isMuted;

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [volume, isMuted]);

  return (
    <div 
      className={`relative overflow-hidden w-full rounded-lg mx-auto ${className}`}
      style={{ 
        aspectRatio: aspectRatio,
        // For vertical videos (9:16), allow larger height up to 720px (equivalent of 1280x720 for 16:9)
        // For horizontal videos, keep reasonable max height
        maxHeight: isVerticalVideo ? '45rem' : '24rem', // 720px for vertical, 384px for horizontal
        maxWidth: isVerticalVideo ? '25rem' : '100%' // 400px max width for vertical videos
      }}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
      onClick={onVideoClick}
    >
      <video
        ref={videoRef}
        src={getVideoUrl(src)}
        poster={poster}
        className="block w-full h-full object-contain"
        autoPlay={autoPlay}
        muted={isMuted}
        onClick={(e) => {
          e.stopPropagation();
          togglePlay();
        }}
        onError={(e) => {
          console.error('Failed to load video:', src);
          console.error('Attempted URL:', e.currentTarget.src);
        }}
        data-testid="enhanced-video-player"
      />
      
      {/* Video overlay controls */}
      {controls && (
        <div className={`absolute inset-0 bg-black bg-opacity-0 transition-all duration-300 ${
          showControls ? 'bg-opacity-20' : ''
        }`}>
          
          {/* Play/Pause button (center) */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Button
              variant="ghost"
              size="icon"
              className={`h-16 w-16 rounded-full bg-black bg-opacity-50 text-white hover:bg-opacity-70 transition-all ${
                showControls || !isPlaying ? 'opacity-100' : 'opacity-0'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
              data-testid={isPlaying ? "button-pause-video" : "button-play-video"}
            >
              {isPlaying ? (
                <Pause className="h-8 w-8" />
              ) : (
                <Play className="h-8 w-8" />
              )}
            </Button>
          </div>

          {/* Bottom controls bar */}
          <div className={`absolute bottom-0 left-0 right-0 p-4 transition-all duration-300 ${
            showControls ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
          }`}>
            <div className="bg-black bg-opacity-70 rounded-lg p-3 space-y-2">
              
              {/* Progress bar */}
              <div 
                className="w-full h-2 bg-white bg-opacity-30 rounded-full cursor-pointer group/progress"
                onClick={handleProgressClick}
                data-testid="video-progress-bar"
              >
                <div 
                  className="h-full bg-white rounded-full transition-all group-hover/progress:bg-blue-400"
                  style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
                />
              </div>

              {/* Control buttons and time */}
              <div className="flex items-center justify-between text-white text-sm">
                <div className="flex items-center space-x-3">
                  {/* Play/Pause */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-white hover:bg-white hover:bg-opacity-20"
                    onClick={togglePlay}
                    data-testid="button-toggle-play"
                  >
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>

                  {/* Volume */}
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-white hover:bg-white hover:bg-opacity-20"
                      onClick={toggleMute}
                      data-testid="button-toggle-mute"
                    >
                      {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </Button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="w-16 h-1 bg-white bg-opacity-30 rounded-lg appearance-none cursor-pointer slider"
                      data-testid="volume-slider"
                    />
                  </div>

                  {/* Time display */}
                  <span className="text-xs font-mono" data-testid="video-time">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  {/* Restart button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-white hover:bg-white hover:bg-opacity-20"
                    onClick={() => {
                      if (videoRef.current) {
                        videoRef.current.currentTime = 0;
                      }
                    }}
                    data-testid="button-restart-video"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>

                  {/* Fullscreen */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-white hover:bg-white hover:bg-opacity-20"
                    onClick={handleFullscreen}
                    data-testid="button-fullscreen-video"
                  >
                    <Maximize className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Video indicator icon */}
      <div className="absolute top-2 right-2 bg-black bg-opacity-60 rounded-full p-2">
        <Play className="h-4 w-4 text-white" />
      </div>
    </div>
  );
}