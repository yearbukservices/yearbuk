import { Search, Video, Play } from "lucide-react";
import type { Memory } from "@shared/schema";
import EnhancedVideoPlayer from "./enhanced-video-player";
import EnhancedImageViewer from "./enhanced-image-viewer";

interface PhotoGalleryProps {
  memories: Memory[];
  viewerMode?: boolean;
  onImageClick?: (memory: Memory, index: number) => void;
}

export default function PhotoGallery({ memories, viewerMode = false, onImageClick }: PhotoGalleryProps) {

  return (
    <div className="grid grid-cols-3 gap-2">
      {memories.map((memory, index) => (
        <div key={memory.id} className="w-full max-w-md">
          {memory.mediaType === 'image' && memory.imageUrl ? (
            <EnhancedImageViewer
              src={memory.imageUrl || undefined}
              alt={memory.title}
              title={memory.title}
              eventDate={memory.eventDate}
              category={memory.category}
              viewerMode={viewerMode}
              onImageClick={() => onImageClick?.(memory, index)}
            />
          ) : memory.mediaType === 'video' && memory.videoUrl ? (
            <EnhancedVideoPlayer
              src={memory.videoUrl}
              title={memory.title}
              className="w-full"
              muted={true}
              onVideoClick={() => onImageClick?.(memory, index)}
            />
          ) : (
            // Fallback for memories with missing media or older format
            <EnhancedImageViewer
              src={memory.imageUrl || undefined}
              alt={memory.title}
              title={memory.title}
              eventDate={memory.eventDate}
              category={memory.category}
              viewerMode={viewerMode}
              onImageClick={() => onImageClick?.(memory, index)}
            />
          )}
        </div>
      ))}
    </div>
  );
}
