import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2, ShoppingCart, ArrowLeft, BookOpen, Menu, Settings, LogOut, Bell, X, Home } from "lucide-react";
import type { CartItem, School, Notification, AlumniBadge } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { CheckoutSection } from "@/components/CheckoutSection";
import { navigateBack, navigateWithTracking } from "@/lib/navigation";
import { useCurrency } from "@/contexts/CurrencyContext";
import appLogo from "@assets/logo_background_null.png";

export default function Cart() {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<any>(null);
  const [showHamburgerMenu, setShowHamburgerMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const { toast } = useToast();
  const { convertPrice, formatPrice } = useCurrency();

  // Set custom page title
  useEffect(() => {
    document.title = "Cart - Yearbuk";
  }, []);

  // Fetch user's cart items
  const { data: cartItems = [], isLoading } = useQuery<CartItem[]>({
    queryKey: ["/api/cart", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user?.id) return [];
      const res = await fetch(`/api/cart/${user.id}`);
      if (!res.ok) throw new Error("Failed to fetch cart items");
      return res.json();
    }
  });

  // Fetch schools for cart items to display school names
  const { data: schools = [] } = useQuery<School[]>({
    queryKey: ["/api/schools"],
    queryFn: async () => {
      const res = await fetch("/api/schools");
      if (!res.ok) throw new Error("Failed to fetch schools");
      return res.json();
    }
  });

  // Fetch current yearbook prices for items in cart
  const yearbookCartItems = cartItems.filter(item => item.itemType === 'yearbook');
  const { data: currentYearbooks = [] } = useQuery<any[]>({
    queryKey: ["/api/cart-yearbook-prices", yearbookCartItems.map(i => `${i.schoolId}-${i.year}`).join(',')],
    enabled: yearbookCartItems.length > 0,
    queryFn: async () => {
      const promises = yearbookCartItems.map(async (item) => {
        try {
          const res = await fetch(`/api/yearbooks/${item.schoolId}/${item.year}`);
          if (!res.ok) return null;
          return res.json();
        } catch {
          return null;
        }
      });
      const results = await Promise.all(promises);
      return results.filter(Boolean);
    }
  });

  // Fetch notifications (only for non-school accounts)
  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['/api/notifications', user?.id],
    enabled: !!user && user?.userType !== "school"
  });

  // Fetch alumni badges for account status (only for viewer accounts)
  const { data: alumniBadges = [] } = useQuery<AlumniBadge[]>({
    queryKey: ['/api/alumni-badges', user?.id],
    enabled: !!user && user?.userType === "viewer"
  });

  const unreadNotificationCount = notifications.filter(n => !n.isRead).length;
  
  // Notification mutations
  const clearAllNotificationsMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      await apiRequest("DELETE", `/api/notifications/user/${user.id}/clear-all`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications', user?.id] });
      toast({
        className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "All notifications cleared",
        description: "Your notification history has been cleared.",
      });
    },
  });

  const handleClearAllNotifications = () => {
    clearAllNotificationsMutation.mutate();
  };

  const markNotificationReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      await apiRequest("PATCH", `/api/notifications/${notificationId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications', user?.id] });
    },
  });

  const handleMarkNotificationRead = (notificationId: string) => {
    markNotificationReadMutation.mutate(notificationId);
  };

  // Helper function to format relative time
  const formatRelativeTime = (date: Date | null | undefined): string => {
    if (!date) return '';
    
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffSeconds < 60) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return new Date(date).toLocaleDateString();
  };
  
  // Determine account status (consistent with viewer-dashboard logic)
  const getAccountStatus = () => {
    if (!user || !user.userType) return 'Unknown';
    
    // Count verified and total badges
    const verifiedBadges = alumniBadges.filter((badge: any) => badge.status === 'verified');
    const totalBadges = alumniBadges.length;
    
    switch (user.userType.toLowerCase()) {
      case 'viewer':
        if (verifiedBadges.length > 0) {
          return `Alumni(${verifiedBadges.length})`;
        } else {
          return 'Viewer';
        }
      case 'school':
        return 'School Admin';
      case 'super_admin':
        return 'Super Admin';
      default:
        return 'Unknown';
    }
  };
  
  const accountStatus = getAccountStatus();

  // Remove item from cart mutation with optimistic updates
  const removeItemMutation = useMutation({
    mutationFn: async (cartItemId: string) => {
      await apiRequest("DELETE", `/api/cart/${cartItemId}`);
    },
    onMutate: async (cartItemId) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ["/api/cart", user?.id] });

      // Snapshot the previous value
      const previousCartItems = queryClient.getQueryData<CartItem[]>(["/api/cart", user?.id]);

      // Optimistically remove the item
      queryClient.setQueryData<CartItem[]>(["/api/cart", user?.id], (old = []) =>
        old.filter(item => item.id !== cartItemId)
      );

      // Show immediate success feedback
      toast({
        className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Item removed",
        description: "Yearbook has been removed from your cart."
      });

      // Return a context object with the snapshotted value
      return { previousCartItems, removedItemId: cartItemId };
    },
    onError: (error, cartItemId, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      queryClient.setQueryData(["/api/cart", user?.id], context?.previousCartItems || []);
      
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Failed to remove item",
        description: "Something went wrong. Please try again.",
        variant: "destructive"
      });
    },
    onSuccess: () => {
      // Refresh the cart data to ensure consistency
      queryClient.invalidateQueries({ queryKey: ["/api/cart", user?.id] });
    }
  });

  // Clear cart mutation with optimistic updates
  const clearCartMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/cart/clear/${user?.id}`);
    },
    onMutate: async () => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ["/api/cart", user?.id] });

      // Snapshot the previous value
      const previousCartItems = queryClient.getQueryData<CartItem[]>(["/api/cart", user?.id]);

      // Optimistically clear the cart
      queryClient.setQueryData<CartItem[]>(["/api/cart", user?.id], []);

      // Show immediate success feedback
      toast({
        className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Cart cleared",
        description: "All items have been removed from your cart."
      });

      // Return a context object with the snapshotted value
      return { previousCartItems };
    },
    onError: (error, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      queryClient.setQueryData(["/api/cart", user?.id], context?.previousCartItems || []);
      
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Failed to clear cart",
        description: "Something went wrong. Please try again.",
        variant: "destructive"
      });
    },
    onSuccess: () => {
      // Refresh the cart data to ensure consistency
      queryClient.invalidateQueries({ queryKey: ["/api/cart", user?.id] });
    }
  });

  // Handle click outside hamburger menu to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showHamburgerMenu) {
        const target = event.target as Element;
        if (!target.closest('[data-testid="button-hamburger-menu"]') && !target.closest('.hamburger-dropdown')) {
          setShowHamburgerMenu(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showHamburgerMenu]);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) {
      setLocation("/");
      return;
    }
    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);

    // Check for payment status in URL
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get("payment");
    const reference = urlParams.get("reference");

    if (paymentStatus === "success" && reference) {
      toast({
        className: "bg-green-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Payment successful",
        description: `Your payment has been processed successfully. Updating your library...`
      });
      
      // Refetch user data to get updated badge slots
      if (parsedUser?.id) {
        fetch(`/api/users/${parsedUser.id}`)
          .then(res => res.json())
          .then(updatedUser => {
            // Update user state and localStorage with fresh data
            setUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));
          })
          .catch(err => console.error('Failed to refetch user data:', err));
      }
      
      // Force refresh all related queries to show updated data
      queryClient.invalidateQueries({ queryKey: ["/api/cart", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/year-purchases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/viewer-purchases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/alumni-badges"] });
      
      // Clear stored payment reference since it's successful
      localStorage.removeItem('lastPaymentReference');
      
      // Clean up URL params
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Show additional success feedback
      setTimeout(() => {
        toast({
          className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
          title: "Library updated",
          description: "Your new yearbooks are now available in your library."
        });
      }, 1500);
    } else if (paymentStatus === "failed" && reference) {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Payment failed ❌",
        description: `Your payment could not be processed. Reference: ${reference}. Please try again or contact support.`,
        variant: "destructive"
      });
      // Clean up URL params
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [setLocation, toast]);

  const handleRemoveItem = (cartItemId: string) => {
    removeItemMutation.mutate(cartItemId);
  };

  const handleClearCart = () => {
    if (cartItems.length === 0) return;
    clearCartMutation.mutate();
  };

  const handleBackToDashboard = () => {
    if (user?.userType === "school") {
      // Use smart navigation for school users
      navigateBack(setLocation);
    } else {
      // Keep original logic for viewer users
      setLocation("/");
    }
  };

  const handleContinueShopping = () => {
    if (user?.userType === "school") {
      setLocation("/school-dashboard");
    } else {
      setLocation("/yearbook-finder");
    }
  };

  // Get current price for a cart item (prevents price exploit)
  const getCurrentPrice = (item: CartItem): number => {
    if (item.itemType === 'badge_slot') {
      return parseFloat(item.price || "0");
    }
    
    // For yearbooks, use current yearbook price
    const currentYearbook = currentYearbooks.find(
      yb => yb.schoolId === item.schoolId && yb.year === item.year
    );
    
    if (currentYearbook?.price) {
      return parseFloat(currentYearbook.price);
    }
    
    // Fallback to stored price if yearbook not found (shouldn't happen)
    return parseFloat(item.price || "0");
  };

  const calculateTotal = () => {
    return cartItems.reduce((total, item) => total + getCurrentPrice(item), 0);
  };

  const getSchoolName = (schoolId: string) => {
    const school = schools.find(s => s.id === schoolId);
    return school?.name || "Unknown School";
  };

  if (!user) return null;

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
      <div className="relative z-10 min-h-screen">
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
          <div className="mx-auto px-2 sm:px-4 lg:px-8 xl:px-12 2xl:px-16 relative z-10">
            <div className="flex justify-between items-center h-14 sm:h-16">
              <div className="flex items-center min-w-0 flex-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleBackToDashboard}
                  className="text-white hover:bg-white/20 flex-shrink-0 mr-2"
                  data-testid="button-back"
                >
                  <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
                
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <ShoppingCart className="text-white text-xs sm:text-sm" />
                </div>
                <h1 className="ml-2 sm:ml-3 text-sm sm:text-xl font-semibold text-white truncate">Shopping Cart</h1>
              </div>

              <div className="flex items-center space-x-1 sm:space-x-4 flex-shrink-0">
                {/* Conditional Account Status and Notifications - Only show for viewer accounts */}
                {user?.userType === "viewer" && (
                  <>
                    {/* Mobile Circle Status Indicator - Show only on small screens */}
                    <div className="sm:hidden relative">
                      {accountStatus === "Alumni" ? (
                        <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                          {alumniBadges.filter(b => b.status === "verified").length}
                        </div>
                      ) : (
                        <div className="w-6 h-6 bg-blue-500 rounded-full" />
                      )}
                    </div>
                    
                    {/* Desktop Account Status Indicator - Hidden on small screens */}
                    <div className={`hidden sm:block px-2 sm:px-3 py-1 rounded-full text-xs font-medium ${
                      accountStatus.startsWith("Alumni") 
                        ? "bg-green-500/20 text-green-200 border border-green-400/30" 
                        : "bg-blue-500/20 text-blue-200 border border-blue-400/30"
                    }`}>
                      <span className="hidden md:inline">Account Status: </span>{accountStatus}
                    </div>
                    
                    {/* Notification Bell */}
                    <div className="relative">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setShowNotifications(!showNotifications)}
                        className="relative text-white hover:bg-white/20"
                        data-testid="button-notifications"
                      >
                        <Bell className="h-5 w-5" />
                        {unreadNotificationCount > 0 && (
                          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                            {unreadNotificationCount}
                          </span>
                        )}
                      </Button>
                      
                      
                                
                    </div>
                    
                    <span className="text-xs sm:text-sm font-medium text-white hidden xs:block">
                      <span className="hidden sm:inline">{user?.fullName || "User"}</span>
                      <span className="sm:hidden">{(user?.fullName || "User").split(" ")[0]}</span>
                    </span>
                  </>
                )}
                
                {/* Hamburger Menu - Positioned independently */}
                <div className="relative">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setShowHamburgerMenu(!showHamburgerMenu)}
                    className="text-white hover:bg-white/20 p-2 bg-white/10 rounded-lg border border-white/20 ml-3"
                    data-testid="button-hamburger-menu"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                  
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Notification Dropdown */}
        {showNotifications && (
          <div className="notification-dropdown fixed top-16 right-16 w-72 sm:w-80 max-w-[calc(100vw-2rem)] bg-blue-600/60 backdrop-blur-lg rounded-lg shadow-xl border border-white/20 z-[999999]">
            <div className="p-4 border-b border-white/20">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Notifications</h3>
                <div className="flex items-center gap-2">
                  {notifications.length > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={handleClearAllNotifications}
                      className="text-white/80 hover:text-white text-xs"
                      data-testid="button-clear-all-notifications"
                    >
                      Clear All
                    </Button>
                  )}
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setShowNotifications(false)}
                    data-testid="button-close-notifications"
                  >
                    <X className="h-4 w-4 text-white hover:text-red-500" />
                  </Button>
                </div>
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-white/70">
                  No notifications yet
                </div>
              ) : (
                notifications.map((notification) => (
                  <div 
                    key={notification.id} 
                    className={`p-4 border-b border-white/20 hover:bg-white/10 cursor-pointer transition-colors ${
                      !notification.isRead ? 'bg-blue-500/20' : ''
                    }`}
                    onClick={() => {
                      if (!notification.isRead) {
                        handleMarkNotificationRead(notification.id);
                      }
                    }}
                    data-testid={`notification-${notification.id}`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                        !notification.isRead ? 'bg-blue-500' : 'bg-gray-300'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-white">
                          {notification.title}
                        </h4>
                        <p className="text-sm text-white/80 mt-1">
                          {notification.message}
                        </p>
                        <p className="text-xs text-white/60 mt-2">
                          {formatRelativeTime(notification.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Hamburger Menu Dropdown */}
        {showHamburgerMenu && (
          <div className="hamburger-dropdown fixed top-16 right-4 w-48 bg-blue-600/70 backdrop-blur-lg border border-white/20 rounded-lg shadow-xl z-[999999]">
            <div className="py-1">
              <button
                className="flex items-center w-full px-4 py-2 text-sm text-white hover:bg-white/10 transition-colors"
                onClick={() => {
                  setShowHamburgerMenu(false);
                  if (user?.userType === "school") {
                    setLocation("/school-dashboard");
                  } else {
                    setLocation("/");
                  }
                }}
                data-testid="menu-home"
              >
                <Home className="h-4 w-4 mr-3" />
                Home
              </button>
              <button
                className="flex items-center w-full px-4 py-2 text-sm text-white hover:bg-white/10 transition-colors"
                onClick={() => {
                  setShowHamburgerMenu(false);
                  if (user?.userType === "school") {
                    setLocation("/school-settings");
                  } else {
                    setLocation("/viewer-settings");
                  }
                }}
                data-testid="menu-settings"
              >
                <Settings className="h-4 w-4 mr-3" />
                Settings
              </button>
              <button
                className="flex items-center w-full px-4 py-2 text-sm text-white hover:bg-white/10 transition-colors"
                onClick={() => {
                  setShowHamburgerMenu(false);
                  navigateWithTracking(setLocation, "/cart");
                }}
                data-testid="menu-cart"
              >
                <ShoppingCart className="h-4 w-4 mr-3" />
                Cart
              </button>
              <div className="border-t border-gray-100"></div>
              <button
                className="flex items-center w-full px-4 py-2 text-sm text-red-500 hover:bg-red-500/40 transition-colors"
                onClick={() => {
                  setShowHamburgerMenu(false);
                  localStorage.removeItem("user");
                  setLocation("/");
                }}
                data-testid="menu-logout"
              >
                <LogOut className="h-4 w-4 mr-3" />
                Logout
              </button>
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-8">
          
          

          {/* Cart Content */}
          <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
            <CardContent className="p-3 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6">
                <h2 className="text-lg sm:text-xl font-semibold text-white mb-2 sm:mb-0">
                  Your Cart ({cartItems.length} items)
                </h2>
                
                {cartItems.length > 0 && (
                  <Button 
                    onClick={handleClearCart}
                    variant="outline"
                    className="bg-red-500/10 backdrop-blur-lg border border-red-400/20 text-red-300 hover:text-red-200 hover:bg-red-500/20 shadow-lg"
                    size="sm"
                    data-testid="button-clear-cart"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Clear Cart
                  </Button>
                )}
              </div>

              {isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
                  <p className="mt-2 text-white/70">Loading cart items...</p>
                </div>
              ) : cartItems.length === 0 ? (
                <div className="text-center py-8 sm:py-12">
                  <ShoppingCart className="mx-auto h-12 w-12 text-white/60 mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">Your cart is empty</h3>
                  <p className="text-white/70 mb-6">Add some yearbooks to your cart to get started!</p>
              
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Cart Items */}
                  {cartItems.map((item) => (
                    <div key={item.id} className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-lg p-3 sm:p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex-1 mb-3 sm:mb-0">
                          {item.itemType === 'badge_slot' ? (
                            <>
                              <h3 className="font-medium text-white text-sm sm:text-base">
                                Badge Slot{(item.quantity || 1) > 1 ? 's' : ''} × {item.quantity || 1}
                              </h3>
                              <p className="text-white/70 text-xs sm:text-sm mt-1">
                                Additional Alumni Badge Slots
                              </p>
                            </>
                          ) : (
                            <>
                              <h3 className="font-medium text-white text-sm sm:text-base">
                                {getSchoolName(item.schoolId || '')} - {item.year}
                              </h3>
                              <p className="text-white/70 text-xs sm:text-sm mt-1">
                                Yearbook Purchase
                              </p>
                            </>
                          )}
                        </div>
                        
                        <div className="flex items-center justify-between sm:justify-end sm:space-x-4">
                          <span className="text-lg sm:text-xl font-semibold text-white">
                            {formatPrice(convertPrice(getCurrentPrice(item)))}
                          </span>
                          <Button
                            onClick={() => handleRemoveItem(item.id)}
                            variant="outline"
                            size="sm"
                            className="bg-red-500/10 backdrop-blur-lg border border-red-400/20 text-red-300 hover:text-red-200 hover:bg-red-500/20 ml-4"
                            data-testid={`button-remove-${item.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Cart Summary */}
                  <div className="border-t border-white/20 pt-4 mt-6">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-lg font-semibold text-white">Total</span>
                      <span className="text-2xl font-bold text-white">
                        {formatPrice(convertPrice(calculateTotal()))}
                      </span>
                    </div>
                    
                    {/* Checkout Section */}
                    <CheckoutSection 
                      cartItems={cartItems}
                      total={calculateTotal()}
                      userType={user?.userType || "viewer"}
                      onContinueShopping={handleContinueShopping}
                      getCurrentPrice={getCurrentPrice}
                    />
                  </div>

                  {/* Continue Shopping Button */}
                  <div className="mt-6 pt-4 border-t border-white/20">
                    <Button 
                      onClick={handleContinueShopping}
                      variant="outline"
                      className="w-full bg-yellow-500/20 backdrop-blur-lg border border-yellow-200 shadow-2xl cursor-pointer transition-all hover:bg-yellow-310 hover:scale-105 hover:border hover:text-yellow-600 text-yellow-50 hover:shadow-yellow-500/50 hover:shadow-lg hover:scale-105 transition-all duration-200"
                      data-testid="button-continue-shopping-footer"
                    >
                      <BookOpen className="h-4 w-4 mr-2" />
                      {user?.userType === "school" ? "Back to Dashboard" : "Continue Shopping"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}