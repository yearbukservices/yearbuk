import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ShoppingCart, CreditCard, CheckCircle, Loader2 } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";

interface CheckoutOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  year: string;
  price: number;
  isFree?: boolean;
  onConfirmPurchase: (year: string) => Promise<void>;
  userType?: "school" | "viewer";
}

export function CheckoutOverlay({ 
  isOpen, 
  onClose, 
  year, 
  price, 
  isFree = false,
  onConfirmPurchase,
  userType = "school"
}: CheckoutOverlayProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [purchaseComplete, setPurchaseComplete] = useState(false);
  const { convertPrice, formatPrice } = useCurrency();

  const handleConfirmPurchase = async () => {
    setIsProcessing(true);
    try {
      await onConfirmPurchase(year);
      setPurchaseComplete(true);
      
      // Auto-close after success and reload page to ensure everything updates
      setTimeout(() => {
        setPurchaseComplete(false);
        onClose();
        // Reload page to ensure all data refreshes properly
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error("Purchase failed:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (!isProcessing && !purchaseComplete) {
      setPurchaseComplete(false);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md" data-testid="checkout-overlay">
        {purchaseComplete ? (
          // Success State
          <div className="text-center space-y-4 py-4">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <DialogHeader>
              <DialogTitle className="text-green-800">Purchase Complete!</DialogTitle>
              <DialogDescription className="text-sm text-gray-600">
                You now have access to {year} yearbook content.
              </DialogDescription>
            </DialogHeader>
          </div>
        ) : (
          // Checkout Form
          <div className="space-y-6">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <ShoppingCart className="h-5 w-5" />
                <span>{isFree ? "Activate" : "Purchase"} Yearbook Access</span>
              </DialogTitle>
              <DialogDescription>
                {isFree 
                  ? `Activate your complimentary access to ${year} yearbook content.`
                  : `Purchase access to browse ${year} yearbook content and memories.`
                }
              </DialogDescription>
            </DialogHeader>

            {/* Year Summary Card */}
            <Card className="bg-gradient-to-br from-blue-50 to-indigo-50">
              <CardContent className="p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{year} Yearbook</h3>
                    <p className="text-sm text-gray-600">
                      {userType === "school" 
                        ? "School administrator access" 
                        : "Viewer access to memories and photos"
                      }
                    </p>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${isFree ? 'text-green-600' : 'text-blue-600'}`}>
                      {isFree ? "FREE" : formatPrice(convertPrice(price))}
                    </div>
                    {isFree && (
                      <p className="text-xs text-green-600 font-medium">First purchase</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Features */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-900">What's included:</h4>
              <ul className="text-sm text-gray-600 space-y-2">
                {userType === "school" ? (
                  <>
                    <li className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Full access to {year} yearbook content</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Upload and manage student memories</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Yearbook management tools</span>
                    </li>
                  </>
                ) : (
                  <>
                    <li className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Browse {year} yearbook memories</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>View student photos and events</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Access to class directories</span>
                    </li>
                  </>
                )}
              </ul>
            </div>

            <Separator />

            {/* Payment Summary */}
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span>{isFree ? "FREE" : formatPrice(convertPrice(price))}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Processing fee:</span>
                <span>{formatPrice(0)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-base font-semibold">
                <span>Total:</span>
                <span className={isFree ? 'text-green-600' : 'text-gray-900'}>
                  {isFree ? "FREE" : formatPrice(convertPrice(price))}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3 pt-4">
              <Button 
                variant="outline" 
                onClick={handleClose} 
                disabled={isProcessing}
                className="flex-1"
                data-testid="button-cancel-purchase"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleConfirmPurchase}
                disabled={isProcessing}
                className={`flex-1 ${isFree ? 'bg-green-600 hover:bg-green-700' : ''}`}
                data-testid="button-confirm-purchase"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4 mr-2" />
                    {isFree ? "Activate Free Access" : `Pay ${formatPrice(convertPrice(price))}`}
                  </>
                )}
              </Button>
            </div>

            {!isFree && (
              <p className="text-xs text-gray-500 text-center">
                * This is a demo. No actual payment will be processed.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}