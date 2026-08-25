import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, Loader2, ShoppingCart, AlertCircle } from 'lucide-react';
import type { AlumniBadge } from '@shared/schema';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { BETA_VERSION } from '@shared/constants';

interface YearbookPhotoSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  alumniBadges: AlumniBadge[];
  onPhotoSelected: (croppedImageBlob: Blob) => Promise<void>;
  userId: string;
}

type SelectionStep = 'school' | 'yearbook' | 'page' | 'crop' | 'purchase_prompt';

export default function YearbookPhotoSelectionDialog({
  isOpen,
  onClose,
  alumniBadges,
  onPhotoSelected,
  userId
}: YearbookPhotoSelectionDialogProps) {
  const [step, setStep] = useState<SelectionStep>('school');
  const [selectedSchool, setSelectedSchool] = useState<{ id: string; name: string } | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedYearbook, setSelectedYearbook] = useState<any>(null);
  const [selectedPage, setSelectedPage] = useState<any>(null);
  const [hasOwnership, setHasOwnership] = useState<boolean>(false);
  const { toast } = useToast();
  
  // Crop state
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isCropping, setIsCropping] = useState(false);

  // Get verified alumni badges (schools they're verified for)
  const verifiedBadges = alumniBadges.filter(badge => badge.status === 'verified');

  // Fetch all schools to match badge school names to schoolIds
  const { data: schools = [] } = useQuery<any[]>({
    queryKey: ['/api/schools'],
    enabled: isOpen && verifiedBadges.length > 0
  });

  // Fetch yearbooks for selected school
  const { data: yearbooks = [], isLoading: loadingYearbooks } = useQuery<any[]>({
    queryKey: ['/api/published-yearbooks-list', selectedSchool?.id],
    enabled: !!selectedSchool && step === 'yearbook'
  });

  // Check ownership when yearbook is selected
  const { data: purchasesData, isLoading: checkingOwnership } = useQuery<any[]>({
    queryKey: ['/api/viewer-year-purchases', userId, selectedSchool?.id],
    enabled: !!userId && !!selectedSchool && !!selectedYear && step === 'purchase_prompt'
  });

  // Fetch pages for selected yearbook (only if owned)
  const { data: yearbookData, isLoading: loadingPages } = useQuery<any>({
    queryKey: ['/api/published-yearbooks', selectedSchool?.id, selectedYear],
    enabled: !!selectedSchool && !!selectedYear && step === 'page' && hasOwnership
  });

  // Filter out covers - only show content pages for photo selection
  const pages = yearbookData?.pages?.filter((page: any) => 
    page.pageType === 'content'
  ) || [];

  const handleSchoolSelect = (badgeId: string) => {
    const badge = verifiedBadges.find(b => b.id === badgeId);
    if (badge) {
      // Find the actual school by matching the school name
      const school = schools.find(s => s.name === badge.school);
      if (school) {
        setSelectedSchool({ id: school.id, name: badge.school });
        setStep('yearbook');
      }
    }
  };

  const handleYearbookSelect = async (year: string) => {
    const yearNumber = parseInt(year);
    const yearbook = yearbooks.find((yb: any) => yb.year === yearNumber);
    
    setSelectedYear(yearNumber);
    setSelectedYearbook(yearbook);

    // Skip purchase check if beta (all free) or yearbook has no price
    const isFree = BETA_VERSION || !yearbook?.price || yearbook.price === 0;
    if (isFree) {
      setHasOwnership(true);
      setStep('page');
      return;
    }
    
    // Check ownership
    try {
      const res = await fetch(`/api/viewer-year-purchases/${userId}/${selectedSchool?.id}`);
      if (res.ok) {
        const purchases = await res.json();
        const hasPurchased = purchases.some((p: any) => p.year === yearNumber && p.purchased);
        
        if (hasPurchased) {
          setHasOwnership(true);
          setStep('page');
        } else {
          setHasOwnership(false);
          setStep('purchase_prompt');
        }
      } else {
        setHasOwnership(false);
        setStep('purchase_prompt');
      }
    } catch (error) {
      console.error('Error checking ownership:', error);
      setHasOwnership(false);
      setStep('purchase_prompt');
    }
  };

  // Add to cart mutation
  const addToCartMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSchool || !selectedYear || !selectedYearbook) return;
      
      await apiRequest('POST', '/api/cart', {
        userId,
        itemType: 'yearbook',
        schoolId: selectedSchool.id,
        year: selectedYear,
        quantity: 1,
        price: selectedYearbook.price
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cart', userId] });
      toast({
        className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Added to cart",
        description: "This yearbook has been added to your cart. You can complete the purchase from your cart.",
      });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        variant: "destructive",
        title: "Failed to add to cart",
        description: error.message || "Please try again",
      });
    }
  });

  const handlePageSelect = (page: any) => {
    setSelectedPage(page);
    setStep('crop');
    // Reset crop state
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  const handleBack = () => {
    if (step === 'yearbook') {
      setSelectedSchool(null);
      setStep('school');
    } else if (step === 'purchase_prompt') {
      setSelectedYear(null);
      setSelectedYearbook(null);
      setHasOwnership(false);
      setStep('yearbook');
    } else if (step === 'page') {
      setSelectedYear(null);
      setSelectedYearbook(null);
      setHasOwnership(false);
      setStep('yearbook');
    } else if (step === 'crop') {
      setSelectedPage(null);
      setStep('page');
    }
  };

  const onCropComplete = (croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const createCroppedImage = async (): Promise<Blob | null> => {
    if (!selectedPage || !croppedAreaPixels) return null;

    try {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.src = selectedPage.imageUrl;
      
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
      });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      // Set canvas size to desired output size (circular profile photo)
      const size = 1200;
      canvas.width = size;
      canvas.height = size;

      // Calculate scale factor
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;

      // Create circular mask
      ctx.save();
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, 2 * Math.PI);
      ctx.clip();

      // Draw cropped area
      ctx.drawImage(
        image,
        croppedAreaPixels.x * scaleX,
        croppedAreaPixels.y * scaleY,
        croppedAreaPixels.width * scaleX,
        croppedAreaPixels.height * scaleY,
        0,
        0,
        size,
        size
      );

      ctx.restore();

      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          resolve(blob);
        }, 'image/png');
      });
    } catch (error) {
      console.error('Error creating cropped image:', error);
      return null;
    }
  };

  const handleSaveCrop = async () => {
    setIsCropping(true);
    try {
      const croppedBlob = await createCroppedImage();
      if (croppedBlob) {
        await onPhotoSelected(croppedBlob);
        // Only close on success (onPhotoSelected will throw on error)
        handleClose();
      }
    } catch (error) {
      console.error('Error saving crop:', error);
      // Don't close dialog on error, let user retry
    } finally {
      setIsCropping(false);
    }
  };

  const handleClose = () => {
    setStep('school');
    setSelectedSchool(null);
    setSelectedYear(null);
    setSelectedYearbook(null);
    setSelectedPage(null);
    setHasOwnership(false);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 border border-white/20 text-white overflow-y-auto" aria-describedby="yearbook-photo-dialog-description">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {step !== 'school' && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBack}
                className="text-white hover:bg-white/20"
                data-testid="button-back-step"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <DialogTitle className="text-white flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Select Yearbook Photo
            </DialogTitle>
          </div>
          <DialogDescription id="yearbook-photo-dialog-description" className="text-white/70">
            {step === 'school' && 'Select the school you are alumni of'}
            {step === 'yearbook' && 'Select the yearbook year'}
            {step === 'purchase_prompt' && 'This yearbook is not in your library'}
            {step === 'page' && 'Select the page with your photo'}
            {step === 'crop' && 'Crop your profile photo from the yearbook page'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Step 1: School Selection */}
          {step === 'school' && (
            <div className="space-y-4">
              {verifiedBadges.length === 0 ? (
                <div className="text-center py-8 text-white/60">
                  <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No verified alumni schools found.</p>
                  <p className="text-sm mt-1">You need to be verified as alumni to use yearbook photos.</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {verifiedBadges.map((badge) => (
                    <Button
                      key={badge.id}
                      onClick={() => handleSchoolSelect(badge.id)}
                      variant="outline"
                      className="w-full h-auto py-4 px-6 bg-white/10 border-white/20 hover:bg-white/20 text-white justify-start"
                      data-testid={`button-select-school-${badge.id}`}
                    >
                      <div className="text-left">
                        <div className="font-semibold">{badge.school}</div>
                        <div className="text-sm text-white/60">
                          {badge.admissionYear} - {badge.graduationYear}
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Yearbook Year Selection */}
          {step === 'yearbook' && (
            <div className="space-y-4">
              <div className="text-sm text-white/80">
                School: <span className="font-semibold">{selectedSchool?.name}</span>
              </div>
              {loadingYearbooks ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                </div>
              ) : yearbooks.length === 0 ? (
                <div className="text-center py-8 text-white/60">
                  <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No published yearbooks found for this school.</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {yearbooks.map((yearbook: any) => (
                    <Button
                      key={yearbook.id}
                      onClick={() => handleYearbookSelect(yearbook.year.toString())}
                      variant="outline"
                      className="w-full h-auto py-4 px-6 bg-white/10 border-white/20 hover:bg-white/20 text-white justify-start"
                      data-testid={`button-select-year-${yearbook.year}`}
                    >
                      <div className="text-left">
                        <div className="font-semibold">{yearbook.title}</div>
                        <div className="text-sm text-white/60">Year: {yearbook.year}</div>
                      </div>
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Purchase Prompt */}
          {step === 'purchase_prompt' && (
            <div className="space-y-6 py-8">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="rounded-full bg-yellow-500/20 p-4">
                    <AlertCircle className="h-12 w-12 text-yellow-400" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-white">
                    Oops! It seems you do not have this yearbook in your library.
                  </h3>
                  <p className="text-white/70">
                    <span className="font-semibold">{selectedSchool?.name}</span> - Year {selectedYear}
                  </p>
                  <p className="text-white/80 mt-4">
                    Do you want to purchase it?
                  </p>
                </div>
              </div>

              <div className="flex gap-3 justify-center">
                <Button
                  onClick={handleBack}
                  variant="outline"
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                  data-testid="button-purchase-no"
                >
                  No, Go Back
                </Button>
                <Button
                  onClick={() => addToCartMutation.mutate()}
                  disabled={addToCartMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  data-testid="button-purchase-yes"
                >
                  {addToCartMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Adding to Cart...
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Yes, Add to Cart
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Page Selection */}
          {step === 'page' && (
            <div className="space-y-4">
              <div className="text-sm text-white/80">
                <div>School: <span className="font-semibold">{selectedSchool?.name}</span></div>
                <div>Year: <span className="font-semibold">{selectedYear}</span></div>
              </div>
              {loadingPages ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                </div>
              ) : pages.length === 0 ? (
                <div className="text-center py-8 text-white/60">
                  <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No pages found in this yearbook.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-[500px] overflow-y-auto pr-2">
                  {pages.map((page: any) => (
                    <button
                      key={page.id}
                      onClick={() => handlePageSelect(page)}
                      className="group relative aspect-[3/4] rounded-lg overflow-hidden border-2 border-white/20 hover:border-white/60 transition-all"
                      data-testid={`button-select-page-${page.pageNumber}`}
                    >
                      <img
                        src={page.imageUrl}
                        alt={`Page ${page.pageNumber}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-2">
                        <span className="text-white text-sm font-medium">
                          Page {page.pageNumber}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 5: Crop */}
          {step === 'crop' && selectedPage && (
            <div className="space-y-4">
              <div className="text-sm text-white/80 mb-4">
                <div>Page {selectedPage.pageNumber}: {selectedPage.title}</div>
              </div>
              
              <div className="relative w-full h-[400px] bg-black/50 rounded-lg overflow-hidden">
                <Cropper
                  image={selectedPage.imageUrl}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-white/80">Zoom</label>
                <Slider
                  value={[zoom]}
                  onValueChange={(value) => setZoom(value[0])}
                  min={1}
                  max={3}
                  step={0.1}
                  className="[&_[role=slider]]:bg-white [&_[role=slider]]:border-white"
                  data-testid="slider-crop-zoom"
                />
              </div>

              <div className="flex gap-2 justify-end mt-4">
                <Button
                  onClick={handleBack}
                  variant="outline"
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                  data-testid="button-cancel-crop"
                >
                  Back
                </Button>
                <Button
                  onClick={handleSaveCrop}
                  disabled={isCropping}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  data-testid="button-save-yearbook-photo"
                >
                  {isCropping ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Use This Photo'
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
