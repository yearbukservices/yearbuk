import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Download, ZoomIn, ZoomOut, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { navigateBack } from "@/lib/navigation";

export default function YearbookViewer() {
  const [, setLocation] = useLocation();
  const [year, setYear] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [zoomLevel, setZoomLevel] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    // Extract year from URL path
    const pathParts = window.location.pathname.split('/');
    const yearFromPath = pathParts[pathParts.length - 1];
    setYear(yearFromPath);
    
    // Extract school ID from query params
    const params = new URLSearchParams(window.location.search);
    const schoolIdFromQuery = params.get('school');
    if (schoolIdFromQuery) {
      setSchoolId(schoolIdFromQuery);
    }
  }, []);

  const handleBack = () => {
    navigateBack(setLocation);
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 25, 500));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 25, 50));
  };

  const totalPages = 120; // Mock total pages

  return (
    <div className="relative z-10 min-h-screen bg-white/5 backdrop-blur-sm">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-pink-600/20"></div>
      <div className="absolute inset-0 bg-gradient-to-tl from-green-600/10 via-blue-600/10 to-purple-600/10"></div>
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-lg border-b border-white/20 shadow-2xl relative overflow-hidden p-3 sm:p-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
          <div className="flex items-center space-x-2 sm:space-x-4 w-full sm:w-auto">
            <Button 
              variant="outline" 
              onClick={handleBack}
              className="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm"
            >
              <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Back to Dashboard</span>
              <span className="sm:hidden">Back</span>
            </Button>
            <div>
              <h1 className="text-lg sm:text-2xl font-bold text-white">Yearbook {year}</h1>
              <p className="text-xs sm:text-sm text-white/70 hidden sm:block">School ID: {schoolId}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 sm:space-x-3 w-full sm:w-auto justify-between sm:justify-end">
            {/* Zoom Controls */}
            <div className="flex items-center space-x-1 sm:space-x-2 bg-white/10 backdrop-blur-lg border border-white/20 rounded-lg p-1">
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={handleZoomOut}
                disabled={zoomLevel <= 50}
                className="p-1 sm:p-2"
              >
                <ZoomOut className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
              <span className="text-xs sm:text-sm font-medium min-w-[40px] sm:min-w-[60px] text-center text-white">
                {zoomLevel}%
              </span>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={handleZoomIn}
                disabled={zoomLevel >= 500}
                className="p-1 sm:p-2"
              >
                <ZoomIn className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
            </div>
            
            {/* Download Button */}
            <Button className="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm px-2 sm:px-4">
              <Download className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Download PDF</span>
              <span className="sm:hidden">PDF</span>
            </Button>
          </div>
        </div>
      </div>

      {/* PDF Viewer Content */}
      <div className="max-w-7xl mx-auto p-3 sm:p-6">
        <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
          <CardHeader className="border-b border-white/20 p-3 sm:p-6">
            <CardTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
              <span className="text-white text-base sm:text-lg">Yearbook Viewer</span>
              <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 w-full sm:w-auto">
                <span className="text-xs sm:text-sm text-white/70">
                  Page {currentPage} of {totalPages}
                </span>
                <div className="flex space-x-1 w-full sm:w-auto">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage <= 1}
                    className="flex-1 sm:flex-none text-xs sm:text-sm"
                  >
                    Previous
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage >= totalPages}
                    className="flex-1 sm:flex-none text-xs sm:text-sm"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            {/* PDF Placeholder */}
            <div 
              className="bg-white/10 backdrop-blur-lg border-2 border-dashed border-white/30 rounded-lg mx-auto shadow-2xl"
              style={{ 
                width: `${Math.floor(8.5 * 96 * (zoomLevel / 100))}px`, 
                height: `${Math.floor(11 * 96 * (zoomLevel / 100))}px`,
                maxWidth: '100%'
              }}
            >
              <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                <div className="mb-6">
                  <RotateCw className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">
                    PDF Viewer Placeholder
                  </h3>
                  <p className="text-white/70 mb-4">
                    This is where the yearbook PDF for {year} would be displayed.
                  </p>
                </div>
                
                {/* Mock Content Preview */}
                <div className="w-full max-w-md space-y-4">
                  <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded p-4">
                    <h4 className="font-medium text-white mb-2">Page {currentPage} Content</h4>
                    <div className="space-y-2">
                      <div className="h-3 bg-white/20 rounded w-3/4"></div>
                      <div className="h-3 bg-white/20 rounded w-1/2"></div>
                      <div className="h-20 bg-white/10 backdrop-blur-lg border border-white/20 rounded w-full mb-2"></div>
                      <div className="h-3 bg-white/20 rounded w-2/3"></div>
                    </div>
                  </div>
                  
                  <div className="text-xs text-white/60">
                    In a real implementation, this would integrate with a PDF viewer library
                    like react-pdf or pdf.js to display the actual yearbook pages.
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}