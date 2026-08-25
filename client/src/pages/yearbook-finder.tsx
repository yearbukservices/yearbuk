import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, LogOut, BookOpen, Calendar, GraduationCap, Search, MapPin, ShoppingCart, Grid3X3, List, Menu, Settings, Bell, X, Home, ArrowUpDown } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { School, AlumniBadge, Notification } from "@shared/schema";
// Cart functionality - removed CheckoutOverlay
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { CURRENT_YEAR, VIEWER_YEAR_PRICE, BETA_VERSION } from "@shared/constants";
import { useCurrency } from "@/contexts/CurrencyContext";
import { getSecureImageUrl } from "@/lib/secure-image";

export default function YearbookFinder() {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  const [showCartPopup, setShowCartPopup] = useState(false);
  const [selectedYearForCart, setSelectedYearForCart] = useState<{year: string, price: number} | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showHamburgerMenu, setShowHamburgerMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [sortBy, setSortBy] = useState<'year-desc' | 'year-asc' | 'price-desc' | 'price-asc'>('year-desc');
  const { toast } = useToast();
  const { convertPrice, formatPrice } = useCurrency();

  const currentYear = CURRENT_YEAR;
  
  // Get school parameter from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const schoolParam = urlParams.get('school');
    if (schoolParam) {
      setSelectedSchoolId(schoolParam);
    }
  }, []);

  // Fetch user's alumni badges to determine account status
  const { data: alumniBadges = [] } = useQuery<AlumniBadge[]>({
    queryKey: ["/api/alumni-badges", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user?.id) return [];
      const res = await fetch(`/api/alumni-badges/${user.id}`);
      if (!res.ok) throw new Error("Failed to fetch alumni badges");
      return res.json();
    }
  });

  // Fetch school data if schoolId is provided
  const { data: selectedSchool } = useQuery<School>({
    queryKey: ["/api/schools", selectedSchoolId],
    enabled: !!selectedSchoolId,
  });

  const accountStatus = alumniBadges.length > 0 ? "Alumni" : "Viewer";

  // Fetch notifications
  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user?.id) return [];
      const res = await fetch(`/api/notifications/${user.id}`);
      if (!res.ok) throw new Error("Failed to fetch notifications");
      return res.json();
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
  
  // Find alumni info for the selected school
  const alumniInfo = selectedSchool ? alumniBadges.find(badge => 
    badge.school === selectedSchool.name
  ) : null;

  // Fetch viewer's purchased years
  const { data: viewerPurchases = [] } = useQuery({
    queryKey: ["/api/viewer-year-purchases", user?.id, selectedSchoolId],
    enabled: !!user && !!selectedSchoolId,
    queryFn: async () => {
      if (!user?.id || !selectedSchoolId) return [];
      const res = await fetch(`/api/viewer-year-purchases/${user.id}/${selectedSchoolId}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch school's purchased years to check availability
  const { data: schoolPurchasedYears = [] } = useQuery({
    queryKey: ["/api/year-purchases/school", selectedSchoolId],
    enabled: !!selectedSchoolId,
    queryFn: async () => {
      if (!selectedSchoolId) return [];
      const res = await fetch(`/api/year-purchases/school/${selectedSchoolId}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Check which years have published yearbooks (for viewers to access)
  const { data: publishedYearbooks = [] } = useQuery<any[]>({
    queryKey: ["/api/published-yearbooks-list", selectedSchoolId],
    enabled: !!selectedSchoolId,
    staleTime: 0, // Force fresh data
    gcTime: 0, // Don't cache (renamed from cacheTime in v5)
    queryFn: async () => {
      if (!selectedSchoolId) return [];
      const res = await fetch(`/api/published-yearbooks-list/${selectedSchoolId}?t=${Date.now()}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Generate years from school's founding year to current year
  const schoolFoundingYear = selectedSchool?.yearFounded || 1980;
  const startYear = Math.max(1980, schoolFoundingYear);
  const endYear = currentYear; // Show years up to current year
  
  const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => {
    const year = endYear - i;
    
    // Check if this year has been published by the school
    const publishedYearbook = publishedYearbooks.find((p: any) => p.year === year && p.isPublished);
    const isPublished = !!publishedYearbook;
    const isFree = BETA_VERSION || publishedYearbook?.isFree || false;
    
    // Get the actual yearbook price from the database, fallback to default if not found
    const yearbookPrice = publishedYearbook?.price || "14.99";
    const frontCoverUrl = publishedYearbook?.frontCoverUrl || null;
    
    // Check if this year has been purchased by this viewer for this school
    const viewerYearPurchase = viewerPurchases.find((p: any) => p.year === year && p.schoolId === selectedSchoolId);
    const viewerPurchased = !!viewerYearPurchase?.purchased;
    
    // Access logic: yearbook is accessible if it's published AND (it's free OR viewer purchased it)
    const accessible = isPublished && (isFree || viewerPurchased);
    const canPurchase = isPublished && !isFree && !viewerPurchased;
    
    return {
      year,
      purchased: viewerPurchased,
      isPublished,
      isFree,
      price: parseFloat(yearbookPrice),
      accessible,
      canPurchase,
      frontCoverUrl,
      status: viewerPurchased ? 'Purchased' : isFree ? 'Free Access' : (isPublished ? 'Published' : 'Not Published')
    };
  });

  // Filter and sort years based on search term and sort option
  const filteredYears = years
    .filter(yearData => yearData.year.toString().includes(searchTerm))
    .sort((a, b) => {
      switch (sortBy) {
        case 'year-desc':
          return b.year - a.year; // Newest to Oldest
        case 'year-asc':
          return a.year - b.year; // Oldest to Newest
        case 'price-desc':
          return b.price - a.price; // Highest to Lowest
        case 'price-asc':
          return a.price - b.price; // Lowest to Highest
        default:
          return b.year - a.year;
      }
    });

  // Mark notification as read mutation
  const markNotificationReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      await apiRequest("PATCH", `/api/notifications/${notificationId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications", user?.id] });
    },
  });

  const handleMarkNotificationRead = (notificationId: string) => {
    markNotificationReadMutation.mutate(notificationId);
  };

  const unreadNotificationCount = notifications.filter(n => !n.isRead).length;

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

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) {
      setLocation("/");
      return;
    }
    setUser(JSON.parse(userData));
  }, [setLocation]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    setLocation("/");
  };

  const handleBackToDashboard = () => {
    setLocation("/");
  };

  const handleYearSelect = (yearData: any) => {
    if (yearData.isFree) {
      const schoolParam = selectedSchoolId ? `?school=${selectedSchoolId}` : '';
      setLocation(`/waibuk/${yearData.year}${schoolParam}`);
      return;
    }

    if (!yearData.accessible && yearData.canPurchase) {
      // Show cart popup instead of direct payment
      setSelectedYearForCart({
        year: yearData.year.toString(),
        price: yearData.price
      });
      setShowCartPopup(true);
      return;
    }
    
    if (!yearData.accessible && !yearData.canPurchase) {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Yearbook not published",
        description: "This yearbook has not been published by the school yet.",
        variant: "destructive",
      });
      return;
    }
    
    // Include school parameter if available
    const schoolParam = selectedSchoolId ? `?school=${selectedSchoolId}` : '';
    setLocation(`/waibuk/${yearData.year}${schoolParam}`);
  };

  const handleAddToCart = async () => {
    if (!selectedYearForCart || !user || !selectedSchoolId) return;
    
    try {
      const cartItemData = {
        userId: user.id,
        schoolId: selectedSchoolId,
        year: parseInt(selectedYearForCart.year),
        price: selectedYearForCart.price.toString()
      };
      
      await apiRequest("POST", "/api/cart", cartItemData);
      
      toast({
        className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Added to cart!",
        description: `${selectedYearForCart.year} yearbook has been added to your cart.`
      });
      
      setShowCartPopup(false);
      setSelectedYearForCart(null);
    } catch (error: any) {
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
    }
  };

  const handleViewCart = () => {
    setLocation("/cart");
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
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                <BookOpen className="text-white text-xs sm:text-sm" />
              </div>
              <h1 className="ml-2 sm:ml-3 text-sm sm:text-xl font-semibold text-white truncate">Yearbook Finder</h1>
            </div>

            <div className="flex items-center space-x-1 sm:space-x-4 flex-shrink-0">
              {/* Mobile Circle Status Indicator - Show only on small screens */}
              <div className="sm:hidden relative">
                {accountStatus === "Alumni" ? (
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    {alumniBadges.filter(b => b.status === "verified").length}
                  </div>
                ) : (
                  <div className="w-6 h-6 bg-blue-500 rounded-full"></div>
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
                <span className="hidden sm:inline">{user.fullName}</span>
                <span className="sm:hidden">{user.fullName.split(" ")[0]}</span>
              </span>
              
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
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowNotifications(false)}
              >
                <X className="h-4 w-4 text-white hover:text-red-500" />
              </Button>
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
                  className={`p-4 border-b border-white/20 hover:bg-white/10 cursor-pointer ${
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
                    <div className={`w-2 h-2 rounded-full mt-2 ${
                      !notification.isRead ? 'bg-blue-500' : 'bg-gray-300'
                    }`} />
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-white">
                        {notification.title}
                      </h4>
                      <p className="text-sm text-white/80 mt-1">
                        {notification.message}
                      </p>
                      <p className="text-xs text-white/60 mt-2">
                        {new Date(notification.createdAt || '').toLocaleDateString()}
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
        <div className="hamburger-dropdown fixed top-16 right-4 w-48 bg-blue-600/60 backdrop-blur-lg border border-white/20 rounded-lg shadow-xl z-[999999]">
          <div className="py-1">
            <button
              className="flex items-center w-full px-4 py-2 text-sm text-white hover:bg-white/10 transition-colors"
              onClick={() => {
                setShowHamburgerMenu(false);
                handleBackToDashboard();
              }}
              data-testid="menu-home"
            >
              <Home className="h-4 w-4 mr-3" />
              Dashboard
            </button>
            <button
              className="flex items-center w-full px-4 py-2 text-sm text-white hover:bg-white/10 transition-colors"
              onClick={() => {
                setShowHamburgerMenu(false);
                setLocation("/viewer-settings");
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
                setLocation("/cart");
              }}
              data-testid="menu-cart"
            >
              <ShoppingCart className="h-4 w-4 mr-3" />
              Cart
            </button>
            <button
              className="flex items-center w-full px-4 py-2 text-sm hover:bg-red-500/40 transition-colors text-red-500"
              onClick={() => {
                setShowHamburgerMenu(false);
                handleLogout();
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
        {/* Welcome Section */}
        <div className="mb-4 sm:mb-8">
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white">
            {selectedSchool ? `${selectedSchool.name} Yearbooks` : "Browse Yearbooks by Year"}
          </h2>
          <p className="text-sm sm:text-base text-blue-200 mt-1 sm:mt-2">
            {selectedSchool 
              ? `Explore memories and moments from ${selectedSchool.name}` 
              : "Select a year to view available yearbooks and memories"
            }
          </p>

          {/* School Information */}
          {selectedSchool && (
            <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-white/10 backdrop-blur-lg rounded-lg shadow-2xl">
              <div className="flex items-start space-x-2 sm:space-x-3">
                <Avatar className="h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0">
                  <AvatarImage src={selectedSchool.logo || undefined} alt={selectedSchool.name} />
                  <AvatarFallback className="bg-cyan-400/20 text-cyan-400 font-semibold">
                    {selectedSchool.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1 sm:space-y-2 min-w-0 flex-1">
                  <h3 className="text-sm sm:text-base font-semibold text-white break-words">{selectedSchool.name}</h3>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 text-xs sm:text-sm text-blue-200 space-y-1 sm:space-y-0">
                    <div className="flex items-center space-x-1">
                      <MapPin className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0 text-cyan-400" />
                      <span className="break-words">{selectedSchool.city}, {selectedSchool.country}</span>
                    </div>
                    <span className="hidden sm:inline">•</span>
                    <span>Founded {selectedSchool.yearFounded}</span>
                  </div>
                  {selectedSchool.address && (
                    <p className="text-xs sm:text-sm text-blue-200 break-words">{selectedSchool.address}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Alumni Graduation Info */}
          {accountStatus === "Alumni" && alumniInfo && (
            <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-2 mt-2 sm:mt-3 text-green-700">
              <div className="flex items-center space-x-2">
                <GraduationCap className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                <span className="text-xs sm:text-sm font-medium break-words">
                  {selectedSchool?.name || "Unknown School"} Class of {alumniInfo.graduationYear}
                </span>
              </div>
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full self-start sm:self-auto">
                {alumniInfo.status === 'verified' ? 'Verified Alumni' : 'Pending Verification'}
              </span>
            </div>
          )}
        </div>

        {/* Search Bar */}
        <div className="mb-4 sm:mb-8">
          <div className="relative max-w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/70 h-4 w-4" />
            <Input
              type="text"
              placeholder="Search years"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full text-sm sm:text-base bg-white/10 backdrop-blur-lg border border-white/20 shadow-xl text-white placeholder:text-white/50"
            />
          </div>
        </div>

        {/* Back to Dashboard Button */}
        <div className="mb-4 sm:mb-8">
          <Button 
            onClick={handleBackToDashboard}
            variant="outline"
            className="flex items-center space-x-2 text-sm sm:text-base px-3 py-2 sm:px-4 bg-white/10 backdrop-blur-lg border border-white/20 shadow-xl text-white hover:bg-white/20 hover:text-white"
            size="sm"
          >
            <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
            <span>Back to Dashboard</span>
          </Button>
        </div>

        {/* Years Grid */}
        <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
          <CardContent className="p-3 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 space-y-2 sm:space-y-0">
              <h3 className="text-base sm:text-lg font-semibold text-white break-words">
                {selectedSchool 
                  ? `${selectedSchool.name} Yearbooks by Year` 
                  : "Available Years"
                }
              </h3>
              <div className="flex items-center space-x-2 sm:space-x-4">
                <div className="hidden sm:flex items-center space-x-2 text-xs sm:text-sm text-blue-200">
                  <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-cyan-400" />
                  <span>{filteredYears.length} Years Available</span>
                </div>
                {/* Sort Dropdown */}
                <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                  <SelectTrigger 
                    className="w-[140px] sm:w-[180px] bg-white/20 backdrop-blur-sm border-white/20 text-white text-xs sm:text-sm"
                    data-testid="select-sort"
                  >
                    <ArrowUpDown className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className= "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white">
                    <SelectItem value="year-desc">Year: Newest First</SelectItem>
                    <SelectItem value="year-asc">Year: Oldest First</SelectItem>
                    <SelectItem value="price-desc">Price: High to Low</SelectItem>
                    <SelectItem value="price-asc">Price: Low to High</SelectItem>
                  </SelectContent>
                </Select>
                {/* View Mode Toggle */}
                <div className="flex items-center bg-white/20 backdrop-blur-sm rounded-lg p-1 border border-white/20">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-white/30 backdrop-blur-sm shadow-sm text-white' : 'text-blue-200 hover:text-white hover:bg-white/20'}`}
                    title="Grid View"
                  >
                    <Grid3X3 className="h-3 w-3 sm:h-4 sm:w-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-white/30 backdrop-blur-sm shadow-sm text-white' : 'text-blue-200 hover:text-white hover:bg-white/20'}`}
                    title="List View"
                  >
                    <List className="h-3 w-3 sm:h-4 sm:w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Years Display */}
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-6">
                {filteredYears.map((yearData) => (
                  <div key={yearData.year} className="relative">
                    <Button
                      onClick={() => handleYearSelect(yearData)}
                      disabled={!yearData.accessible && !yearData.canPurchase}
                      className={`w-full p-0 h-auto flex flex-col items-stretch overflow-hidden transition-all duration-200 ${
                        yearData.accessible 
                          ? "bg-green-600/20 backdrop-blur-lg border border-white/20 shadow-xl hover:bg-green-600/30 hover:scale-105"
                          : yearData.canPurchase 
                          ? "bg-blue-600/20 backdrop-blur-lg border border-blue-400/30 shadow-xl hover:bg-blue-600/30 hover:scale-105"
                          : "bg-gray-500/10 backdrop-blur-lg border border-gray-400/20 shadow-lg cursor-not-allowed opacity-50"
                      }`}
                      variant="outline"
                      data-testid={`button-year-${yearData.year}`}
                    >
                      {/* Front Cover Image */}
                      {yearData.frontCoverUrl ? (
                        <div className="w-full bg-gray-900/50 flex items-center justify-center">
                          <img
                            src={getSecureImageUrl(yearData.frontCoverUrl) || ''}
                            alt={`${yearData.year} Front Cover`}
                            className="w-full object-contain max-h-48 sm:max-h-64"
                            loading="lazy"
                          />
                        </div>
                      ) : (
                        <div className="w-full h-20 sm:h-24 flex items-center justify-center bg-gray-900/50">
                          <BookOpen className="h-8 w-8 sm:h-10 sm:w-10 text-white/30" />
                        </div>
                      )}
                      
                      {/* Year and Info Section */}
                      <div className="p-2 sm:p-3 w-full text-center">
                        <span className={`text-base sm:text-lg font-bold block ${
                          yearData.accessible ? "text-cyan-400" : "text-white"
                        }`}>
                          {yearData.year}
                        </span>
                        <span className="text-xs opacity-70 mt-1 flex items-center justify-center text-center">
                          {yearData.accessible ? (
                            <><Eye className="h-2 w-2 sm:h-3 sm:w-3 mr-1 flex-shrink-0 text-white" /><span className="hidden sm:inline text-cyan-400">View Yearbook</span><span className="sm:hidden text-cyan-400">View</span></>
                          ) : yearData.canPurchase ? (
                            <><ShoppingCart className="h-2 w-2 sm:h-3 sm:w-3 mr-1 flex-shrink-0 text-white" /><span className="text-white">{formatPrice(convertPrice(yearData.price))}</span></>
                          ) : null}
                        </span>
                      </div>
                    </Button>
                    {/* Status badge */}
                    <div className={`absolute top-0.5 sm:top-1 right-0.5 sm:right-1 px-1 sm:px-1.5 py-0.5 rounded text-xs font-medium ${
                      yearData.status === 'Purchased' 
                        ? "bg-green-100 text-green-800"
                        : "bg-orange-100 text-orange-800"
                    }`}>
                      {yearData.status}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredYears.map((yearData) => (
                  <div key={yearData.year} className="flex items-center justify-between p-3 sm:p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <span className="text-lg sm:text-xl font-bold text-gray-900">{yearData.year}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          yearData.status === 'Purchased' 
                            ? "bg-green-100 text-green-800"
                            : "bg-orange-100 text-orange-800"
                        }`}>
                          {yearData.status}
                        </span>
                        {yearData.canPurchase && (
                          <span className="text-sm font-semibold text-blue-600">
                            {formatPrice(convertPrice(yearData.price))}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      onClick={() => handleYearSelect(yearData)}
                      disabled={!yearData.accessible && !yearData.canPurchase}
                      className={`${
                        yearData.accessible 
                          ? "bg-white hover:bg-blue-600 hover:text-white text-gray-900 border border-gray-200"
                          : yearData.canPurchase 
                          ? "bg-blue-600 hover:bg-blue-700 text-white"
                          : "bg-gray-200 text-gray-400 cursor-not-allowed"
                      }`}
                      variant={yearData.accessible ? "outline" : "default"}
                      size="sm"
                      data-testid={`button-year-${yearData.year}`}
                    >
                      {yearData.accessible ? (
                        <><Eye className="h-4 w-4 mr-2" />View Yearbook</>
                      ) : yearData.canPurchase ? (
                        <><ShoppingCart className="h-4 w-4 mr-2" />Purchase</>
                      ) : (
                        <>{yearData.status}</>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* No results message */}
            {filteredYears.length === 0 && searchTerm && (
              <div className="text-center py-6 sm:py-8">
                <p className="text-sm sm:text-base text-gray-500">No years found matching "{searchTerm}"</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cart Popup */}
        {showCartPopup && selectedYearForCart && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl rounded-lg w-full max-w-md p-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-white mb-2">
                  {selectedSchool?.name} - {selectedYearForCart.year} Academic Yearbook
                </h3>
                <p className="text-gray-50 mb-4">
                  Yearbook Price: <span className="font-semibold text-blue-600">{formatPrice(convertPrice(selectedYearForCart.price))}</span>
                </p>
                
                <div className="flex flex-col space-y-3">
                  <Button 
                    onClick={handleAddToCart}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    data-testid="button-add-to-cart"
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Add to Cart
                  </Button>
                  
                  <Button 
                    onClick={handleViewCart}
                    variant="outline"
                    className="w-full"
                    data-testid="button-view-cart"
                  >
                    View Cart
                  </Button>
                  
                  <Button 
                    onClick={() => {
                      setShowCartPopup(false);
                      setSelectedYearForCart(null);
                    }}
                    variant="ghost"
                    className="w-full text-white"
                    data-testid="button-cancel-cart"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}