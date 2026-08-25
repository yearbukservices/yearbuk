import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ShoppingCart, Eye, AlertTriangle, Settings, FileImage, FileText, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useCurrency } from "@/contexts/CurrencyContext";
import type { CartItem } from "@shared/schema";
import { BETA_VERSION } from "@shared/constants";

interface YearbookConfigDialogProps {
  isOpen: boolean;
  onClose: () => void;
  year: string;
  price: number;
  schoolId: string;
  userId: string;
  isFree?: boolean;
}

export function YearbookConfigDialog({ 
  isOpen, 
  onClose, 
  year, 
  price, 
  schoolId,
  userId,
  isFree = false
}: YearbookConfigDialogProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { convertPrice, formatPrice } = useCurrency();
  
  const [uploadType, setUploadType] = useState<'image' | 'pdf' | null>(null);

  const { data: school, isLoading: isLoadingSchool } = useQuery({
    queryKey: ["/api/schools", schoolId],
    queryFn: async () => {
      const res = await fetch(`/api/schools/${schoolId}`);
      if (!res.ok) throw new Error("Failed to fetch school data");
      return res.json();
    },
    enabled: isOpen && !!schoolId && !BETA_VERSION
  });

  const hasRevenueSharing = BETA_VERSION ? true : (school?.paystackSubaccountCode || school?.bankAccountNumber);

  const addToCartMutation = useMutation({
    mutationFn: async (cartData: { 
      userId: string; 
      schoolId: string; 
      year: number; 
      price: string;
      uploadType: string;
    }) => {
      await apiRequest("POST", "/api/cart", cartData);
    },
    onMutate: async (newCartItem) => {
      await queryClient.cancelQueries({ queryKey: ["/api/cart", userId] });
      const previousCartItems = queryClient.getQueryData<CartItem[]>(["/api/cart", userId]);

      const optimisticCartItem: CartItem = {
        id: `temp-${Date.now()}`,
        userId: newCartItem.userId,
        schoolId: newCartItem.schoolId,
        year: newCartItem.year,
        price: newCartItem.price,
        orientation: '',
        uploadType: newCartItem.uploadType,
        addedAt: new Date()
      };

      queryClient.setQueryData<CartItem[]>(["/api/cart", userId], (old = []) => [
        ...old,
        optimisticCartItem
      ]);

      toast({
        className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Added to cart!",
        description: `${year} yearbook has been configured and added to your cart.`,
        action: (
          <Button 
            size="sm" 
            onClick={() => setLocation("/cart")}
            className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl text-white"
            data-testid="toast-view-cart"
          >
            View Cart
          </Button>
        )
      });

      return { previousCartItems, optimisticCartItem };
    },
    onError: (error: any, newCartItem, context) => {
      queryClient.setQueryData(["/api/cart", userId], context?.previousCartItems || []);
      
      if (error.message?.includes("already in cart")) {
        toast({
          className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
          title: "Already in cart",
          description: "This yearbook is already in your cart.",
          variant: "destructive"
        });
      } else {
        toast({
          className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
          title: "Failed to add to cart",
          description: "Something went wrong. Please try again.",
          variant: "destructive"
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cart", userId] });
      setUploadType(null);
      onClose();
    }
  });

  const unlockMutation = useMutation({
    mutationFn: async (data: { schoolId: string; year: number; uploadType: string }) => {
      const purchaseRes = await fetch("/api/year-purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId: data.schoolId,
          year: data.year,
          purchased: true,
          price: "0.00",
          purchaseDate: new Date().toISOString()
        })
      });
      if (!purchaseRes.ok) throw new Error("Failed to create purchase record");

      const yearbookRes = await fetch("/api/yearbooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId: data.schoolId,
          year: data.year,
          title: `${data.year} Yearbook`,
          uploadType: data.uploadType,
          isInitialized: true
        })
      });
      if (!yearbookRes.ok) throw new Error("Failed to create yearbook record");

      return yearbookRes.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/year-purchases", schoolId] });
      queryClient.invalidateQueries({ queryKey: ["/api/yearbooks", schoolId] });
      toast({
        className: "bg-purple-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Yearbook unlocked!",
        description: `The ${year} yearbook is now unlocked and ready to manage.`,
      });
      setUploadType(null);
      onClose();
    },
    onError: () => {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Failed to unlock",
        description: "Something went wrong. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleConfirmAndAddToCart = async () => {
    if (!hasRevenueSharing) {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Revenue sharing required",
        description: "You must set up revenue sharing before purchasing school years.",
        variant: "destructive"
      });
      return;
    }

    if (!uploadType) {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Configuration incomplete",
        description: "Please select a yearbook type.",
        variant: "destructive"
      });
      return;
    }

    const cartData = {
      userId,
      schoolId,
      year: parseInt(year),
      price: isFree ? "0.00" : price.toString(),
      uploadType
    };

    addToCartMutation.mutate(cartData);
  };

  const handleUnlock = () => {
    if (!uploadType) {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Configuration incomplete",
        description: "Please select a yearbook type.",
        variant: "destructive"
      });
      return;
    }

    unlockMutation.mutate({
      schoolId,
      year: parseInt(year),
      uploadType
    });
  };

  const handleViewCart = () => {
    onClose();
    setLocation("/cart");
  };

  const handleGoToSettings = () => {
    onClose();
    setLocation("/school-settings?tab=revenue");
  };

  const handleClose = () => {
    setUploadType(null);
    onClose();
  };

  const isConfigurationComplete = uploadType !== null;
  const isLoadingData = !BETA_VERSION && isLoadingSchool;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] sm:w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl" data-testid="yearbook-config-dialog">
        <div className="space-y-3 sm:space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2 text-white text-base sm:text-lg">
              {BETA_VERSION ? <Lock className="h-4 w-4 sm:h-5 sm:w-5" /> : <Settings className="h-4 w-4 sm:h-5 sm:w-5" />}
              <span>{BETA_VERSION ? "Unlock" : "Configure"} {year} Yearbook</span>
            </DialogTitle>
            <DialogDescription className="text-blue-50 text-xs sm:text-sm">
              {BETA_VERSION
                ? "Select your yearbook type to unlock access."
                : "Select your yearbook type."}
            </DialogDescription>
          </DialogHeader>

          {isLoadingData ? (
            <Card className="bg-gradient-to-br from-gray-50 to-gray-100">
              <CardContent className="p-4 text-center">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-300 rounded mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded"></div>
                </div>
              </CardContent>
            </Card>
          ) : !hasRevenueSharing ? (
            <Card className="bg-gradient-to-br from-red-600/30 to-red-600/20 backdrop-blur-lg border border-white/20 shadow-2xl">
              <CardContent className="p-4">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="h-6 w-6 text-red-600 mt-1" />
                  <div>
                    <h3 className="text-lg font-semibold text-red-900">Revenue Sharing Required</h3>
                    <p className="text-sm text-red-700 mt-1">
                      You must set up revenue sharing before purchasing school years.
                    </p>
                    <p className="text-xs text-red-600 mt-2">
                      Configure your bank account to receive 80% of yearbook sales.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="space-y-3">
                <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
                  <CardContent className="p-3">
                    <Label className="text-sm font-semibold text-white mb-2 block">
                      Select Yearbook Type
                    </Label>
                    <RadioGroup value={uploadType || ""} onValueChange={(value) => setUploadType(value as 'image' | 'pdf')} className="space-y-2">
                      <div className="flex items-start space-x-2 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer border border-white/10" data-testid="option-image-upload">
                        <RadioGroupItem value="image" id="image" className="mt-0.5" />
                        <div className="flex-1">
                          <Label htmlFor="image" className="flex items-center gap-1.5 text-white text-sm font-medium cursor-pointer">
                            <FileImage className="h-4 w-4" />
                            Image Upload (JPG/PNG)
                          </Label>
                          <p className="text-xs text-blue-100 mt-0.5">
                            Upload individual page images.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-2 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer border border-white/10" data-testid="option-pdf-upload">
                        <RadioGroupItem value="pdf" id="pdf" className="mt-0.5" />
                        <div className="flex-1">
                          <Label htmlFor="pdf" className="flex items-center gap-1.5 text-white text-sm font-medium cursor-pointer">
                            <FileText className="h-4 w-4" />
                            PDF Upload
                          </Label>
                          <p className="text-xs text-blue-100 mt-0.5">
                            Upload a complete PDF file.
                          </p>
                        </div>
                      </div>
                    </RadioGroup>
                  </CardContent>
                </Card>

                <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
                  <CardContent className="p-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-base font-semibold text-white">{year} Yearbook</h3>
                        <p className="text-xs text-blue-50">
                          {uploadType === 'pdf' ? 'PDF Upload' : uploadType === 'image' ? 'Image Upload' : 'Type not selected'}
                        </p>
                      </div>
                      <div className="text-right">
                        {BETA_VERSION ? (
                          <div className="flex items-center gap-1.5 text-purple-300 font-bold text-xl">
                            <Lock className="h-4 w-4" />
                            
                          </div>
                        ) : (
                          <div className={`text-xl font-bold ${isFree ? 'text-green-400' : 'text-blue-50'}`}>
                            {isFree ? "FREE" : formatPrice(convertPrice(price))}
                          </div>
                        )}
                        {(isFree || BETA_VERSION) && (
                          <p className="text-xs text-green-400 font-medium">{BETA_VERSION ? "" : ""}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            {!isLoadingData && !hasRevenueSharing ? (
              <Button 
                onClick={handleGoToSettings}
                className="w-full bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl"
                data-testid="button-setup-revenue"
              >
                <Settings className="h-4 w-4 mr-2" />
                Set Up Revenue Sharing
              </Button>
            ) : BETA_VERSION ? (
              <Button 
                onClick={handleUnlock}
                disabled={!isConfigurationComplete || unlockMutation.isPending}
                className="flex-1 bg-purple-600/40 border border-purple-400/50 text-white hover:bg-purple-600/60 transition-colors duration-200 ease-in-out disabled:opacity-50"
                data-testid="button-unlock-yearbook"
              >
                {unlockMutation.isPending ? (
                  <>
                    <Lock className="h-4 w-4 mr-2 animate-pulse" />
                    Unlocking...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    Unlock Yearbook
                  </>
                )}
              </Button>
            ) : (
              <>
                <Button 
                  onClick={handleConfirmAndAddToCart}
                  disabled={!isConfigurationComplete || addToCartMutation.isPending || isLoadingSchool || !hasRevenueSharing}
                  className="flex-1 bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl hover:bg-yellow-100 hover:text-black transition-colors duration-200 ease-in-out disabled:opacity-50"
                  data-testid="button-confirm-add-to-cart"
                >
                  {addToCartMutation.isPending ? (
                    <>
                      <ShoppingCart className="h-4 w-4 mr-2 animate-pulse" />
                      <span className="hidden sm:inline">Adding...</span>
                      <span className="sm:hidden">Adding...</span>
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">Confirm and Add to Cart</span>
                      <span className="sm:hidden">Add to Cart</span>
                    </>
                  )}
                </Button>
                
                <Button 
                  onClick={handleViewCart}
                  variant="outline"
                  className="flex-1 bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl text-white hover:bg-white hover:text-black transition-colors duration-200 ease-in-out"
                  data-testid="button-view-cart"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Cart
                </Button>
              </>
            )}
          </div>

          {!BETA_VERSION && !isFree && (
            <p className="text-xs text-gray-400 text-center">
              * This is a demo. No actual payment will be processed.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
