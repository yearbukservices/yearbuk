import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Download, ZoomIn, ZoomOut, Maximize2, BookOpen, FileText, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { Yearbook, School, TableOfContentsItem} from "@shared/schema";
import { useIsMobile } from "@/hooks/use-mobile";
import { getSecureImageUrl } from "@/lib/secure-image";
import { navigateBack } from "@/lib/navigation";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function YearbookPreview() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/preview/:year");
  const year = params?.year || "2000";
  
  // Get school ID from URL parameters - always in preview mode for admin previews
  const urlParams = new URLSearchParams(window.location.search);
  const schoolId = urlParams.get('school');
  const isPreviewMode = true; // Always preview mode for admin previews
  
  const [user, setUser] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState('cover');
  const [isSpreadView, setIsSpreadView] = useState(true); // Manual toggle for single vs spread view

  // Pan/drag states
  const [isPanning, setIsPanning] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });
  const [startPanPoint, setStartPanPoint] = useState({ x: 0, y: 0 });
  const [showHamburgerMenu, setShowHamburgerMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Use both yearbook orientation and mobile detection
  const [isPortrait, setIsPortrait] = useState(true); // default portrait
  const isMobile = useIsMobile();

  // Reset pan when changing pages or view mode
  useEffect(() => {
    setPanOffset({ x: 0, y: 0 });
  }, [currentPage, viewMode]);

  // Fetch yearbook data - use regular endpoint for preview mode, published endpoint for viewers
  const apiEndpoint = isPreviewMode ? `/api/yearbooks/${schoolId}/${year}` : `/api/published-yearbooks/${schoolId}/${year}`;
  const { data: yearbook, isLoading: yearbookLoading } = useQuery<Yearbook>({
    queryKey: [apiEndpoint],
    enabled: !!schoolId && !!year,
    queryFn: async () => {
      const res = await fetch(apiEndpoint);
      if (!res.ok) throw new Error("Yearbook not found");
      return res.json();
    },
  });

  // Update orientation based on yearbook settings and device type
  useEffect(() => {
    if (yearbook?.orientation) {
      setIsPortrait(yearbook.orientation === 'portrait');
      // Set view mode based on orientation and device:
      // - Mobile devices always show single pages for better viewing
      // - Landscape yearbooks show single pages
      // - Portrait yearbooks on desktop show spreads
      if (isMobile || yearbook.orientation === 'landscape') {
        setViewMode('single');
      } else {
        setViewMode('spread');
      }
    }
  }, [yearbook?.orientation, isMobile]);

  // Fetch school data
  const { data: school } = useQuery<School>({
    queryKey: ["/api/schools", schoolId],
    enabled: !!schoolId,
  });

  

 

  

  

  // Pages are included in the yearbook data from the API
  const yearbookPages = (yearbook as any)?.pages || [];

  // Table of contents is included in the yearbook data from the API
  const tableOfContents = (yearbook as any)?.tableOfContents || [];

  const hasContent = !!yearbook && !!yearbookPages && yearbookPages.length > 0;
  const totalPages = yearbookPages?.length || 0;
  
  // Get front cover, back cover, and content pages
  const frontCover = yearbookPages?.find((p: any) => p.pageType === "front_cover");
  const backCover = yearbookPages?.find((p: any) => p.pageType === "back_cover");
  const contentPages = yearbookPages?.filter((p: any) => p.pageType === "content")?.sort((a: any, b: any) => a.pageNumber - b.pageNumber) || [];

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      const parsedUser = JSON.parse(userData);
      // Only allow school accounts to access this preview page
      if (parsedUser.userType !== 'school') {
        setLocation("/"); // Redirect non-school users
        return;
      }
      setUser(parsedUser);
    } else {
      setLocation("/"); // Redirect if no user
    }
  }, [setLocation]);

  // Improved pan/drag event handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel > 100) {
      setIsPanning(true);
      const point = { x: e.clientX, y: e.clientY };
      setLastPanPoint(point);
      setStartPanPoint(point);
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning && zoomLevel > 100) {
      const deltaX = e.clientX - lastPanPoint.x;
      const deltaY = e.clientY - lastPanPoint.y;

      setPanOffset(prev => {
        const newX = prev.x + deltaX;
        const newY = prev.y + deltaY;
        
        // Add bounds checking to prevent panning too far - increased for higher zoom levels
        const maxOffset = (zoomLevel - 100) * 3; // Increased for higher zoom support
        return {
          x: Math.max(-maxOffset, Math.min(maxOffset, newX)),
          y: Math.max(-maxOffset, Math.min(maxOffset, newY))
        };
      });

      setLastPanPoint({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isPanning) {
      // Check if this was a click (very small movement) vs a drag
      const distanceMoved = Math.sqrt(
        Math.pow(e.clientX - startPanPoint.x, 2) + 
        Math.pow(e.clientY - startPanPoint.y, 2)
      );
      
      // If movement was minimal, treat as click for page navigation
      if (distanceMoved < 5 && zoomLevel <= 100) {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const isLeftSide = x < rect.width / 2;
        
        if (isLeftSide) {
          handlePrevious();
        } else {
          handleNext();
        }
      }
    }
    setIsPanning(false);
  };

  // Improved touch events for mobile panning
  const handleTouchStart = (e: React.TouchEvent) => {
    if (zoomLevel > 100 && e.touches.length === 1) {
      setIsPanning(true);
      const point = { 
        x: e.touches[0].clientX, 
        y: e.touches[0].clientY 
      };
      setLastPanPoint(point);
      setStartPanPoint(point);
      e.preventDefault();
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isPanning && zoomLevel > 100 && e.touches.length === 1) {
      const deltaX = e.touches[0].clientX - lastPanPoint.x;
      const deltaY = e.touches[0].clientY - lastPanPoint.y;

      setPanOffset(prev => {
        const newX = prev.x + deltaX;
        const newY = prev.y + deltaY;
        
        const maxOffset = (zoomLevel - 100) * 3;
        return {
          x: Math.max(-maxOffset, Math.min(maxOffset, newX)),
          y: Math.max(-maxOffset, Math.min(maxOffset, newY))
        };
      });

      setLastPanPoint({ 
        x: e.touches[0].clientX, 
        y: e.touches[0].clientY 
      });
      e.preventDefault();
    }
  };

  const handleTouchEnd = () => {
    setIsPanning(false);
  };

  // Add mouse leave handler to stop panning if mouse leaves the area
  useEffect(() => {
    const handleMouseLeave = () => setIsPanning(false);
    const handleMouseUpGlobal = () => setIsPanning(false);

    document.addEventListener('mouseup', handleMouseUpGlobal);
    document.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      document.removeEventListener('mouseup', handleMouseUpGlobal);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  // Handle click outside hamburger menu and notifications to close them
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      
      if (showHamburgerMenu) {
        if (!target.closest('[data-testid="button-hamburger-menu"]') && !target.closest('.hamburger-dropdown')) {
          setShowHamburgerMenu(false);
        }
      }
      
      if (showNotifications) {
        if (!target.closest('[data-testid="button-notifications"]') && !target.closest('.notification-dropdown')) {
          setShowNotifications(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showHamburgerMenu, showNotifications]);

  const handleBack = () => {
    navigateBack(setLocation);
  };

  

  const handleZoomIn = () => {
    setZoomLevel(prev => {
      const newZoom = Math.min(prev + 25, 500);
      if (newZoom > prev) {
        setPanOffset({ x: 0, y: 0 });
      }
      return newZoom;
    });
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => {
      const newZoom = Math.max(prev - 25, 50);
      if (newZoom <= 100) {
        setPanOffset({ x: 0, y: 0 });
      }
      return newZoom;
    });
  };

  const handleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  

  const goToPage = (page: number) => {
    if (!hasContent) return;
    
    if (page === 0) {
      setViewMode('cover');
      setCurrentPage(0);
    } else if (frontCover && page === 1) {
      setViewMode('cover');
      setCurrentPage(0);
    } else if (backCover && page === totalPages - 1) {
      setViewMode('back');
      setCurrentPage(totalPages - 1);
    } else {
      // Use manual toggle for view mode
      if (!isSpreadView) {
        setViewMode('single');
        const contentPageIndex = Math.max(0, page - (frontCover ? 1 : 0));
        setCurrentPage(contentPageIndex);
      } else {
        // Show two-page spreads
        setViewMode('spread');
        const contentPageIndex = Math.max(0, page - (frontCover ? 1 : 0));
        
        // Calculate the spread position to show correct two-page spread
        // For odd pages (1, 3, 5, etc.), show them on the left with next page on right
        // For even pages (2, 4, 6, etc.), show them on the right with previous page on left
        let spreadIndex;
        if (contentPageIndex % 2 === 0) {
          // Even index (odd page number) - this should be the left page
          spreadIndex = contentPageIndex;
        } else {
          // Odd index (even page number) - this should be on the right, so show previous spread
          spreadIndex = contentPageIndex - 1;
        }
        
        setCurrentPage(Math.max(0, spreadIndex));
      }
    }
  };

  const handleCoverClick = () => {
    if (!hasContent) return;
    setViewMode(isSpreadView ? 'spread' : 'single');
    setCurrentPage(0); // Start with first content page
  };

  const handlePrevious = () => {
    if (!hasContent) return;
    
    if (viewMode === 'cover') {
      return; // Can't go before front cover
    } else if (viewMode === 'back') {
      if (contentPages.length > 0) {
        const targetMode = isSpreadView ? 'spread' : 'single';
        setViewMode(targetMode);
        const lastContentIndex = targetMode === 'single' ? contentPages.length - 1 : Math.max(0, contentPages.length - 2);
        setCurrentPage(lastContentIndex);
      } else if (frontCover) {
        setViewMode('cover');
        setCurrentPage(0);
      }
    } else if (viewMode === 'spread') {
      if (currentPage <= 0) {
        if (frontCover) {
          setViewMode('cover');
          setCurrentPage(0);
        }
      } else {
        setCurrentPage(Math.max(0, currentPage - 2));
      }
    } else if (viewMode === 'single') {
      if (currentPage <= 0) {
        if (frontCover) {
          setViewMode('cover');
          setCurrentPage(0);
        }
      } else {
        setCurrentPage(Math.max(0, currentPage - 1));
      }
    }
  };

  const handleNext = () => {
    if (!hasContent) return;
    
    if (viewMode === 'cover') {
      if (contentPages.length > 0) {
        const targetMode = isSpreadView ? 'spread' : 'single';
        setViewMode(targetMode);
        setCurrentPage(0);
      } else if (backCover) {
        setViewMode('back');
        setCurrentPage(totalPages - 1);
      }
    } else if (viewMode === 'back') {
      return; // Can't go past back cover
    } else if (viewMode === 'spread') {
      if (currentPage + 2 >= contentPages.length) {
        if (backCover) {
          setViewMode('back');
          setCurrentPage(totalPages - 1);
        }
      } else {
        setCurrentPage(Math.min(contentPages.length - 2, currentPage + 2));
      }
    } else if (viewMode === 'single') {
      if (currentPage + 1 >= contentPages.length) {
        if (backCover) {
          setViewMode('back');
          setCurrentPage(totalPages - 1);
        }
      } else {
        setCurrentPage(currentPage + 1);
      }
    }
  };

  // Touch area click handlers (only when not panning)
  const handleLeftTouchArea = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isPanning && zoomLevel <= 100) {
      e.preventDefault();
      e.stopPropagation();
      handlePrevious();
    }
  };

  const handleRightTouchArea = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isPanning && zoomLevel <= 100) {
      e.preventDefault();
      e.stopPropagation();
      handleNext();
    }
  };

  // Show loading state while fetching data
  if (yearbookLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center relative overflow-hidden">
        {/* Animated Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-full h-full">
            <div className="absolute top-20 left-20 w-32 h-32 bg-white rounded-full opacity-5 animate-float"></div>
            <div className="absolute top-60 right-40 w-24 h-24 bg-white rounded-full opacity-5 animate-float-delayed"></div>
            <div className="absolute bottom-40 left-40 w-20 h-20 bg-white rounded-full opacity-5 animate-float"></div>
            <div className="absolute bottom-20 right-20 w-16 h-16 bg-white rounded-full opacity-5 animate-float-delayed"></div>
          </div>
        </div>
        <div className="text-center relative z-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-white/80">Loading yearbook...</p>
        </div>
      </div>
    );
  }

  // Render empty state for years without content
  const renderEmptyState = () => (
    <div className="flex justify-center items-center min-h-[60vh] sm:min-h-[70vh] relative">
      <div className="text-center p-8 max-w-md">
        <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-700 mb-2">
          Yearbook {year} Not Available
        </h3>
        <p className="text-gray-500 mb-6">
          The yearbook for {year} has not been published yet. Please check back later or contact the school administration.
        </p>
        <Button onClick={handleBack} className="bg-secondary hover:bg-green-700">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Yearbook Finder
        </Button>
      </div>
    </div>
  );

  const renderPageView = () => {
    if (!hasContent) {
      return renderEmptyState();
    }

    if (viewMode === 'cover') {
      return (
        <div className="flex justify-center items-center min-h-[60vh] sm:min-h-[70vh] relative">
          <div 
            ref={viewportRef}
            className="relative overflow-hidden border border-gray-200 shadow-lg"
            style={{
              width: isPortrait ? '320px' : '800px',
              height: isPortrait ? '440px' : '600px',
              maxWidth: '90vw'
            }}
          >
            <div 
              className="bg-white cursor-pointer hover:shadow-2xl transition-shadow mx-auto relative"
              style={{
                width: '100%',
                height: '100%',
                aspectRatio: isPortrait ? '3/4' : '4/3',
                transform: `scale(${zoomLevel / 100}) translate(${panOffset.x}px, ${panOffset.y}px)`,
                transformOrigin: 'center center'
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onClick={zoomLevel <= 100 ? handleCoverClick : undefined}
            >
              {frontCover ? (
                <div className="h-full relative">
                  <img
                    src={getSecureImageUrl(frontCover.imageUrl)}
                    alt="Front Cover"
                    className="w-full h-full object-cover protected-image"
                  />
                  <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 text-xs text-white bg-black/50 px-2 py-1 rounded">
                    {zoomLevel > 100 ? 'Drag to pan' : 'Click to open'}
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-4 sm:p-8 bg-gradient-to-br from-blue-900 to-blue-700 text-white">
                  <BookOpen className="h-12 w-12 sm:h-16 sm:w-16 mb-3 sm:mb-4 opacity-80" />
                  <h1 className="text-lg sm:text-3xl font-bold mb-1 sm:mb-2">{yearbook?.title}</h1>
                  <p className="text-base sm:text-xl opacity-80">{school?.name}</p>
                  <div className="mt-4 sm:mt-8 text-xs sm:text-sm opacity-60">
                    {zoomLevel > 100 ? 'Drag to pan' : 'Click to open'}
                  </div>
                </div>
              )}

              {zoomLevel <= 100 && (
                <div className="absolute inset-0 flex">
                  <div className="w-1/2 h-full z-10" onClick={handleLeftTouchArea} />
                  <div className="w-1/2 h-full z-10" onClick={handleRightTouchArea} />
                </div>
              )}
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white shadow-lg z-20"
            onClick={handleNext}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      );
    } else if (viewMode === 'back') {
      return (
        <div className="flex justify-center items-center min-h-[60vh] sm:min-h-[70vh] relative">
          <div 
            ref={viewportRef}
            className="relative overflow-hidden border border-gray-200 shadow-lg"
            style={{
              width: isPortrait ? '320px' : '800px',
              height: isPortrait ? '440px' : '600px',
              maxWidth: '90vw'
            }}
          >
            <div 
              className="bg-white cursor-pointer hover:shadow-2xl transition-shadow mx-auto relative"
              style={{
                width: '100%',
                height: '100%',
                aspectRatio: isPortrait ? '3/4' : '4/3',
                transform: `scale(${zoomLevel / 100}) translate(${panOffset.x}px, ${panOffset.y}px)`,
                transformOrigin: 'center center'
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onClick={zoomLevel <= 100 ? handleBackCoverClick : undefined}
            >
              {backCover ? (
                <div className="h-full relative">
                  <img
                    src={getSecureImageUrl(backCover.imageUrl)}
                    alt="Back Cover"
                    className="w-full h-full object-cover protected-image"
                  />
                  <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 text-xs text-white bg-black/50 px-2 py-1 rounded">
                    {zoomLevel > 100 ? 'Drag to pan' : 'Click to go back'}
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-4 sm:p-8 bg-gradient-to-br from-gray-800 to-gray-600 text-white">
                  <Calendar className="h-12 w-12 sm:h-16 sm:w-16 mb-3 sm:mb-4 opacity-80" />
                  <h2 className="text-lg sm:text-2xl font-bold mb-1 sm:mb-2">Back Cover</h2>
                  <p className="text-base sm:text-lg opacity-80">{yearbook?.year}</p>
                  <div className="mt-4 sm:mt-8 text-xs sm:text-sm opacity-60">
                    {zoomLevel > 100 ? 'Drag to pan' : 'Click to go back'}
                  </div>
                </div>
              )}

              {zoomLevel <= 100 && (
                <div className="absolute inset-0 flex">
                  <div className="w-1/2 h-full z-10" onClick={handleLeftTouchArea} />
                  <div className="w-1/2 h-full z-10" onClick={handleRightTouchArea} />
                </div>
              )}
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white shadow-lg z-20"
            onClick={handlePrevious}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      );
    } else {
      // Book spread view
      const leftPage = currentPage;
      const rightPage = currentPage + 1;

      if (isPortrait) {
        return (
          <div className="flex justify-center items-center min-h-[60vh] sm:min-h-[70vh] relative">
            <div 
              ref={viewportRef}
              className="relative overflow-hidden border border-gray-200 shadow-lg"
              style={{
                width: '680px',
                height: '440px',
                maxWidth: '90vw'
              }}
            >
              <div 
                className="flex space-x-0"
                style={{
                  transform: `scale(${zoomLevel / 100}) translate(${panOffset.x}px, ${panOffset.y}px)`,
                  transformOrigin: 'center center'
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                {/* Left Page */}
                {contentPages[currentPage] && (
                  <div className="bg-white shadow-lg border border-gray-300 relative"
                       style={{ width: '340px', height: '440px', aspectRatio: '3/4' }}>
                    <div className="h-full relative">
                      <img
                        src={getSecureImageUrl(contentPages[currentPage].imageUrl)}
                        alt={contentPages[currentPage].title}
                        className="w-full h-full object-cover protected-image"
                      />
                      <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 text-xs text-gray-400 bg-white/80 px-2 py-1 rounded">
                        {zoomLevel > 100 ? 'Drag to pan' : `Page ${currentPage + 1}`}
                      </div>
                    </div>

                    {zoomLevel <= 100 && (
                      <div className="absolute inset-0 z-10" onClick={handleLeftTouchArea} />
                    )}
                  </div>
                )}

                {/* Right Page */}
                {contentPages[currentPage + 1] && (
                  <div className="bg-white shadow-lg border border-gray-300 relative"
                       style={{ width: '340px', height: '440px', aspectRatio: '3/4' }}>
                    <div className="h-full relative">
                      <img
                        src={getSecureImageUrl(contentPages[currentPage + 1].imageUrl)}
                        alt={contentPages[currentPage + 1].title}
                        className="w-full h-full object-cover protected-image"
                      />
                      <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 text-xs text-gray-400 bg-white/80 px-2 py-1 rounded">
                        {zoomLevel > 100 ? 'Drag to pan' : `Page ${currentPage + 2}`}
                      </div>
                    </div>

                    {zoomLevel <= 100 && (
                      <div className="absolute inset-0 z-10" onClick={handleRightTouchArea} />
                    )}
                  </div>
                )}
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white shadow-lg z-20"
              onClick={handlePrevious}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white shadow-lg z-20"
              onClick={handleNext}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        );
      } else if (viewMode === 'single') {
        // Landscape single page view
        return (
          <div className="flex justify-center items-center min-h-[60vh] sm:min-h-[70vh] relative">
            <div 
              ref={viewportRef}
              className="relative overflow-hidden border border-gray-200 shadow-2xl"
              style={{
                width: '800px',  // Single page width
                height: '600px', 
                maxWidth: '95vw'
              }}
            >
              <div 
                className="w-full h-full"
                style={{
                  transform: `scale(${zoomLevel / 100}) translate(${panOffset.x}px, ${panOffset.y}px)`,
                  transformOrigin: 'center center',
                  cursor: zoomLevel > 100 ? (isPanning ? 'grabbing' : 'grab') : 'pointer'
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                {/* Single Page */}
                {contentPages[currentPage] && (
                  <div className="bg-white shadow-lg border border-gray-300 relative w-full h-full">
                    <div className="h-full relative">
                      <img
                        src={getSecureImageUrl(contentPages[currentPage].imageUrl)}
                        alt={contentPages[currentPage].title}
                        className="w-full h-full object-cover protected-image"
                      />
                      <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 text-xs text-gray-400 bg-white/80 px-2 py-1 rounded">
                        {zoomLevel > 100 ? 'Drag to pan around page' : `Page ${currentPage + 1} of ${contentPages.length}`}
                      </div>
                    </div>

                    {zoomLevel <= 100 && (
                      <div className="absolute inset-0 flex">
                        <div className="w-1/2 h-full z-10" onClick={handleLeftTouchArea} />
                        <div className="w-1/2 h-full z-10" onClick={handleRightTouchArea} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white shadow-lg z-20"
              onClick={handlePrevious}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white shadow-lg z-20"
              onClick={handleNext}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        );
      } else {
        // Landscape book spread - optimized for landscape photos
        return (
          <div className="flex justify-center items-center min-h-[60vh] sm:min-h-[70vh] relative">
            <div 
              ref={viewportRef}
              className="relative overflow-hidden border border-gray-200 shadow-2xl"
              style={{
                width: '1100px', // Wider for landscape photos
                height: '450px',  // Shorter for landscape aspect ratio
                maxWidth: '95vw'
              }}
            >
              <div 
                className="flex gap-1"
                style={{
                  transform: `scale(${zoomLevel / 100}) translate(${panOffset.x}px, ${panOffset.y}px)`,
                  transformOrigin: 'center center',
                  cursor: zoomLevel > 100 ? (isPanning ? 'grabbing' : 'grab') : 'pointer'
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                {/* Left Page */}
                {contentPages[currentPage] && (
                  <div className="bg-white border-r border-gray-300 relative"
                       style={{ width: '540px', height: '400px', aspectRatio: '4/3' }}> {/* Landscape aspect ratio */}
                    <div className="h-full relative">
                      <img
                        src={getSecureImageUrl(contentPages[currentPage].imageUrl)}
                        alt={contentPages[currentPage].title}
                        className="w-full h-full object-cover protected-image"
                      />
                      <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 text-xs text-gray-400 bg-white/80 px-2 py-1 rounded">
                        {zoomLevel > 100 ? 'Drag to pan around page' : `Page ${currentPage + 1} of spread`}
                      </div>
                    </div>

                    {zoomLevel <= 100 && (
                      <div className="absolute inset-0 z-10" onClick={handleLeftTouchArea} />
                    )}
                  </div>
                )}

                {/* Book spine/binding */}
                <div className="w-2 bg-gradient-to-b from-gray-200 to-gray-400 shadow-inner"></div>

                {/* Right Page */}
                {contentPages[currentPage + 1] && (
                  <div className="bg-white border-l border-gray-300 relative"
                       style={{ width: '540px', height: '400px', aspectRatio: '4/3' }}> {/* Landscape aspect ratio */}
                    <div className="h-full relative">
                      <img
                        src={getSecureImageUrl(contentPages[currentPage + 1].imageUrl)}
                        alt={contentPages[currentPage + 1].title}
                        className="w-full h-full object-cover protected-image"
                      />
                      <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 text-xs text-gray-400 bg-white/80 px-2 py-1 rounded">
                        {zoomLevel > 100 ? 'Drag to pan around page' : `Page ${currentPage + 2} of spread`}
                      </div>
                    </div>

                    {zoomLevel <= 100 && (
                      <div className="absolute inset-0 z-10" onClick={handleRightTouchArea} />
                    )}
                  </div>
                )}
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white shadow-lg z-20"
              onClick={handlePrevious}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white shadow-lg z-20"
              onClick={handleNext}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        );
      }
    }
  };

  const renderFullscreenView = () => {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col">
        <div className="bg-black/80 text-white p-4 flex justify-between items-center">
          <Button
            onClick={handleFullscreen}
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/20"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Exit Fullscreen
          </Button>

          <div className="text-sm">
            {viewMode === 'cover' ? 'Cover' : 
             viewMode === 'back' ? 'Back Cover' : 
             `Pages ${currentPage} - ${currentPage + 1}`}
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center relative bg-black">
          {renderPageView()}
        </div>

        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex items-center space-x-4 bg-black/80 rounded-full px-6 py-3">
          <Button
            onClick={handleZoomOut}
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/20"
            disabled={zoomLevel <= 50}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>

          <span className="text-white text-sm">{zoomLevel}%</span>

          <Button
            onClick={handleZoomIn}
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/20"
            disabled={zoomLevel >= 500}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <>
      {isFullscreen ? (
        renderFullscreenView()
      ) : (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 relative overflow-hidden">
          {/* Animated Background Pattern */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute top-0 left-0 w-full h-full">
              <div className="absolute top-20 left-20 w-32 h-32 bg-white rounded-full opacity-20 animate-float"></div>
              <div className="absolute top-60 right-40 w-24 h-24 bg-white rounded-full opacity-20 animate-float-delayed"></div>
              <div className="absolute bottom-40 left-40 w-20 h-20 bg-white rounded-full opacity-20 animate-float"></div>
              <div className="absolute bottom-20 right-20 w-16 h-16 bg-white rounded-full opacity-20 animate-float-delayed"></div>
            </div>
          </div>
          {/* Preview Mode Banner */}
          {isPreviewMode && (
            <div className="bg-yellow-500 text-black text-center py-2 px-4">
              <span className="font-medium">📋 Preview Mode</span> - This is how your yearbook will look to viewers after publishing
            </div>
          )}

          {/* Header */}
          <header className="bg-white/10 backdrop-blur-lg border-b border-white/20 shadow-2xl relative">
            {/* Animated Background Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 left-0 w-full h-full">
                <div className="absolute top-2 left-10 w-8 h-8 bg-white rounded-full opacity-5 animate-float"></div>
                <div className="absolute top-3 right-20 w-6 h-6 bg-white rounded-full opacity-5 animate-float-delayed"></div>
                <div className="absolute bottom-2 left-20 w-5 h-5 bg-white rounded-full opacity-5 animate-float"></div>
                <div className="absolute bottom-1 right-10 w-4 h-4 bg-white rounded-full opacity-5 animate-float-delayed"></div>
              </div>
            </div>
            
            <div className="relative z-10 max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
              <div className="flex justify-between items-center h-12 sm:h-16">
                <div className="flex items-center space-x-2 sm:space-x-4">
                  <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                   
                    <div className="min-w-0 flex-1">
                      <h1 className="text-sm sm:text-lg font-semibold text-white truncate">Preview</h1>
                      <p className="text-xs sm:text-sm text-white/80 truncate">{school?.name || "School"}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-1 sm:space-x-4 flex-shrink-0">
                 

                  
                  
                 
                  
                  {user && (
                    <span className="text-xs sm:text-sm font-medium text-white hidden xs:block">
                      <span className="hidden sm:inline">{user.fullName || "User"}</span>
                      <span className="sm:hidden">{user.fullName?.split(" ")[0] || "User"}</span>
                    </span>
                  )}
                  
                </div>
              </div>
            </div>
          </header>

         

         

          <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-3 sm:py-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 sm:gap-6">
              {/* Left Column - Navigation */}
              {hasContent && (
                <div className="lg:col-span-1 order-2 lg:order-1">
                  <Card className="sticky top-3 lg:top-6 bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
                    <CardContent className="p-3 sm:p-4">
                      <h3 className="font-semibold text-white mb-3 sm:mb-4 text-sm sm:text-base">Navigation</h3>
                      
                      {/* Page Controls */}
                      <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
                        <div className="flex items-center space-x-1 sm:space-x-2">
                          <Button
                            onClick={handleZoomOut}
                            variant="outline"
                            size="sm"
                            disabled={zoomLevel <= 50}
                            className="px-2 sm:px-3 bg-gre-200 text-white"
                          >
                            <ZoomOut className="h-3 w-3 sm:h-4 sm:w-4" />
                          </Button>
                          <span className="text-xs sm:text-sm font-medium flex-1 text-center text-white">{zoomLevel}%</span>
                          <Button
                            onClick={handleZoomIn}
                            variant="outline"
                            size="sm"
                            disabled={zoomLevel >= 500}
                            className="px-2 sm:px-3 bg-gre-200 text-white"
                          >
                            <ZoomIn className="h-3 w-3 sm:h-4 sm:w-4" />
                          </Button>
                        </div>

                        <div className="flex items-center justify-between space-x-2 py-2 px-3 bg-white/5 rounded-md border border-white/10">
                          <Label htmlFor="page-view-toggle-preview" className="text-xs sm:text-sm text-white cursor-pointer flex items-center gap-2">
                            <BookOpen className="h-4 w-4" />
                            <span>{isSpreadView ? 'Two Page View' : 'Single Page'}</span>
                          </Label>
                          <Switch
                            id="page-view-toggle-preview"
                            checked={isSpreadView}
                            onCheckedChange={setIsSpreadView}
                            data-testid="toggle-page-view"
                          />
                        </div>

                        <Button
                          onClick={handleFullscreen}
                          variant="outline"
                          className="w-full bg-white-500/40 backdrop-blur-lg border border-whhite shadow-2xl cursor-pointer transition-all hover:bg-white hover:scale-105 hover:border-black text-white hover:text-black"
                          size="sm"
                        >
                          <Maximize2 className="h-4 w-4 mr-2" />
                          Fullscreen
                        </Button>
                      </div>

                      {/* Table of Contents */}
                      <div>
                        <h4 className="font-medium text-white mb-3">Table of Contents</h4>
                        <div className="space-y-1 max-h-64 overflow-y-auto">
                          {/* Front Cover (always first) */}
                          {frontCover && (
                            <button
                              onClick={() => { setViewMode('cover'); setCurrentPage(0); }}
                              className="w-full text-left px-2 py-1 text-sm bg-white-500/40 backdrop-blur-lg  shadow-2xl cursor-pointer transition-all hover:bg-white hover:border-black text-white hover:text-black rounded transition-colors"
                              data-testid="toc-item-front-cover"
                            >
                              <div className="flex justify-between">
                                <span className="truncate">Front Cover</span>
                                <span className="text-xs ml-2">Cover</span>
                              </div>
                            </button>
                          )}
                          
                          {/* Custom Table of Contents */}
                          {tableOfContents.map((item, index) => (
                            <button
                              key={index}
                              onClick={() => goToPage(item.pageNumber)}
                              className="w-full text-left px-2 py-1 text-sm bg-white-500/40 backdrop-blur-lg  shadow-2xl cursor-pointer transition-all hover:bg-white hover:border-black text-white hover:text-black rounded transition-colors"
                              data-testid={`toc-item-${index}`}
                            >
                              <div className="flex justify-between">
                                <span className="truncate">{item.title}</span>
                                <span className="text-xs ml-2">{item.pageNumber}</span>
                              </div>
                            </button>
                          ))}
                          
                          {/* Back Cover (always last) */}
                          {backCover && (
                            <button
                              onClick={() => { setViewMode('back'); setCurrentPage(totalPages - 1); }}
                              className="w-full text-left px-2 py-1 text-sm bg-white-500/40 backdrop-blur-lg  shadow-2xl cursor-pointer transition-all hover:bg-white hover:border-black text-white hover:text-black rounded transition-colors"
                              data-testid="toc-item-back-cover"
                            >
                              <div className="flex justify-between">
                                <span className="truncate">Back Cover</span>
                                <span className="text-xs ml-2">Back</span>
                              </div>
                            </button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Right Column - PDF Viewer */}
              <div className={hasContent ? "lg:col-span-3 order-1 lg:order-2" : "lg:col-span-4 order-1"}>
                <Card
                  className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
                  <CardContent className="p-2 sm:p-4">
                    {renderPageView()}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}