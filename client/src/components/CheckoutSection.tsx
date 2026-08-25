import { useState, useEffect } from "react";
import { usePaystackPayment } from "react-paystack";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { CreditCard, ShoppingCart, CheckCircle, Loader2, Package, Truck, RefreshCw } from "lucide-react";
import type { CartItem } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getUSDToNGNRate, convertUSDToNGN, formatNGN, formatUSD } from "@/lib/utils";
import { useCurrency } from "@/contexts/CurrencyContext";

interface CheckoutSectionProps {
  cartItems: CartItem[];
  total: number;
  userType: string;
  onContinueShopping: () => void;
  getCurrentPrice: (item: CartItem) => number;
}

export function CheckoutSection({ cartItems, total, userType, onContinueShopping, getCurrentPrice }: CheckoutSectionProps) {
  const [showCheckout, setShowCheckout] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [purchaseComplete, setPurchaseComplete] = useState(false);
  const [customerEmail, setCustomerEmail] = useState("");
  const [exchangeRate, setExchangeRate] = useState<number>(1650); // Default rate
  const [isLoadingRate, setIsLoadingRate] = useState(true);
  const [lastPaymentReference, setLastPaymentReference] = useState<string | null>(null);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const { toast } = useToast();
  const { convertPrice, formatPrice, userCurrency } = useCurrency();

  // Get user data first
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  // School data state for school users
  const [schoolData, setSchoolData] = useState<any>(null);

  // Fetch school data for school users
  useEffect(() => {
    const fetchSchoolData = async () => {
      if (user.userType === 'school' && user.schoolId) {
        try {
          const response = await apiRequest("GET", `/api/schools/${user.schoolId}`);
          if (response.ok) {
            const data = await response.json();
            setSchoolData(data);
          }
        } catch (error) {
          console.error("Failed to fetch school data:", error);
        }
      }
    };

    fetchSchoolData();
  }, [user.userType, user.schoolId]);

  // Helper function to get customer data based on user type
  const getCustomerData = () => {
    if (user.userType === 'school') {
      // For school accounts, check both user record and school record for phone number
      const phoneNumber = user.phoneNumber || schoolData?.phoneNumber || '';
      
      return {
        firstName: '', // No first name for school accounts
        lastName: '', // No last name for school accounts  
        customerName: schoolData?.name || 'Loading...', // Use actual school name
        phone: phoneNumber, // Use school admin's phone (from user or school record)
        email: user.email || ''
      };
    } else {
      // For viewer accounts, use their personal data
      return {
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        customerName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        phone: user.phoneNumber || '',
        email: user.email || ''
      };
    }
  };

  // Define calculation functions first
  const calculateSubtotal = () => total;
  const calculateFinalTotal = () => calculateSubtotal();

  // Fetch exchange rate on component mount and check for stored payment reference
  useEffect(() => {
    const fetchExchangeRate = async () => {
      setIsLoadingRate(true);
      try {
        const rate = await getUSDToNGNRate();
        setExchangeRate(rate);
      } catch (error) {
        console.error('Failed to fetch exchange rate:', error);
        toast({
          className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
          title: "Exchange rate error",
          description: "Using approximate exchange rate. Please refresh if needed.",
          variant: "destructive"
        });
      } finally {
        setIsLoadingRate(false);
      }
    };

    // Check for stored payment reference
    const storedReference = localStorage.getItem('lastPaymentReference');
    if (storedReference) {
      setLastPaymentReference(storedReference);
    }

    fetchExchangeRate();
  }, [toast]);

  // Calculate the total amount (already in correct format)
  const finalTotalUSD = calculateFinalTotal();
  const finalTotalNGN = convertUSDToNGN(finalTotalUSD, exchangeRate);

  // Helper function to format phone number for Paystack (Nigerian format)
  const formatPhoneNumber = (phone: string) => {
    if (!phone) return "";
    
    // Remove any spaces, dashes, brackets, or other non-numeric characters except +
    const cleaned = phone.replace(/[\s\-\(\)\.]/g, "");
    
    // Handle different phone number formats and convert to Paystack-compatible format
    
    // Remove leading + if present
    let numberWithoutPlus = cleaned.startsWith("+") ? cleaned.substring(1) : cleaned;
    
    // Case 1: Full international format (234xxxxxxxxxx)
    if (numberWithoutPlus.startsWith("234") && numberWithoutPlus.length >= 13) {
      // Keep as international format without + (Paystack accepts this)
      return numberWithoutPlus;
    }
    
    // Case 2: International format with + (+234xxxxxxxxxx) 
    if (cleaned.startsWith("+234") && cleaned.length >= 14) {
      // Return international format with + (Paystack prefers this)
      return cleaned;
    }
    
    // Case 3: Nigerian local format (0xxxxxxxxx or 08xxxxxxxx)
    if (numberWithoutPlus.startsWith("0") && numberWithoutPlus.length >= 10) {
      // Convert to international format for better compatibility
      return "+234" + numberWithoutPlus.substring(1);
    }
    
    // Case 4: Local number without leading 0 (8xxxxxxxx or 9xxxxxxxx)
    if (/^[789]/.test(numberWithoutPlus) && numberWithoutPlus.length >= 9) {
      // Add Nigeria code and format as international
      return "+234" + numberWithoutPlus;
    }
    
    // Case 5: Fallback - if it looks like a Nigerian number, format it
    if (numberWithoutPlus.length >= 10) {
      // Try to extract the last 10 digits and format as Nigerian
      const lastTenDigits = numberWithoutPlus.slice(-10);
      if (/^[789]/.test(lastTenDigits)) {
        return "+234" + lastTenDigits;
      }
    }
    
    // If none of the above work, return the cleaned number as-is
    console.warn("Phone number format not recognized:", phone, "-> cleaned:", cleaned);
    return cleaned;
  };

  // Paystack configuration
  const customerData = getCustomerData();
  const config = {
    reference: new Date().getTime().toString(),
    email: customerData.email,
    amount: Math.round(finalTotalNGN * 100), // Convert to kobo (Paystack's smallest unit)
    publicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || "",
    currency: "NGN",
    first_name: customerData.firstName,
    last_name: customerData.lastName,
    phone: formatPhoneNumber(customerData.phone),
  };

  const initializePayment = usePaystackPayment(config);

  // Paystack payment success handler
  const onSuccess = (reference: any) => {
    console.log('Payment successful:', reference);
    setPurchaseComplete(true);
    
    toast({
      className: "bg-green-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
      title: "Payment successful!",
      description: `Your payment of ${formatNGN(finalTotalNGN)} (${formatUSD(finalTotalUSD)}) has been processed successfully.`
    });

    // Auto-close and reload after success
    setTimeout(() => {
      setShowCheckout(false);
      setPurchaseComplete(false);
      window.location.reload();
    }, 3000);
  };

  // Paystack payment close handler
  const onClose = () => {
    console.log('Payment closed');
    toast({
      className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
      title: "Payment cancelled",
      description: "You cancelled the payment process.",
      variant: "destructive"
    });
  };

  const handleProcessPayment = async () => {
    // Get customer data based on user type
    const customerData = getCustomerData();

    if (!customerData.email) {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Email required",
        description: "Please enter your email address to proceed with payment.",
        variant: "destructive"
      });
      return;
    }

    if (!customerData.phone) {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Phone number required",
        description: "Phone number is required to proceed with payment.",
        variant: "destructive"
      });
      return;
    }

    // For individual accounts, validate names
    if (user.userType !== 'school' && (!customerData.firstName || !customerData.lastName)) {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Name required",
        description: "Your name information is required to proceed with payment.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Initialize payment with our backend
      const paymentData = {
        email: customerData.email,
        firstName: user.userType === 'school' ? customerData.customerName : customerData.firstName,
        lastName: user.userType === 'school' ? '' : customerData.lastName,
        phone: formatPhoneNumber(customerData.phone),
        amount: finalTotalNGN, // Send NGN amount to backend (already converted)
        cartItems: cartItems,
        userId: user.id
      };

      const response = await apiRequest("POST", "/api/payments/initialize", paymentData);
      const result = await response.json();
      
      if (result.status) {
        // Store payment reference for manual verification
        setLastPaymentReference(result.data.reference);
        localStorage.setItem('lastPaymentReference', result.data.reference);
        
        // Open Paystack payment page in same window (ensures redirect back works)
        window.location.href = result.data.authorization_url;
      } else {
        throw new Error(result.message || 'Payment initialization failed');
      }
    } catch (error: any) {
      console.error('Payment initialization error:', error);
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Payment failed",
        description: error.message || "Failed to initialize payment. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Optimistic payment verification function
  const handleCheckPaymentStatus = async () => {
    const reference = lastPaymentReference || localStorage.getItem('lastPaymentReference');
    
    if (!reference) {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "No payment reference found",
        description: "Please make a payment first.",
        variant: "destructive"
      });
      return;
    }

    setIsCheckingPayment(true);

    // Show optimistic success message immediately
    toast({
      className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
      title: "Checking payment... ⏳",
      description: "Verifying your payment with Paystack...",
    });

    try {
      const response = await apiRequest("GET", `/api/payments/verify/${reference}`);
      const result = await response.json();
      
      if (response.ok && result.status !== false) {
        // Payment verification successful - show enhanced success
        toast({
          className: "bg-green-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
          title: "Payment verified",
          description: "Your purchase is complete! Updating your library...",
        });
        
        // Clear stored reference
        localStorage.removeItem('lastPaymentReference');
        setLastPaymentReference(null);
        
        // Show completion animation
        setPurchaseComplete(true);
        
        // Force refresh cart and purchase data  
        queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
        queryClient.invalidateQueries({ queryKey: ["/api/year-purchases"] });
        queryClient.invalidateQueries({ queryKey: ["/api/viewer-purchases"] });
        
        // Auto-reload with success indication
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        // Check for specific error messages
        const errorMsg = result?.message || response.statusText || "Payment verification failed";
        
        toast({
          className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
          title: "Verification failed ❌",
          description: errorMsg.includes('not found') 
            ? "Payment may still be processing. Please wait a moment and try again."
            : errorMsg,
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error('Payment verification error:', error);
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Network error ⚠️",
        description: `Failed to connect to payment service: ${error.message}. Please check your internet connection and try again.`,
        variant: "destructive"
      });
    } finally {
      setTimeout(() => setIsCheckingPayment(false), 500); // Small delay to show success state
    }
  };


  // Function to manually refresh exchange rate
  const refreshExchangeRate = async () => {
    setIsLoadingRate(true);
    try {
      const rate = await getUSDToNGNRate();
      setExchangeRate(rate);
      toast({
        title: "Exchange rate updated",
        description: `Current rate: 1 USD = ${formatNGN(rate)}`
      });
    } catch (error) {
      toast({
        title: "Failed to update exchange rate",
        description: "Please try again later.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingRate(false);
    }
  };


  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3">
        <Button 
          onClick={() => setShowCheckout(true)}
          className="flex-1 bg-green-500/20 backdrop-blur-lg border border-green-200 shadow-2xl cursor-pointer transition-all hover:bg-green-310 hover:scale-105 hover:border-green-400 hover:shadow-green-500/50 hover:shadow-lg hover:scale-105 transition-all duration-200 hover:text-green-600"
          size="lg"
          data-testid="button-checkout"
        >
          <ShoppingCart className="h-4 w-4 mr-2" />
          Proceed to Checkout
        </Button>
        
       
      </div>

      {/* Checkout Dialog */}
      <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl
" data-testid="checkout-dialog">
          {purchaseComplete ? (
            // Success State
            <div className="text-center space-y-4 py-8">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <DialogHeader>
                <DialogTitle className="text-green-800 text-xl">Order Complete!</DialogTitle>
                <DialogDescription className="text-gray-600">
                  Thank you for your purchase. You now have access to all yearbook content.
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center justify-center space-x-4 text-sm text-gray-600">
                <div className="flex items-center space-x-1">
                  <Package className="h-4 w-4" />
                  <span>Order confirmed</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Truck className="h-4 w-4" />
                  <span>Digital delivery</span>
                </div>
              </div>
            </div>
          ) : (
            // Checkout Form
            <div className="space-y-6">
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2 text-white">
                  <CreditCard className="h-5 w-5" />
                  <span>Checkout</span>
                </DialogTitle>
                <DialogDescription className="text-blue-50" >
                  Complete your purchase for {cartItems.length} yearbook{cartItems.length > 1 ? 's' : ''}
                </DialogDescription>
              </DialogHeader>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Order Summary */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white">Order Summary</h3>
                  
                  <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl
">
                    <CardContent className="p-4 space-y-3">
                      {cartItems.map((item, index) => (
                        <div key={item.id} className="flex justify-between items-center">
                          <div>
                            <p className="font-medium text-white">{item.year} Yearbook</p>
                            <p className="text-sm text-blue-50">Digital Access</p>
                          </div>
                          <span className="font-semibold text-white">{formatPrice(convertPrice(getCurrentPrice(item)))}</span>
                        </div>
                      ))}
                      
                      <Separator />
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-lg font-semibold text-white">
                          <span>Total:</span>
                          <span>{formatPrice(convertPrice(finalTotalUSD))}</span>
                        </div>
                        {userCurrency === 'NGN' && (
                          <div className="flex justify-between text-sm text-gray-600">
                           
                            <div className="flex items-center space-x-1">
                           
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Customer Details */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white">Customer Details</h3>
                  
                  <div className="space-y-4">
                    {/* Customer Information Summary - Read Only */}
                    <div className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl
 rounded-lg p-4 text-blue-50">
                      <h4 className="font-medium text-white mb-3">Customer Information</h4>
                      <div className="space-y-2 text-sm">
                        {user.userType === 'school' ? (
                          <div>
                            <span className="font-medium">Organization:</span> {getCustomerData().customerName}
                          </div>
                        ) : (
                          <div>
                            <span className="font-medium">Name:</span> {getCustomerData().customerName}
                          </div>
                        )}
                        <div>
                          <span className="font-medium">Email:</span> {getCustomerData().email}
                        </div>
                        <div>
                          <span className="font-medium">Phone:</span> {getCustomerData().phone}
                        </div>
                      </div>
                      <p className="text-xs text-white/50 mt-2">
                        To change this information, please update your account settings.
                      </p>
                    </div>
                    
                    <div className="bg-blue-500/30 backdrop-blur-lg border border-white/20 shadow-2xl
 rounded-lg p-4">
                      <h4 className="font-medium text-blue-50 mb-2">Secure Payment with Paystack</h4>
                      <ul className="text-sm text-blue-50 space-y-1">
                        <li>• Your payment is processed securely by Paystack</li>
                        <li>• We accept Visa, Mastercard, and local bank transfers</li>
                        <li>• All transactions are encrypted and secure</li>
                        <li>• You'll be redirected to complete your payment</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setShowCheckout(false)} 
                  disabled={isProcessing || isCheckingPayment}
                  className="flex-1"
                  data-testid="button-cancel-checkout"
                >
                  Cancel
                </Button>
                
                {lastPaymentReference && (
                  <Button 
                    onClick={handleCheckPaymentStatus}
                    disabled={isCheckingPayment || isProcessing}
                    variant="outline"
                    className="flex-1 border-orange-300 text-orange-700 hover:bg-orange-50"
                    data-testid="button-check-payment"
                  >
                    {isCheckingPayment ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Checking...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Check Payment
                      </>
                    )}
                  </Button>
                )}
                
                <Button 
                  onClick={handleProcessPayment}
                  disabled={isProcessing || isLoadingRate || isCheckingPayment}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  data-testid="button-process-payment"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : isLoadingRate ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Loading rate...
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4 mr-2" />
                      Pay {formatPrice(convertPrice(finalTotalUSD))}
                    </>
                  )}
                </Button>
              </div>

              <p className="text-xs text-gray-500 text-center">
                * Secure payment processing powered by Paystack
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}