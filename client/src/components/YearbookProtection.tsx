import { useEffect } from 'react';

/**
 * YearbookProtection Component
 * Adds global event listeners to prevent downloading, saving, and copying yearbook images
 * - Blocks right-click context menu on yearbook images
 * - Prevents long-press save on mobile devices (iOS Safari, Android Chrome)
 * - Disables drag-and-drop of images
 */
export function YearbookProtection() {
  useEffect(() => {
    // Prevent context menu (right-click) on yearbook images
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'IMG' && 
        (target.classList.contains('protected-image') || 
         target.classList.contains('yearbook-page-image'))
      ) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    // Prevent long-press on touch devices (iOS Safari)
    const handleTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'IMG' && 
        (target.classList.contains('protected-image') || 
         target.classList.contains('yearbook-page-image'))
      ) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    // Prevent drag start on images
    const handleDragStart = (e: DragEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'IMG' && 
        (target.classList.contains('protected-image') || 
         target.classList.contains('yearbook-page-image'))
      ) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    // Add event listeners
    document.addEventListener('contextmenu', handleContextMenu, { capture: true });
    document.addEventListener('touchstart', handleTouchStart, { passive: false, capture: true });
    document.addEventListener('dragstart', handleDragStart, { capture: true });

    // Cleanup on unmount
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu, { capture: true });
      document.removeEventListener('touchstart', handleTouchStart, { capture: true });
      document.removeEventListener('dragstart', handleDragStart, { capture: true });
    };
  }, []);

  // This component doesn't render anything
  return null;
}
