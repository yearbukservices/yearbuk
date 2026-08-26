import { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ZoomIn, ZoomOut, Save, X } from 'lucide-react';

interface ImageCropDialogProps {
  isOpen: boolean;
  onClose: () => void;
  imageFile: File | null;
  onSave: (croppedBlob: Blob) => void;
  aspectRatio?: number; // Width/Height ratio (e.g., 3 for 3:1). If undefined, uses circular crop
  minWidth?: number; // Minimum width for output image
  minHeight?: number; // Minimum height for output image
  cropLabel?: string; // Custom label for the crop purpose
  saveButtonText?: string;
  closeOnSave?: boolean;
}

const CROP_SIZE = 300; // Fixed crop size in pixels for circular
const MIN_IMAGE_SIZE = 200; // Minimum image dimension required

export default function ImageCropDialog({
  isOpen,
  onClose,
  imageFile,
  onSave,
  aspectRatio,
  minWidth,
  minHeight,
  cropLabel,
  saveButtonText,
  closeOnSave = true,
}: ImageCropDialogProps) {
  // Determine if this is a rectangular or circular crop
  const isRectangular = aspectRatio !== undefined;
  const cropTypeLabel = cropLabel || (isRectangular ? 'banner' : 'logo');
  const cropWidth = isRectangular ? 450 : CROP_SIZE; // Wider for banner
  const cropHeight = isRectangular ? cropWidth / aspectRatio : CROP_SIZE;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load image when file changes
  useEffect(() => {
    if (!imageFile) return;

    const img = new Image();
    img.onload = () => {
      // Check if image is too small
      if (img.width < MIN_IMAGE_SIZE || img.height < MIN_IMAGE_SIZE) {
        setError(`Image is too small. Minimum size is ${MIN_IMAGE_SIZE}x${MIN_IMAGE_SIZE} pixels.`);
        setImage(null);
        return;
      }

      setError(null);
      setImage(img);
      
      // Calculate the fitted image dimensions independently from the crop viewport.
      // The canvas must be large enough for both. This is important for portrait
      // images: a 231px-wide image still needs to display a 450px-wide square crop.
      const maxSize = 500;
      const baseScale = Math.min(maxSize / img.width, maxSize / img.height);
      const imageWidth = img.width * baseScale;
      const imageHeight = img.height * baseScale;
      const canvasWidth = Math.max(imageWidth, cropWidth);
      const canvasHeight = Math.max(imageHeight, cropHeight);
      
      // Calculate min zoom (crop must stay within image bounds)
      const minZoomCalc = Math.max(
        cropWidth / canvasWidth,
        cropHeight / canvasHeight
      );
      
      // Max zoom for detail viewing
      const maxZoomCalc = 4;
      
      // Start slider in the MIDDLE of the range
      const initialZoom = (minZoomCalc + maxZoomCalc) / 2;
      
      setZoom(initialZoom);
      setPosition({ x: 0, y: 0 });
    };
    
    img.onerror = () => {
      setError('Failed to load image. Please try a different image.');
      setImage(null);
    };

    const url = URL.createObjectURL(imageFile);
    img.src = url;

    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  // Draw the image with crop overlay
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const previewCanvas = previewCanvasRef.current;
    if (!canvas || !previewCanvas || !image) return;

    const ctx = canvas.getContext('2d');
    const previewCtx = previewCanvas.getContext('2d');
    if (!ctx || !previewCtx) return;

    // Fit the image into a 500px bounding box, then make sure the canvas also
    // contains the complete crop viewport. Without this, a portrait image can
    // make the square crop wider than the canvas itself.
    const maxSize = 500;
    const scale = Math.min(maxSize / image.width, maxSize / image.height);
    const imageWidth = image.width * scale;
    const imageHeight = image.height * scale;
    const canvasWidth = Math.max(imageWidth, cropWidth);
    const canvasHeight = Math.max(imageHeight, cropHeight);

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Scale the image itself with zoom. The canvas may be wider than the
    // fitted image to contain the crop viewport, so using canvas dimensions
    // here would distort portrait and landscape images.
    const imgWidth = imageWidth * zoom;
    const imgHeight = imageHeight * zoom;

    // Crop is always centered on canvas
    const cropX = (canvasWidth - cropWidth) / 2;
    const cropY = (canvasHeight - cropHeight) / 2;
    const cropCenterX = cropX + cropWidth / 2;
    const cropCenterY = cropY + cropHeight / 2;
    
    // Constrain position using symmetric bounds relative to crop center
    const maxOffsetX = Math.max(0, (imgWidth - cropWidth) / 2);
    const maxOffsetY = Math.max(0, (imgHeight - cropHeight) / 2);
    
    const constrainedX = Math.max(-maxOffsetX, Math.min(maxOffsetX, position.x));
    const constrainedY = Math.max(-maxOffsetY, Math.min(maxOffsetY, position.y));

    // Draw image centered on crop, offset by position
    const imgX = cropCenterX - (imgWidth / 2) + constrainedX;
    const imgY = cropCenterY - (imgHeight / 2) + constrainedY;
    ctx.drawImage(image, imgX, imgY, imgWidth, imgHeight);

    // Draw dark overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    if (isRectangular) {
      // Clear crop area (make it transparent) - RECTANGULAR
      ctx.clearRect(cropX, cropY, cropWidth, cropHeight);
      
      // Redraw image in rectangular crop area only
      ctx.save();
      ctx.beginPath();
      ctx.rect(cropX, cropY, cropWidth, cropHeight);
      ctx.clip();
      ctx.drawImage(image, imgX, imgY, imgWidth, imgHeight);
      ctx.restore();

      // Draw rectangular crop border
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(cropX, cropY, cropWidth, cropHeight);

      // Draw corner indicators for rectangular crop
      ctx.fillStyle = '#ffffff';
      const cornerSize = 15;
      const cornerOffset = 5;
      
      // Top-left
      ctx.fillRect(cropX - 1, cropY - 1, cornerSize, 2);
      ctx.fillRect(cropX - 1, cropY - 1, 2, cornerSize);
      
      // Top-right
      ctx.fillRect(cropX + cropWidth - cornerSize + 1, cropY - 1, cornerSize, 2);
      ctx.fillRect(cropX + cropWidth - 1, cropY - 1, 2, cornerSize);
      
      // Bottom-left
      ctx.fillRect(cropX - 1, cropY + cropHeight - 1, cornerSize, 2);
      ctx.fillRect(cropX - 1, cropY + cropHeight - cornerSize + 1, 2, cornerSize);
      
      // Bottom-right
      ctx.fillRect(cropX + cropWidth - cornerSize + 1, cropY + cropHeight - 1, cornerSize, 2);
      ctx.fillRect(cropX + cropWidth - 1, cropY + cropHeight - cornerSize + 1, 2, cornerSize);
    } else {
      // Clear crop area (make it transparent) - CIRCULAR
      ctx.save();
      ctx.beginPath();
      const centerX = cropX + cropWidth / 2;
      const centerY = cropY + cropHeight / 2;
      const radius = cropWidth / 2;
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.clip();
      ctx.clearRect(cropX, cropY, cropWidth, cropHeight);
      
      // Redraw image in circular crop area only
      ctx.drawImage(image, imgX, imgY, imgWidth, imgHeight);
      ctx.restore();

      // Draw circular crop border
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.stroke();

      // Draw circular indicators (small dots around the circle)
      ctx.fillStyle = '#ffffff';
      const indicatorRadius = 3;
      const angles = [0, Math.PI/2, Math.PI, 3*Math.PI/2]; // Top, right, bottom, left
      
      angles.forEach(angle => {
        const dotX = centerX + Math.cos(angle) * (radius - 10);
        const dotY = centerY + Math.sin(angle) * (radius - 10);
        ctx.beginPath();
        ctx.arc(dotX, dotY, indicatorRadius, 0, 2 * Math.PI);
        ctx.fill();
      });
    }

    // Draw preview
    if (isRectangular) {
      // Rectangular preview maintaining aspect ratio
      const previewWidth = 150;
      const previewHeight = previewWidth / aspectRatio;
      previewCanvas.width = previewWidth;
      previewCanvas.height = previewHeight;
      previewCtx.clearRect(0, 0, previewWidth, previewHeight);
      
      // Draw cropped area to preview
      previewCtx.drawImage(
        canvas,
        cropX, cropY, cropWidth, cropHeight,
        0, 0, previewWidth, previewHeight
      );
      
      // Add border to preview
      previewCtx.strokeStyle = '#ffffff';
      previewCtx.lineWidth = 2;
      previewCtx.strokeRect(0, 0, previewWidth, previewHeight);
    } else {
      // Circular preview
      previewCanvas.width = 100;
      previewCanvas.height = 100;
      previewCtx.clearRect(0, 0, 100, 100);
      
      // Create circular clipping for preview
      previewCtx.save();
      previewCtx.beginPath();
      previewCtx.arc(50, 50, 50, 0, 2 * Math.PI);
      previewCtx.clip();
      
      // Draw cropped area to preview
      previewCtx.drawImage(
        canvas,
        cropX, cropY, cropWidth, cropHeight,
        0, 0, 100, 100
      );
      previewCtx.restore();
      
      // Add circular border to preview
      previewCtx.strokeStyle = '#ffffff';
      previewCtx.lineWidth = 2;
      previewCtx.beginPath();
      previewCtx.arc(50, 50, 49, 0, 2 * Math.PI);
      previewCtx.stroke();
    }
  }, [image, zoom, position]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // Calculate min and max zoom based on image size
  const minZoom = image 
    ? (() => {
        const maxSize = 500;
        const baseScale = Math.min(maxSize / image.width, maxSize / image.height);
        const imageWidth = image.width * baseScale;
        const imageHeight = image.height * baseScale;
        // Min zoom ensures the crop stays within the actual image bounds
        return Math.max(
          cropWidth / imageWidth,
          cropHeight / imageHeight
        );
      })()
    : 1;
  
  const maxZoom = 4;

  // Handle pointer events for dragging. Pointer events work with mouse,
  // touch, and stylus input, while pointer capture keeps the gesture active
  // even when a finger moves outside the canvas.
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!image) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging || !image) return;
    
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    
    // Calculate max offsets based on current zoom
    const maxSize = 500;
    const baseScale = Math.min(maxSize / image.width, maxSize / image.height);
    const canvasWidth = image.width * baseScale;
    const canvasHeight = image.height * baseScale;
    const imgWidth = canvasWidth * zoom;
    const imgHeight = canvasHeight * zoom;
    
    const maxOffsetX = Math.max(0, (imgWidth - cropWidth) / 2);
    const maxOffsetY = Math.max(0, (imgHeight - cropHeight) / 2);
    
    // Clamp position
    const clampedX = Math.max(-maxOffsetX, Math.min(maxOffsetX, newX));
    const clampedY = Math.max(-maxOffsetY, Math.min(maxOffsetY, newY));
    
    setPosition({ x: clampedX, y: clampedY });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setIsDragging(false);
  };

  // Handle zoom
  const handleZoomChange = (value: number[]) => {
    if (!image) return;
    
    const newZoom = value[0];
    
    // Recalculate position constraints with new zoom
    const maxSize = 500;
    const baseScale = Math.min(maxSize / image.width, maxSize / image.height);
    const canvasWidth = image.width * baseScale;
    const canvasHeight = image.height * baseScale;
    const imgWidth = canvasWidth * newZoom;
    const imgHeight = canvasHeight * newZoom;
    
    const maxOffsetX = Math.max(0, (imgWidth - cropWidth) / 2);
    const maxOffsetY = Math.max(0, (imgHeight - cropHeight) / 2);
    
    // Clamp current position to new bounds
    const clampedX = Math.max(-maxOffsetX, Math.min(maxOffsetX, position.x));
    const clampedY = Math.max(-maxOffsetY, Math.min(maxOffsetY, position.y));
    
    setZoom(newZoom);
    setPosition({ x: clampedX, y: clampedY });
  };

  const handleZoomIn = () => {
    if (!image) return;
    const newZoom = Math.min(zoom + 0.2, maxZoom);
    handleZoomChange([newZoom]);
  };

  const handleZoomOut = () => {
    if (!image) return;
    const newZoom = Math.max(zoom - 0.2, minZoom);
    handleZoomChange([newZoom]);
  };

  // Generate cropped blob
  const handleSave = async () => {
    if (!image || !canvasRef.current) return;

    setIsLoading(true);
    
    try {
      // Create a temporary canvas for the final crop
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return;

      // Set final crop size to high resolution
      // This crops at original resolution, not the scaled preview size
      const finalWidth = minWidth || (isRectangular ? 1200 : 1200);
      const finalHeight = minHeight || (isRectangular ? finalWidth / aspectRatio : 1200);
      tempCanvas.width = finalWidth;
      tempCanvas.height = finalHeight;

      // Calculate the actual crop area in original image coordinates
      const baseScale = Math.min(500 / image.width, 500 / image.height);
      const canvasWidth = image.width * baseScale;
      const canvasHeight = image.height * baseScale;
      
      // Zoomed image dimensions in canvas pixels
      const imgWidth = canvasWidth * zoom;
      const imgHeight = canvasHeight * zoom;
      
      // Crop is centered on canvas
      const cropCenterX = canvasWidth / 2;
      const cropCenterY = canvasHeight / 2;
      
      // Image center position on canvas (offset by pan position)
      const imgCenterX = cropCenterX + position.x;
      const imgCenterY = cropCenterY + position.y;
      
      // Top-left corner of image on canvas
      const imgX = imgCenterX - (imgWidth / 2);
      const imgY = imgCenterY - (imgHeight / 2);
      
      // Crop area on canvas
      const cropX = (canvasWidth - cropWidth) / 2;
      const cropY = (canvasHeight - cropHeight) / 2;
      
      // What part of the zoomed image is in the crop area
      const cropStartXInZoomedImage = cropX - imgX;
      const cropStartYInZoomedImage = cropY - imgY;
      
      // Convert to original image coordinates
      const sourceX = cropStartXInZoomedImage * (image.width / imgWidth);
      const sourceY = cropStartYInZoomedImage * (image.height / imgHeight);
      const sourceWidth = cropWidth * (image.width / imgWidth);
      const sourceHeight = cropHeight * (image.height / imgHeight);

      if (isRectangular) {
        // Rectangular crop - no clipping needed
        tempCtx.drawImage(
          image,
          sourceX, sourceY, sourceWidth, sourceHeight,
          0, 0, finalWidth, finalHeight
        );
        
        // Convert to blob as JPEG for banners
        tempCanvas.toBlob((blob) => {
          if (blob) {
            onSave(blob);
            if (closeOnSave) onClose();
          }
        }, 'image/jpeg', 0.95);
      } else {
        // Create circular mask and draw the cropped portion
        tempCtx.save();
        tempCtx.beginPath();
        tempCtx.arc(finalWidth / 2, finalHeight / 2, finalWidth / 2, 0, 2 * Math.PI);
        tempCtx.clip();
        
        tempCtx.drawImage(
          image,
          sourceX, sourceY, sourceWidth, sourceHeight,
          0, 0, finalWidth, finalHeight
        );
        
        tempCtx.restore();

        // Convert to blob as PNG to preserve transparency
        tempCanvas.toBlob((blob) => {
          if (blob) {
            onSave(blob);
            onClose();
          }
        }, 'image/png');
      }
      
    } catch (error) {
      console.error('Error creating crop:', error);
      setError('Failed to crop image. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-gray-900 border-gray-700 text-white" aria-describedby="crop-dialog-description">
        <DialogHeader>
          <DialogTitle className="text-white">
            {cropLabel ? "Crop " + cropLabel : (isRectangular ? 'Crop Banner Image' : 'Crop Logo Image')}
          </DialogTitle>
          <DialogDescription id="crop-dialog-description" className="text-gray-300">
            {cropLabel
              ? "Adjust the position and zoom of your " + cropLabel + ". Select the portion of the image you want to keep."
              : isRectangular
                ? `Adjust the position and zoom of your banner to create a ${aspectRatio}:1 crop. Use the controls below to position your image perfectly.`
                : 'Adjust the position and zoom of your logo to create a circular crop. Use the controls below to position your image perfectly.'
            }
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {error ? (
            <div className="text-center py-8">
              <p className="text-red-400 mb-4">{error}</p>
              <Button onClick={onClose} variant="outline" className="border-gray-600 text-white hover:bg-gray-800">
                Try Different Image
              </Button>
            </div>
          ) : (
            <>
              {/* Canvas Container */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <div 
                    className="relative border border-gray-600 rounded-lg overflow-hidden bg-gray-800 flex items-center justify-center"
                    style={{ minHeight: '400px' }}
                  >
                    {image ? (
                      <canvas
                        ref={canvasRef}
                        className="cursor-move touch-none select-none"
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                        style={{
                          maxWidth: '100%',
                          maxHeight: '400px',
                          touchAction: 'none',
                        }}
                      />
                    ) : (
                      <div className="text-gray-400">Loading image...</div>
                    )}
                  </div>
                </div>
                
                {/* Preview */}
                <div className="flex flex-col items-center gap-2">
                  <p className="text-sm text-gray-400">Preview</p>
                  <div className="border border-gray-600 rounded-lg overflow-hidden">
                    <canvas ref={previewCanvasRef} className="block" />
                  </div>
                </div>
              </div>

              {/* Zoom Controls */}
              {image && (
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Button
                      onClick={handleZoomOut}
                      disabled={zoom <= minZoom}
                      variant="outline"
                      size="icon"
                      className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl text-white disabled:opacity-30 h-9 w-9"
                      data-testid="button-zoom-out"
                    >
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                    <Slider
                      value={[zoom]}
                      onValueChange={handleZoomChange}
                      min={minZoom}
                      max={maxZoom}
                      step={0.1}
                      className="flex-1 [&_[role=slider]]:bg-white [&_[role=slider]]:border-white"
                      data-testid="slider-zoom"
                    />
                    <Button
                      onClick={handleZoomIn}
                      disabled={zoom >= maxZoom}
                      variant="outline"
                      size="icon"
                      className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl text-white disabled:opacity-30 h-9 w-9"
                      data-testid="button-zoom-in"
                    >
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-gray-400 text-center">
                    Drag to reposition • Zoom out to fit more, zoom in for details • {cropLabel ? "Selected area will be saved as " + cropTypeLabel : (isRectangular ? 'Rectangular area will be saved as banner' : 'Circular area will be saved as logo')}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 justify-end">
                <Button 
                  onClick={onClose} 
                  variant="outline" 
                  className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl text-white"
                  data-testid="button-cancel-crop"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button 
                  onClick={handleSave} 
                  disabled={!image || isLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  data-testid={cropLabel ? "button-save-crop" : (isRectangular ? "button-save-banner" : "button-save-logo")}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isLoading ? 'Saving...' : (saveButtonText || (isRectangular ? 'Save Banner' : 'Save Logo'))}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}