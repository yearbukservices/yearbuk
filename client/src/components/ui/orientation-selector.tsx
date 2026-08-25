import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Tablet, Image, FileText } from "lucide-react";

interface OrientationSelectorProps {
  onSetupComplete: (orientation: "portrait" | "landscape", uploadType: "image" | "pdf") => void;
  loading?: boolean;
}

export default function OrientationSelector({ onSetupComplete, loading = false }: OrientationSelectorProps) {
  const [selectedOrientation, setSelectedOrientation] = useState<"portrait" | "landscape" | null>(null);
  const [selectedUploadType, setSelectedUploadType] = useState<"image" | "pdf" | null>(null);

  const handleOrientationSelect = (orientation: "portrait" | "landscape") => {
    setSelectedOrientation(orientation);
  };

  const handleUploadTypeSelect = (uploadType: "image" | "pdf") => {
    setSelectedUploadType(uploadType);
  };

  const handleConfirm = () => {
    if (selectedOrientation && selectedUploadType) {
      onSetupComplete(selectedOrientation, selectedUploadType);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 relative overflow-hidden">
      {/* Main Animated Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-20 left-20 w-32 h-32 bg-white rounded-full opacity-20 animate-float"></div>
          <div className="absolute top-60 right-40 w-24 h-24 bg-white rounded-full opacity-20 animate-float-delayed"></div>
          <div className="absolute bottom-40 left-40 w-20 h-20 bg-white rounded-full opacity-20 animate-float"></div>
          <div className="absolute bottom-20 right-20 w-16 h-16 bg-white rounded-full opacity-20 animate-float-delayed"></div>
        </div>
      </div>
      
      {/* Main Content Container */}
      <div className="relative z-10 min-h-screen bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-6xl bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl" data-testid="card-orientation-selector">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold text-foreground mb-4 text-blue-50" data-testid="title-orientation-selector">
              Set Up Your Yearbook
            </CardTitle>
            <p className="text-muted-foreground text-lg text-white" data-testid="text-orientation-description">
              Choose how you want to upload and display your yearbook
            </p>
          </CardHeader>
          <CardContent className="space-y-8">
            
            {/* Upload Type Selection */}
            <div>
              <h3 className="text-xl font-semibold mb-4 text-center text-white">Step 1: Choose Upload Mode</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Image Upload Option */}
                <div 
                  className={`cursor-pointer transition-all duration-200 ${
                    selectedUploadType === "image" 
                      ? "ring-2 ring-primary ring-offset-2 ring-offset-background" 
                      : "hover:shadow-lg"
                  }`}
                  onClick={() => handleUploadTypeSelect("image")}
                  data-testid="option-upload-image"
                >
                  <Card className="h-full bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
                    <CardHeader className="text-center">
                      <div className="mx-auto mb-4 p-4 bg-muted rounded-lg w-fit">
                        <Image className="h-12 w-12 text-primary" />
                      </div>
                      <CardTitle className="text-xl text-white" data-testid="title-upload-image">Image Uploads</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center">
                      <p className="text-sm text-muted-foreground text-white" data-testid="text-upload-image-description">
                        Upload individual page images. Best for custom layouts and flexibility. You can upload multiple images at once and reorder pages.
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* PDF Upload Option */}
                <div 
                  className={`cursor-pointer transition-all duration-200 ${
                    selectedUploadType === "pdf" 
                      ? "ring-2 ring-primary ring-offset-2 ring-offset-background" 
                      : "hover:shadow-lg"
                  }`}
                  onClick={() => handleUploadTypeSelect("pdf")}
                  data-testid="option-upload-pdf"
                >
                  <Card className="h-full bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
                    <CardHeader className="text-center">
                      <div className="mx-auto mb-4 p-4 bg-muted rounded-lg w-fit">
                        <FileText className="h-12 w-12 text-primary" />
                      </div>
                      <CardTitle className="text-xl text-white" data-testid="title-upload-pdf">PDF Upload</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center">
                      <p className="text-sm text-muted-foreground text-white" data-testid="text-upload-pdf-description">
                        Upload your yearbook as a single PDF file. Quick and easy - the PDF will be automatically split into pages. Pages cannot be reordered.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>

            {/* Orientation Selection */}
            <div>
              <h3 className="text-xl font-semibold mb-4 text-center text-white">Step 2: Choose Orientation</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Portrait Option */}
                <div 
                  className={`cursor-pointer transition-all duration-200 ${
                    selectedOrientation === "portrait" 
                      ? "ring-2 ring-primary ring-offset-2 ring-offset-background" 
                      : "hover:shadow-lg"
                  }`}
                  onClick={() => handleOrientationSelect("portrait")}
                  data-testid="option-portrait"
                >
                  <Card className="h-full bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
                    <CardHeader className="text-center">
                      <div className="mx-auto mb-4 p-4 bg-muted rounded-lg w-fit">
                        <BookOpen className="h-12 w-12 text-primary" />
                      </div>
                      <CardTitle className="text-xl text-white" data-testid="title-portrait">3:4 (Portrait)</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center">
                      <div className="mx-auto mb-4 bg-muted border-2 border-border rounded-lg" style={{ width: "90px", height: "120px" }}>
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs text-black">
                          3:4 Ratio
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground text-white" data-testid="text-portrait-description">
                        Optimized for traditional yearbook layouts with taller pages. Best for portrait photos and vertical content.
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Landscape Option */}
                <div 
                  className={`cursor-pointer transition-all duration-200 ${
                    selectedOrientation === "landscape" 
                      ? "ring-2 ring-primary ring-offset-2 ring-offset-background" 
                      : "hover:shadow-lg"
                  }`}
                  onClick={() => handleOrientationSelect("landscape")}
                  data-testid="option-landscape"
                >
                  <Card className="h-full bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
                    <CardHeader className="text-center">
                      <div className="mx-auto mb-4 p-4 bg-muted rounded-lg w-fit">
                        <Tablet className="h-12 w-12 text-primary rotate-90" />
                      </div>
                      <CardTitle className="text-xl text-white" data-testid="title-landscape">4:3 (Landscape)</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center">
                      <div className="mx-auto mb-4 bg-muted border-2 border-border rounded-lg" style={{ width: "120px", height: "90px" }}>
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs text-black">
                          4:3 Ratio
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground text-white" data-testid="text-landscape-description">
                        Perfect for panoramic layouts and wide content. Ideal for group photos and horizontal spreads.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>

            {/* Confirm Button */}
            <div className="text-center">
              <Button 
                onClick={handleConfirm}
                disabled={!selectedOrientation || !selectedUploadType || loading}
                size="lg"
                className="px-8"
                data-testid="button-confirm-orientation"
              >
                {loading ? "Setting Up..." : "Complete Setup"}
              </Button>
            </div>

            {(selectedOrientation || selectedUploadType) && (
              <div className="mt-4 text-center space-y-2">
                {selectedUploadType && (
                  <p className="text-sm text-muted-foreground text-white" data-testid="text-selected-upload-type">
                    Upload Mode: <span className="font-medium text-foreground text-white">
                      {selectedUploadType === "image" ? "Image Uploads" : "PDF Upload"}
                    </span>
                  </p>
                )}
                {selectedOrientation && (
                  <p className="text-sm text-muted-foreground text-white" data-testid="text-selected-orientation">
                    Orientation: <span className="font-medium text-foreground text-white">
                      {selectedOrientation === "portrait" ? "3:4 (Portrait)" : "4:3 (Landscape)"}
                    </span>
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
