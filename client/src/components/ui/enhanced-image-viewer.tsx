import { useState, useRef, useEffect } from "react";
import { Search, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface EnhancedImageViewerProps {
  src: string | undefined;
  alt?: string;
  className?: string;
  onImageClick?: () => void;
  title?: string;
  eventDate?: string;
  category?: string;
  viewerMode?: boolean;
  enableZoomPan?: boolean;
}

export default function EnhancedImageViewer({ 
  src, 
  alt = "Memory image",
  className = "", 
  onImageClick,
  title,
  eventDate,
  category,
  viewerMode = false,
  enableZoomPan = false
}: EnhancedImageViewerProps) {
  const [isVerticalImage, setIsVerticalImage] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<string>("1 / 1");
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Zoom and pan state
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // Helper function to get the correct image URL for memories
  const getMemoryImageUrl = (imageUrl: string | undefined): string => {
    if (!imageUrl) return '/placeholder-image.jpg';
    
    // Memory images are served directly from /public, so we need to ensure the URL is correct
    if (imageUrl.startsWith('/uploads/')) {
      return `/public${imageUrl}`;
    }
    if (imageUrl.startsWith('/public/uploads/')) {
      return imageUrl;
    }
    // If it doesn't start with uploads, assume it's already a full URL
    return imageUrl;
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const ratio = `${img.naturalWidth} / ${img.naturalHeight}`;
    setAspectRatio(ratio);
    
    // Detect if this is a vertical image (portrait)
    const isVertical = img.naturalHeight > img.naturalWidth;
    setIsVerticalImage(isVertical);
    setIsLoaded(true);
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    console.error('Failed to load memory image:', src);
    console.error('Attempted URL:', e.currentTarget.src);
    e.currentTarget.src = '/placeholder-image.jpg';
  };

  // Zoom handlers
  const handleWheel = (e: React.WheelEvent) => {
    if (!enableZoomPan) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale(prev => Math.min(Math.max(0.5, prev + delta), 4));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!enableZoomPan || scale === 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!enableZoomPan || !isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const resetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const zoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 4));
  };

  const zoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.5));
  };

  return (
    <div 
      ref={imageContainerRef}
      className={`group relative rounded-lg overflow-hidden ${enableZoomPan ? 'cursor-move' : 'cursor-pointer'} ${className}`}
      style={{ 
        aspectRatio: isLoaded ? aspectRatio : "1 / 1",
        // For vertical images (9:16 or portrait), allow larger height up to 720px
        // For horizontal images, keep reasonable max height
        maxHeight: isVerticalImage ? '45rem' : '24rem', // 720px for vertical, 384px for horizontal
        maxWidth: isVerticalImage ? '25rem' : '100%', // 400px max width for vertical images
        width: 'fit-content',
        margin: '0 auto'
      }}
      onClick={!enableZoomPan ? onImageClick : undefined}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      data-testid="enhanced-image-viewer"
    >
      <img
        src={getMemoryImageUrl(src)}
        alt={alt}
        className="w-full h-full object-cover"
        style={enableZoomPan ? {
          transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
          transition: isDragging ? 'none' : 'transform 0.1s ease-out'
        } : undefined}
        onLoad={handleImageLoad}
        onError={handleImageError}
        data-testid="memory-image"
        draggable={false}
      />
      
      {/* Hover overlay - only show when zoom/pan is not enabled */}
      {!enableZoomPan && (
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity flex items-center justify-center">
          {viewerMode ? (
            <div className="text-white transform scale-0 group-hover:scale-100 transition-transform text-center">
              <Search className="mx-auto text-2xl mb-2" />
              {title && <div className="text-sm font-medium">{title}</div>}
              {eventDate && <div className="text-xs">{eventDate}</div>}
              {category && (
                <div className="text-xs opacity-80 capitalize">{category.replace('_', ' ')}</div>
              )}
            </div>
          ) : (
            <div className="p-3 text-white transform translate-y-full group-hover:translate-y-0 transition-transform flex items-end">
              <div>
                {title && <div className="text-sm font-medium">{title}</div>}
                {eventDate && <div className="text-xs">{eventDate}</div>}
                {category && (
                  <div className="text-xs opacity-80 capitalize">{category.replace('_', ' ')}</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Zoom controls */}
      {enableZoomPan && (
        <div className="absolute top-2 right-2 flex flex-col gap-1 bg-black/50 rounded-lg p-1">
          <button
            onClick={(e) => { e.stopPropagation(); zoomIn(); }}
            className="p-1.5 hover:bg-white/20 rounded transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4 text-white" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); zoomOut(); }}
            className="p-1.5 hover:bg-white/20 rounded transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4 text-white" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); resetZoom(); }}
            className="p-1.5 hover:bg-white/20 rounded transition-colors"
            title="Reset View"
          >
            <RotateCcw className="h-4 w-4 text-white" />
          </button>
        </div>
      )}
    </div>
  );
}