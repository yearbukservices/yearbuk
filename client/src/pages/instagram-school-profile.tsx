import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Calendar, Users, BookOpen, Image as ImageIcon, X, ChevronLeft, ChevronRight, User as UserIcon, Award, Plus, Trash2, Settings, Search, ArrowUpDown, ShoppingCart, Eye, Mail, Phone, GraduationCap, UserCheck } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { LoginDialog } from "@/components/LoginDialog";
import AlumniRequestDialog from "@/components/AlumniRequestDialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useCurrency } from "@/contexts/CurrencyContext";
import { BADGE_SLOT_PRICE, BETA_VERSION } from "@shared/constants";
import type { AlumniBadge, User as UserType } from "@shared/schema";
import { getPublicFrontCoverUrl, getPublicMemoryUrl } from "@/lib/secure-image";

interface SchoolProfileData {
  school: {
    id: string;
    username: string;
    name: string;
    logo: string | null;
    coverPhoto: string | null;
    motto: string | null;
    aboutDescription: string | null;
    city: string;
    state: string | null;
    address: string | null;
    country: string;
    yearFounded: number;
    website: string | null;
  };
  yearbooks: any[];
  memories: any[];
}

interface SchoolStats {
  memoriesCount: number;
  yearbooksCount: number;
  alumniCount: number;
}

interface Memory {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string;
  cloudinaryPublicId: string | null;
  eventDate: string;
  year: number;
  category: string | null;
}

interface Yearbook {
  id: string;
  year: number;
  title: string;
  frontCoverUrl: string | null;
  backCoverUrl: string | null;
  isFree: boolean;
  price: string | null;
  orientation: string | null;
  uploadType: string | null;
}

interface AlumniMember {
  id: string;
  userId: string;
  fullName: string;
  graduationYear: string;
  admissionYear: string;
  profileImage: string | null;
  email: string | null;
  phoneNumber: string | null;
  showPhoneToAlumni: boolean | null;
}

interface InstagramSchoolProfileProps {
  schoolUsername: string;
  initialTab?: "memories" | "yearbooks" | "alumni" | "profile";
  inDashboard?: boolean;
  resetAlumniFilters?: boolean;
  onBack?: () => void;
  showBackButton?: boolean;
}

export default function InstagramSchoolProfile({ 
  schoolUsername, 
  initialTab = "memories",
  inDashboard = false,
  resetAlumniFilters = false,
  onBack,
  showBackButton = false
}: InstagramSchoolProfileProps) {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [loginRedirectContext, setLoginRedirectContext] = useState<{ intent: string; schoolId?: string } | undefined>();
  const [selectedMemoryIndex, setSelectedMemoryIndex] = useState<number | null>(null);
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [editingPhoneNumber, setEditingPhoneNumber] = useState("");
  const [showBuySlotsDialog, setShowBuySlotsDialog] = useState(false);
  const [slotsToBuy, setSlotsToBuy] = useState(1);
  const [showAllBadges, setShowAllBadges] = useState(false);
  const [yearbookSearchTerm, setYearbookSearchTerm] = useState("");
  const [yearbookSortBy, setYearbookSortBy] = useState<'year-desc' | 'year-asc' | 'price-desc' | 'price-asc'>('year-desc');
  const [showCartPopup, setShowCartPopup] = useState(false);
  const [selectedYearForCart, setSelectedYearForCart] = useState<{year: string, price: number} | null>(null);
  const [showAlumniRequestDialog, setShowAlumniRequestDialog] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [mousePanStart, setMousePanStart] = useState<{ x: number; y: number; px: number; py: number } | null>(null);
  const [touchPanStart, setTouchPanStart] = useState<{ x: number; y: number; px: number; py: number } | null>(null);
  const [lastPinchDistance, setLastPinchDistance] = useState<number | null>(null);
  const [lastTapTime, setLastTapTime] = useState(0);
  
  // Alumni filter state - will be persisted in localStorage
  const getStorageKey = () => `alumni-filters-${schoolUsername}`;
  
  const loadAlumniFiltersFromStorage = () => {
    try {
      const saved = localStorage.getItem(getStorageKey());
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('Error loading alumni filters:', error);
    }
    return null;
  };
  
  const savedFilters = loadAlumniFiltersFromStorage();
  const [alumniGraduationYearFilter, setAlumniGraduationYearFilter] = useState<string>(savedFilters?.graduationYear || 'all');
  const [alumniAdmissionYearFilter, setAlumniAdmissionYearFilter] = useState<string>(savedFilters?.admissionYear || 'all');
  const [showDidNotGraduate, setShowDidNotGraduate] = useState(savedFilters?.didNotGraduate || false);
  const [alumniSearchTerm, setAlumniSearchTerm] = useState(savedFilters?.searchTerm || "");
  
  const { toast } = useToast();
  const { convertPrice, formatPrice } = useCurrency();

  // Check if the current user is the school owner viewing their own profile
  const isSchoolOwner = user && user.userType === "school";

  // Save alumni filters to localStorage whenever they change
  useEffect(() => {
    const filters = {
      graduationYear: alumniGraduationYearFilter,
      admissionYear: alumniAdmissionYearFilter,
      didNotGraduate: showDidNotGraduate,
      searchTerm: alumniSearchTerm
    };
    
    try {
      localStorage.setItem(getStorageKey(), JSON.stringify(filters));
    } catch (error) {
      console.error('Error saving alumni filters:', error);
    }
  }, [alumniGraduationYearFilter, alumniAdmissionYearFilter, showDidNotGraduate, alumniSearchTerm, schoolUsername]);

  // Handle reset when resetAlumniFilters prop changes
  useEffect(() => {
    if (resetAlumniFilters) {
      // Clear localStorage
      try {
        localStorage.removeItem(getStorageKey());
      } catch (error) {
        console.error('Error clearing alumni filters:', error);
      }
      
      // Reset all filter states
      setAlumniGraduationYearFilter('all');
      setAlumniAdmissionYearFilter('all');
      setShowDidNotGraduate(false);
      setAlumniSearchTerm("");
    }
  }, [resetAlumniFilters, schoolUsername]);

  // Fetch school profile data
  const { data: profileData, isLoading: profileLoading } = useQuery<SchoolProfileData>({
    queryKey: ["/api/schools/profile-by-username", schoolUsername],
  });

  // Fetch school stats
  const { data: stats } = useQuery<SchoolStats>({
    queryKey: ["/api/schools", profileData?.school.id, "stats"],
    enabled: !!profileData?.school.id,
  });

  // Fetch all memories for memories tab
  const { data: allMemories = [], isLoading: memoriesLoading } = useQuery<Memory[]>({
    queryKey: ["/api/schools", profileData?.school.id, "memories-all"],
    enabled: !!profileData?.school.id && activeTab === "memories",
  });

  // Fetch all yearbooks for yearbooks tab
  const { data: allYearbooks = [], isLoading: yearbooksLoading } = useQuery<Yearbook[]>({
    queryKey: ["/api/schools", profileData?.school.id, "yearbooks-all"],
    enabled: !!profileData?.school.id && activeTab === "yearbooks",
  });

  // Fetch viewer's purchased years for this school
  const { data: viewerPurchases = [] } = useQuery({
    queryKey: ["/api/viewer-year-purchases", user?.id, profileData?.school.id],
    enabled: !!user && !!profileData?.school.id && activeTab === "yearbooks",
    queryFn: async () => {
      if (!user?.id || !profileData?.school.id) return [];
      const res = await fetch(`/api/viewer-year-purchases/${user.id}/${profileData.school.id}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch alumni for alumni tab
  const { data: alumni = [], isLoading: alumniLoading } = useQuery<AlumniMember[]>({
    queryKey: ["/api/schools", profileData?.school.id, "alumni"],
    enabled: !!profileData?.school.id && activeTab === "alumni",
  });

  // Fetch alumni badges for profile tab
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

  // Check if current user is verified alumni (from alumni list OR from their badges)
  const isVerifiedAlumni = (user && alumni.some(a => a.userId === user.id)) ||
    alumniBadges.some(b => b.school === profileData?.school.name && b.status === "verified");

  // Check if user already has any badge (pending or verified) for this school
  const hasAlumniBadgeForSchool = alumniBadges.some(b => b.school === profileData?.school.name);

  const maxAlumniBadges = user?.badgeSlots || 4;
  const displayedBadges = showAllBadges ? alumniBadges : alumniBadges.slice(0, maxAlumniBadges);

  // Handle tab changes and update URL
  const handleTabChange = (value: string) => {
    // For school owners clicking yearbooks/alumni, the onClick handler already navigates
    // to the standalone routes, so we skip the tab change logic
    if (isSchoolOwner && (value === "yearbooks" || value === "alumni")) {
      return;
    }
    
    setActiveTab(value as typeof activeTab);
    if (inDashboard) {
      if (value === "memories") {
        setLocation(`/${schoolUsername}`, { replace: true });
      } else {
        setLocation(`/${schoolUsername}/${value}`, { replace: true });
      }
    }
  };

  // Handle phone number update
  const handlePhoneNumberUpdate = async () => {
    if (!user) return;
    
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: editingPhoneNumber }),
      });
      
      if (response.ok) {
        setIsEditingPhone(false);
        toast({
          title: "Phone number updated",
          description: "Your phone number has been successfully updated.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update phone number. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle phone privacy toggle
  const handlePhonePrivacyToggle = async (checked: boolean) => {
    if (!user) return;
    
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showPhoneToAlumni: checked }),
      });
      
      if (response.ok) {
        toast({
          title: "Privacy setting updated",
          description: checked ? "Your phone number will be visible to alumni" : "Your phone number will be hidden from alumni",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update privacy setting. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Delete alumni badge mutation
  const deleteAlumniBadgeMutation = useMutation({
    mutationFn: async (badgeId: string) => {
      await apiRequest("DELETE", `/api/alumni-badges/${badgeId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alumni-badges", user?.id] });
      toast({
        title: "Badge deleted",
        description: "Alumni badge has been successfully deleted.",
      });
    },
  });

  // Add badge slots to cart mutation
  const addBadgeSlotsToCartMutation = useMutation({
    mutationFn: async (numberOfSlots: number) => {
      const totalPrice = (BADGE_SLOT_PRICE * numberOfSlots).toFixed(2);
      await apiRequest("POST", "/api/cart", {
        userId: user?.id,
        itemType: "badge_slot",
        quantity: numberOfSlots,
        price: totalPrice,
        schoolId: null,
        year: null,
        orientation: null,
        uploadType: null
      });
    },
    onSuccess: () => {
      setShowBuySlotsDialog(false);
      setSlotsToBuy(1);
      queryClient.invalidateQueries({ queryKey: ["/api/cart", user?.id] });
      toast({
        className: "bg-green-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Added to cart! 🛒",
        description: `${slotsToBuy} badge slot(s) added to your cart. Go to cart to checkout.`,
      });
    },
  });

  // Handle adding yearbook to cart
  const handleAddToCart = async () => {
    if (!selectedYearForCart || !user || !profileData?.school.id) return;
    
    try {
      const cartItemData = {
        userId: user.id,
        schoolId: profileData.school.id,
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

  // Handle Request Alumni Status button
  const handleRequestAlumni = () => {
    if (!user) {
      setLoginRedirectContext({
        intent: 'request-alumni-status',
        schoolId: profileData?.school.id
      });
      setShowLoginDialog(true);
      return;
    }
    setShowAlumniRequestDialog(true);
  };

  // Lightbox navigation
  const handlePrevImage = () => {
    if (selectedMemoryIndex !== null && selectedMemoryIndex > 0) {
      setSelectedMemoryIndex(selectedMemoryIndex - 1);
    }
  };

  const handleNextImage = () => {
    if (selectedMemoryIndex !== null && selectedMemoryIndex < allMemories.length - 1) {
      setSelectedMemoryIndex(selectedMemoryIndex + 1);
    }
  };

  // Reset zoom/pan whenever the active image changes
  useEffect(() => {
    setZoom(1);
    setPanX(0);
    setPanY(0);
    setMousePanStart(null);
    setTouchPanStart(null);
    setLastPinchDistance(null);
  }, [selectedMemoryIndex]);

  // Touch/swipe + zoom/pan handlers for mobile
  const minSwipeDistance = 50;

  const getPinchDistance = (touches: React.TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      setLastPinchDistance(getPinchDistance(e.touches));
      setIsDragging(false);
    } else if (e.touches.length === 1) {
      const touch = e.touches[0];
      if (zoom > 1) {
        setTouchPanStart({ x: touch.clientX, y: touch.clientY, px: panX, py: panY });
      } else {
        // Check for double-tap to zoom in
        const now = Date.now();
        if (now - lastTapTime < 300) {
          setZoom(2.5);
        }
        setLastTapTime(now);
        setTouchEnd(null);
        setTouchStart(touch.clientX);
        setIsDragging(true);
      }
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = getPinchDistance(e.touches);
      if (lastPinchDistance !== null) {
        const ratio = dist / lastPinchDistance;
        setZoom(z => Math.min(5, Math.max(1, z * ratio)));
      }
      setLastPinchDistance(dist);
    } else if (e.touches.length === 1 && zoom > 1 && touchPanStart) {
      const touch = e.touches[0];
      const dx = touch.clientX - touchPanStart.x;
      const dy = touch.clientY - touchPanStart.y;
      setPanX(touchPanStart.px + dx / zoom);
      setPanY(touchPanStart.py + dy / zoom);
    } else if (zoom === 1 && e.touches.length === 1) {
      if (!touchStart) return;
      const currentTouch = e.touches[0].clientX;
      setTouchEnd(currentTouch);
      setDragOffset(currentTouch - touchStart);
    }
  };

  const onTouchEnd = () => {
    if (lastPinchDistance !== null) {
      setLastPinchDistance(null);
      return;
    }
    if (zoom > 1) {
      setTouchPanStart(null);
      return;
    }
    if (!touchStart || !touchEnd) {
      setIsDragging(false);
      setDragOffset(0);
      return;
    }
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe && selectedMemoryIndex !== null && selectedMemoryIndex < allMemories.length - 1) {
      setSelectedMemoryIndex(selectedMemoryIndex + 1);
    } else if (isRightSwipe && selectedMemoryIndex !== null && selectedMemoryIndex > 0) {
      setSelectedMemoryIndex(selectedMemoryIndex - 1);
    }
    
    setIsDragging(false);
    setDragOffset(0);
    setTouchStart(null);
    setTouchEnd(null);
  };

  // Mouse wheel zoom
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.3 : 0.3;
    setZoom(z => {
      const next = Math.min(5, Math.max(1, z + delta));
      if (next === 1) { setPanX(0); setPanY(0); }
      return next;
    });
  };

  // Mouse drag pan
  const onMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      e.preventDefault();
      setMousePanStart({ x: e.clientX, y: e.clientY, px: panX, py: panY });
    }
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (mousePanStart && zoom > 1) {
      const dx = e.clientX - mousePanStart.x;
      const dy = e.clientY - mousePanStart.y;
      setPanX(mousePanStart.px + dx / zoom);
      setPanY(mousePanStart.py + dy / zoom);
    }
  };

  const onMouseUp = () => { setMousePanStart(null); };

  // Double-click to toggle zoom
  const onDoubleClick = () => {
    if (zoom > 1) {
      setZoom(1); setPanX(0); setPanY(0);
    } else {
      setZoom(2.5);
    }
  };

  if (profileLoading) {
    return (
      <div className="w-full max-w-5xl mx-auto p-4 space-y-4">
        <Skeleton className="w-full h-64" />
        <div className="flex gap-4">
          <Skeleton className="h-32 w-32 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="p-6">
          <p className="text-muted-foreground">School not found</p>
        </Card>
      </div>
    );
  }

  const { school } = profileData;
  return (
    <div className="w-full">
      {/* Back Button */}
      {showBackButton && onBack && (
        <div className="mb-4">
          <Button
            variant="ghost"
            onClick={onBack}
            className="flex items-center gap-2 text-white hover:bg-white/10 bg-white/5 border border-white/20"
            data-testid="button-back-to-search"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
      )}
      {/* Banner Section */}
      <div className="relative w-full aspect-[3/1] bg-muted overflow-hidden group">
        {school.coverPhoto ? (
          <img
            src={school.coverPhoto}
            alt={`${school.name} cover`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-blue-600" />
        )}
        {isSchoolOwner && (
          <Button
            variant="secondary"
            size="sm"
            className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity bg-green-700/50 backdrop-blur-lg border border-green-500/50 shadow-2xl hover:bg-green-700/60"
            onClick={() => setLocation("/school-settings?tab=profile")}
            data-testid="button-edit-banner"
          >
            <Settings className="h-4 w-4 mr-2" />
            Edit Banner
          </Button>
        )}
      </div>
      {/* School Identity & Info Section */}
      <div className="max-w-5xl mx-auto px-4 mt-6 md:mt-8 relative z-10">
        <div className="flex flex-col md:flex-row gap-4 md:gap-6">
          {/* School Logo */}
          <div className="relative group">
            <Avatar className="h-32 w-32 md:h-40 md:w-40 relative z-10">
              <AvatarImage src={school.logo || undefined} alt={school.name} />
              <AvatarFallback className="text-3xl md:text-4xl">
                {school.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {isSchoolOwner && (
              <Button
                variant="secondary"
                size="sm"
                className="absolute bottom-0 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-green-700/50 backdrop-blur-lg border border-green-500/50 shadow-2xl hover:bg-green-700/60"
                onClick={() => setLocation("/school-settings?tab=profile")}
                data-testid="button-edit-logo"
              >
                <Settings className="h-4 w-4 mr-2" />
                Edit Logo
              </Button>
            )}
          </div>

          {/* School Info & Stats */}
          <div className="flex-1 rounded-lg p-4 md:p-6 space-y-4 relative z-10 bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white" data-testid="text-school-name">
                  {school.name}
                </h1>
                {school.motto && (
                  <p className="text-muted-foreground italic mt-1">{school.motto}</p>
                )}
              </div>
              {user && user.userType === "viewer" && !isSchoolOwner && !hasAlumniBadgeForSchool && (
                <Button 
                  onClick={handleRequestAlumni}
                  data-testid="button-request-alumni"
                  className="shrink-0 bg-blue-700/50 backdrop-blur-lg border border-blue-500/50 shadow-2xl hover:bg-blue-700/60"
                >
                  Request Alumni Status
                </Button>
              )}
              {user && user.userType === "viewer" && !isSchoolOwner && hasAlumniBadgeForSchool && !isVerifiedAlumni && (
                <span className="shrink-0 px-3 py-2 text-sm rounded-md bg-orange-500/20 border border-orange-400/40 text-orange-200">
                  Alumni Request Pending
                </span>
              )}
              {user && user.userType === "viewer" && !isSchoolOwner && isVerifiedAlumni && (
                <span className="shrink-0 px-3 py-2 text-sm rounded-md bg-green-500/20 border border-green-400/40 text-green-200">
                  ✓ Verified Alumni
                </span>
              )}
              {isSchoolOwner && (
                <Button 
                  onClick={() => setLocation("/school-settings?tab=profile")}
                  data-testid="button-edit-school-info"
                  className="shrink-0 bg-green-700/50 backdrop-blur-lg border border-green-500/50 shadow-2xl hover:bg-green-700/60"
                  variant="secondary"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Edit School Info
                </Button>
              )}
            </div>

            {/* Stats Row */}
            <div className="flex gap-6">
              <div className="text-center" data-testid="stat-memories">
                <div className="text-xl md:text-2xl font-bold text-white">{stats?.memoriesCount || 0}</div>
                <div className="text-sm text-[#ffffff]">Memories</div>
              </div>
              <div className="text-center" data-testid="stat-yearbooks">
                <div className="text-xl md:text-2xl font-bold text-white">{stats?.yearbooksCount || 0}</div>
                <div className="text-sm text-[#ffffff]">Yearbooks</div>
              </div>
              <div className="text-center" data-testid="stat-alumni">
                <div className="text-xl md:text-2xl font-bold text-white">{stats?.alumniCount || 0}</div>
                <div className="text-sm text-[#ffffff]">Alumni</div>
              </div>
            </div>

            {/* School Details */}
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              {school.city && school.country && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4 text-white" />
                  <span className="text-white">
                    {school.city}{school.state && `, ${school.state}`}, {school.country}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4 text-white" />
                <span className="text-white">Founded {school.yearFounded}</span>
              </div>
            </div>

            {school.aboutDescription && (
              <p className="text-sm">{school.aboutDescription}</p>
            )}
          </div>
        </div>

        {/* Tabs Section */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-6">
          <TabsList className="grid w-full grid-cols-3 bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl
text-white">
            <TabsTrigger value="memories" data-testid="tab-memories">
              <ImageIcon className="h-4 w-4 mr-2" />
              Memories
            </TabsTrigger>
            <TabsTrigger 
              value="yearbooks" 
              data-testid="tab-yearbooks"
              onClick={(e) => {
                if (isSchoolOwner) {
                  e.preventDefault();
                  e.stopPropagation();
                  setLocation("/yearbooks");
                }
              }}
            >
              <BookOpen className="h-4 w-4 mr-2" />
              Yearbooks
            </TabsTrigger>
            <TabsTrigger 
              value="alumni" 
              data-testid="tab-alumni"
              onClick={(e) => {
                if (isSchoolOwner) {
                  e.preventDefault();
                  setLocation("/alumni");
                }
              }}
            >
              <Users className="h-4 w-4 mr-2" />
              Alumni
            </TabsTrigger>
          </TabsList>

          {/* Memories Tab */}
          <TabsContent value="memories" className="mt-6">
            {isSchoolOwner && (
              <div className="mb-4 flex justify-end">
                <Button
                  className="bg-blue-700/50 backdrop-blur-lg border border-blue-500/50 shadow-2xl hover:bg-blue-700/60"
                  onClick={() => setLocation("/memories")}
                  data-testid="button-manage-memories"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Manage Memories
                </Button>
              </div>
            )}
            {memoriesLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {[...Array(8)].map((_, i) => (
                  <Skeleton key={i} className="aspect-square" />
                ))}
              </div>
            ) : allMemories.length === 0 ? (
              <Card className="p-12 text-center bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl text-white">
                <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4 text-white" />
                <p className="text-muted-foreground text-white">No memories available yet</p>
                {isSchoolOwner && (
                  <Button
                    onClick={() => setLocation("/memories")}
                    className="mt-4 bg-blue-700/50 backdrop-blur-lg border border-blue-500/50 shadow-2xl hover:bg-blue-700/60"
                    data-testid="button-add-first-memory"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Memory
                  </Button>
                )}
              </Card>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {allMemories.map((memory, index) => (
                  <div
                    key={memory.id}
                    className="aspect-square overflow-hidden rounded-md cursor-pointer hover-elevate active-elevate-2 bg-muted"
                    onClick={() => setSelectedMemoryIndex(index)}
                    data-testid={`memory-${index}`}
                  >
                    <img
                      src={getPublicMemoryUrl(memory.imageUrl) || ''}
                      alt={memory.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Yearbooks Tab */}
          <TabsContent value="yearbooks" className="mt-6">
            {isSchoolOwner && (
              <div className="mb-4 flex justify-end">
                <Button
                  onClick={() => setLocation("/yearbooks")}
                  data-testid="button-manage-yearbooks"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Manage Yearbooks
                </Button>
              </div>
            )}

            {!isSchoolOwner && (
              <div className="mb-6 flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    type="text"
                    placeholder="Search yearbooks by year..."
                    value={yearbookSearchTerm}
                    onChange={(e) => setYearbookSearchTerm(e.target.value)}
                    className="pl-10 bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/60"
                    data-testid="input-search-yearbooks"
                  />
                </div>
                <Select value={yearbookSortBy} onValueChange={(value: any) => setYearbookSortBy(value)}>
                  <SelectTrigger className="w-full sm:w-[200px] bg-white/10 backdrop-blur-lg border border-white/20 text-white" data-testid="select-sort">
                    <ArrowUpDown className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-blue-600/60 backdrop-blur-lg border border-white/20 text-white">
                    <SelectItem value="year-desc">Newest to Oldest</SelectItem>
                    <SelectItem value="year-asc">Oldest to Newest</SelectItem>
                    <SelectItem value="price-desc">Price: High to Low</SelectItem>
                    <SelectItem value="price-asc">Price: Low to High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {yearbooksLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-64" />
                ))}
              </div>
            ) : allYearbooks.length === 0 ? (
              <Card className="p-12 text-center bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl text-white">
                <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4 text-white" />
                <p className="text-muted-foreground text-white">No yearbooks published yet</p>
                {isSchoolOwner && (
                  <Button
                    onClick={() => setLocation("/yearbooks")}
                    className="mt-4"
                    data-testid="button-add-first-yearbook"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Yearbook
                  </Button>
                )}
              </Card>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-6">
                {allYearbooks
                  .filter(yearbook => yearbook.year.toString().includes(yearbookSearchTerm))
                  .sort((a, b) => {
                    switch (yearbookSortBy) {
                      case 'year-desc':
                        return b.year - a.year;
                      case 'year-asc':
                        return a.year - b.year;
                      case 'price-desc':
                        return parseFloat(b.price || "0") - parseFloat(a.price || "0");
                      case 'price-asc':
                        return parseFloat(a.price || "0") - parseFloat(b.price || "0");
                      default:
                        return b.year - a.year;
                    }
                  })
                  .map((yearbook) => {
                    const viewerYearPurchase = viewerPurchases.find((p: any) => p.year === yearbook.year && p.schoolId === profileData?.school.id);
                    const viewerPurchased = !!viewerYearPurchase?.purchased;
                    const accessible = BETA_VERSION || yearbook.isFree || viewerPurchased;
                    const canPurchase = !BETA_VERSION && !yearbook.isFree && !viewerPurchased;
                    
                    return (
                      <div key={yearbook.id} className="relative">
                        <Button
                          onClick={() => {
                            if (yearbook.isFree) {
                              setLocation(`/yearbook/${school.id}/${yearbook.year}`);
                            } else if (!user) {
                              setShowLoginDialog(true);
                            } else if (accessible) {
                              setLocation(`/yearbook/${school.id}/${yearbook.year}`);
                            } else if (canPurchase) {
                              setSelectedYearForCart({
                                year: yearbook.year.toString(),
                                price: parseFloat(yearbook.price || "0")
                              });
                              setShowCartPopup(true);
                            } else {
                              toast({
                                className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
                                title: "Not available",
                                description: "This yearbook is not yet available for purchase.",
                                variant: "destructive",
                              });
                            }
                          }}
                          disabled={!accessible && !canPurchase}
                          className={`w-full p-0 h-auto flex flex-col items-stretch overflow-hidden transition-all duration-200 ${
                            accessible 
                              ? "bg-green-600/20 backdrop-blur-lg border border-white/20 shadow-xl hover:bg-green-600/30 hover:scale-105"
                              : canPurchase 
                              ? "bg-blue-600/20 backdrop-blur-lg border border-blue-400/30 shadow-xl hover:bg-blue-600/30 hover:scale-105"
                              : "bg-gray-500/10 backdrop-blur-lg border border-gray-400/20 shadow-lg cursor-not-allowed opacity-50"
                          }`}
                          variant="outline"
                          data-testid={`yearbook-${yearbook.year}`}
                        >
                          {/* Front Cover Image */}
                          {yearbook.frontCoverUrl ? (
                            <div className="w-full min-h-48 sm:min-h-64 bg-gray-900/50 flex items-center justify-center">
                              <img
                                src={getPublicFrontCoverUrl(yearbook.frontCoverUrl) || ''}
                                alt={`${yearbook.year} Front Cover`}
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
                              accessible ? "text-cyan-400" : "text-white"
                            }`}>
                              {yearbook.year}
                            </span>
                            <span className="text-xs opacity-70 mt-1 flex items-center justify-center text-center">
                              {accessible ? (
                                <><Eye className="h-2 w-2 sm:h-3 sm:w-3 mr-1 flex-shrink-0 text-white" /><span className="hidden sm:inline text-cyan-400">View Yearbook</span><span className="sm:hidden text-cyan-400">View</span></>
                              ) : canPurchase ? (
                                <><ShoppingCart className="h-2 w-2 sm:h-3 sm:w-3 mr-1 flex-shrink-0 text-white" /><span className="text-white">{formatPrice(convertPrice(parseFloat(yearbook.price || "0")))}</span></>
                              ) : null}
                            </span>
                          </div>
                        </Button>
                        {/* Status badge */}
                        <div className={`absolute top-0.5 sm:top-1 right-0.5 sm:right-1 px-1 sm:px-1.5 py-0.5 rounded text-xs font-medium ${
                          viewerPurchased 
                            ? "bg-green-100 text-green-800"
                            : yearbook.isFree
                            ? "bg-orange-100 text-orange-800"
                            : "bg-blue-100 text-blue-800"
                        }`}>
                          {viewerPurchased ? "Purchased" : yearbook.isFree ? "Free" : "For Sale"}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </TabsContent>

          {/* Alumni Tab */}
          <TabsContent value="alumni" className="mt-6">
            <div className="space-y-6">
              {/* Alumni Connection Header */}
              <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-3 mb-6">
                    <Users className="h-6 w-6 text-blue-400" />
                    <div>
                      <h3 className="text-lg font-semibold text-white">Alumni Network</h3>
                      <p className="text-sm text-white/70">
                        Connect with alumni and explore graduating classes
                      </p>
                    </div>
                  </div>

                  {/* Filter Controls */}
                  <div className="space-y-4">
                    {/* Dropdowns Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Graduation Year Filter */}
                      <div className="space-y-2">
                        <Label className="text-white text-sm">Graduation Year</Label>
                        <Select 
                          value={alumniGraduationYearFilter} 
                          onValueChange={setAlumniGraduationYearFilter}
                          disabled={showDidNotGraduate}
                        >
                          <SelectTrigger 
                            className="bg-white/10 backdrop-blur-lg border border-white/20 text-white disabled:opacity-50 disabled:cursor-not-allowed" 
                            data-testid="select-graduation-year-filter"
                          >
                            <SelectValue placeholder="All years" />
                          </SelectTrigger>
                          <SelectContent className="bg-blue-600/60 backdrop-blur-lg border border-white/20">
                            <SelectItem value="all" className="text-white hover:bg-white/20">All Years</SelectItem>
                            {(() => {
                              const CURRENT_YEAR = 2026;
                              const foundingYear = profileData?.school.yearFounded || 1980;
                              const years: number[] = [];
                              for (let year = CURRENT_YEAR; year >= foundingYear; year--) {
                                years.push(year);
                              }
                              return years.map(year => (
                                <SelectItem key={year} value={year.toString()} className="text-white hover:bg-white/20">
                                  {year}
                                </SelectItem>
                              ));
                            })()}
                          </SelectContent>
                        </Select>
                        
                        {/* Did Not Graduate Checkbox */}
                        <div className="flex items-center space-x-2 mt-3">
                          <Checkbox 
                            id="did-not-graduate"
                            checked={showDidNotGraduate}
                            onCheckedChange={(checked) => setShowDidNotGraduate(checked === true)}
                            className="border-white data-[state=checked]:bg-white data-[state=checked]:text-blue-600"
                            data-testid="checkbox-did-not-graduate"
                          />
                          <Label 
                            htmlFor="did-not-graduate" 
                            className="text-white text-sm cursor-pointer"
                          >
                            Did not graduate
                          </Label>
                        </div>
                      </div>

                      {/* Admission Year Filter */}
                      <div className="space-y-2">
                        <Label className="text-white text-sm">Admission Year</Label>
                        <Select 
                          value={alumniAdmissionYearFilter} 
                          onValueChange={setAlumniAdmissionYearFilter}
                        >
                          <SelectTrigger className="bg-white/10 backdrop-blur-lg border border-white/20 text-white" data-testid="select-admission-year-filter">
                            <SelectValue placeholder="All years" />
                          </SelectTrigger>
                          <SelectContent className="bg-blue-600/60 backdrop-blur-lg border border-white/20 text-white">
                            <SelectItem value="all" className="text-white hover:bg-white/20">All Years</SelectItem>
                            {(() => {
                              const CURRENT_YEAR = 2026;
                              const foundingYear = profileData?.school.yearFounded || 1980;
                              const years: number[] = [];
                              for (let year = CURRENT_YEAR; year >= foundingYear; year--) {
                                years.push(year);
                              }
                              return years.map(year => (
                                <SelectItem key={year} value={year.toString()} className="text-white hover:bg-white/20">
                                  {year}
                                </SelectItem>
                              ));
                            })()}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Search Bar */}
                    <div className="relative max-w-full">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/60 h-4 w-4" />
                      <Input
                        type="text"
                        placeholder="Search alumni by name..."
                        value={alumniSearchTerm}
                        onChange={(e) => setAlumniSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 w-full bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/60"
                        data-testid="input-alumni-search"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Alumni Display */}
              {!user || (!isVerifiedAlumni && !isSchoolOwner) ? (
                <Card className="p-6 md:p-8 text-center space-y-4 bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl text-white">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground text-white" />
                  <div>
                    <p className="text-lg font-medium mb-2">
                      You are not a verified alumni of {school.name}
                    </p>
                    <p className="text-muted-foreground mb-4 text-white">
                      Want to become one?
                    </p>
                    <Button onClick={handleRequestAlumni} data-testid="button-request-alumni-tab" className="bg-blue-700/50 backdrop-blur-lg border border-blue-500/50 shadow-2xl hover:bg-blue-700/60">
                      Request Alumni Status
                    </Button>
                  </div>
                </Card>
              ) : (
                <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
                  <CardContent className="p-6">
                    {isSchoolOwner && (
                      <div className="mb-6 flex justify-end">
                        <Button
                          onClick={() => setLocation("/alumni")}
                          data-testid="button-manage-alumni"
                          className="bg-green-700/50 backdrop-blur-lg border border-green-500/50 shadow-2xl hover:bg-green-700/60"
                        >
                          <Users className="h-4 w-4 mr-2" />
                          Manage Alumni
                        </Button>
                      </div>
                    )}
                    {alumniLoading ? (
                      <div className="space-y-4">
                        {[...Array(6)].map((_, i) => (
                          <Skeleton key={i} className="h-32" />
                        ))}
                      </div>
                    ) : alumni.length === 0 ? (
                      <div className="text-center py-8">
                        <Users className="h-16 w-16 text-white/30 mx-auto mb-4" />
                        <p className="text-white/70">No verified alumni yet</p>
                      </div>
                    ) : (() => {
                      // Filter alumni based on search term and year filters
                      const filteredAlumni = alumni.filter((alum) => {
                        const searchLower = alumniSearchTerm.toLowerCase();
                        const fullName = alum.fullName?.toLowerCase() || '';
                        const graduationYear = alum.graduationYear?.toString() || '';
                        const admissionYear = alum.admissionYear?.toString() || '';
                        
                        // Text search filter
                        const matchesSearch = !alumniSearchTerm || fullName.includes(searchLower);
                        
                        // Did not graduate filter
                        if (showDidNotGraduate) {
                          const isNonGraduate = graduationYear.startsWith("Did not graduate from");
                          if (!isNonGraduate) return false;
                        }
                        
                        // Graduation year filter (only apply if not filtering for non-graduates)
                        const matchesGradYear = showDidNotGraduate || 
                                               alumniGraduationYearFilter === 'all' || 
                                               graduationYear === alumniGraduationYearFilter;
                        
                        // Admission year filter
                        const matchesAdmYear = alumniAdmissionYearFilter === 'all' || 
                                              admissionYear === alumniAdmissionYearFilter;
                        
                        return matchesSearch && matchesGradYear && matchesAdmYear;
                      });

                      // Separate into graduated and non-graduated
                      const graduated = filteredAlumni.filter(alum => 
                        alum.graduationYear && !alum.graduationYear.toString().startsWith("Did not graduate from")
                      );
                      const nonGraduated = filteredAlumni.filter(alum => 
                        alum.graduationYear && alum.graduationYear.toString().startsWith("Did not graduate from")
                      );

                      // Sort graduated alumni by graduation year (most recent first), then by name
                      const sortedGraduated = graduated.sort((a, b) => {
                        const yearA = parseInt(a.graduationYear) || 0;
                        const yearB = parseInt(b.graduationYear) || 0;
                        if (yearA !== yearB) return yearB - yearA; // Most recent first
                        return (a.fullName || '').localeCompare(b.fullName || '');
                      });

                      // Sort non-graduated by name
                      const sortedNonGraduated = nonGraduated.sort((a, b) => 
                        (a.fullName || '').localeCompare(b.fullName || '')
                      );

                      return (
                        <div className="space-y-6">
                          {/* Graduated Alumni Section */}
                          {sortedGraduated.length > 0 && (
                            <div>
                              <h4 className="text-lg font-semibold text-green-400 mb-4 flex items-center">
                                <GraduationCap className="h-5 w-5 mr-2 text-green-400" />
                                Graduated Alumni ({sortedGraduated.length})
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {sortedGraduated.map((alum) => (
                                  <Card key={alum.id} className="bg-green-500/10 backdrop-blur-lg border border-green-400/20 shadow-2xl hover:shadow-lg transition-shadow" data-testid={`alumni-${alum.id}`}>
                                    <CardContent className="p-4">
                                      <div className="flex flex-col space-y-3">
                                        <div className="flex items-center space-x-3">
                                          {alum.profileImage ? (
                                            <img 
                                              src={alum.profileImage} 
                                              alt={alum.fullName}
                                              className="w-12 h-12 rounded-full object-cover"
                                            />
                                          ) : (
                                            <div className="w-12 h-12 bg-green-200 rounded-full flex items-center justify-center">
                                              <UserIcon className="h-6 w-6 text-green-600" />
                                            </div>
                                          )}
                                          <div className="flex-1 min-w-0">
                                            <h4 className="font-semibold text-white text-sm truncate">
                                              {alum.fullName}
                                            </h4>
                                            <p className="text-xs text-green-200">
                                              Class of {alum.graduationYear}
                                            </p>
                                            <p className="text-xs text-green-200">
                                              Admitted: {alum.admissionYear}
                                            </p>
                                          </div>
                                        </div>
                                        
                                        {/* Contact Information */}
                                        <div className="space-y-2 border-t border-green-400/20 pt-3">
                                          <div className="flex items-start space-x-2">
                                            <Mail className="h-4 w-4 text-green-300 mt-0.5 flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                              <p className="text-xs text-green-200 font-medium">Email</p>
                                              {alum.email ? (
                                                <p className="text-sm text-white truncate">{alum.email}</p>
                                              ) : (
                                                <p className="text-sm text-white/40 italic">Not provided</p>
                                              )}
                                            </div>
                                          </div>
                                          
                                          <div className="flex items-start space-x-2">
                                            <Phone className="h-4 w-4 text-green-300 mt-0.5 flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                              <p className="text-xs text-green-200 font-medium">Mobile</p>
                                              {alum.phoneNumber && alum.showPhoneToAlumni !== false ? (
                                                <p className="text-sm text-white">{alum.phoneNumber}</p>
                                              ) : alum.phoneNumber && alum.showPhoneToAlumni === false ? (
                                                <p className="text-sm text-white/40 italic">Hidden</p>
                                              ) : (
                                                <p className="text-sm text-white/40 italic">Not provided</p>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Non-Graduated Alumni Section */}
                          {sortedNonGraduated.length > 0 && (
                            <div>
                              <h4 className="text-lg font-semibold text-blue-400 mb-4 flex items-center">
                                <UserCheck className="h-5 w-5 mr-2 text-blue-400" />
                                Did Not Graduate from {school.name} ({sortedNonGraduated.length})
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {sortedNonGraduated.map((alum) => (
                                  <Card key={alum.id} className="bg-blue-500/10 backdrop-blur-lg border border-blue-400/20 shadow-2xl hover:shadow-lg transition-shadow" data-testid={`alumni-${alum.id}`}>
                                    <CardContent className="p-4">
                                      <div className="flex flex-col space-y-3">
                                        <div className="flex items-center space-x-3">
                                          {alum.profileImage ? (
                                            <img 
                                              src={alum.profileImage} 
                                              alt={alum.fullName}
                                              className="w-12 h-12 rounded-full object-cover"
                                            />
                                          ) : (
                                            <div className="w-12 h-12 bg-blue-200 rounded-full flex items-center justify-center">
                                              <UserIcon className="h-6 w-6 text-blue-600" />
                                            </div>
                                          )}
                                          <div className="flex-1 min-w-0">
                                            <h4 className="font-semibold text-white text-sm truncate">
                                              {alum.fullName}
                                            </h4>
                                            <p className="text-xs text-blue-200">
                                              Did not graduate
                                            </p>
                                            <p className="text-xs text-blue-200">
                                              Admitted: {alum.admissionYear}
                                            </p>
                                          </div>
                                        </div>
                                        
                                        {/* Contact Information */}
                                        <div className="space-y-2 border-t border-blue-400/20 pt-3">
                                          <div className="flex items-start space-x-2">
                                            <Mail className="h-4 w-4 text-blue-300 mt-0.5 flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                              <p className="text-xs text-blue-200 font-medium">Email</p>
                                              {alum.email ? (
                                                <p className="text-sm text-white truncate">{alum.email}</p>
                                              ) : (
                                                <p className="text-sm text-white/40 italic">Not provided</p>
                                              )}
                                            </div>
                                          </div>
                                          
                                          <div className="flex items-start space-x-2">
                                            <Phone className="h-4 w-4 text-blue-300 mt-0.5 flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                              <p className="text-xs text-blue-200 font-medium">Mobile</p>
                                              {alum.phoneNumber && alum.showPhoneToAlumni !== false ? (
                                                <p className="text-sm text-white">{alum.phoneNumber}</p>
                                              ) : alum.phoneNumber && alum.showPhoneToAlumni === false ? (
                                                <p className="text-sm text-white/40 italic">Hidden</p>
                                              ) : (
                                                <p className="text-sm text-white/40 italic">Not provided</p>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* No results message */}
                          {filteredAlumni.length === 0 && alumniSearchTerm && (
                            <p className="text-white/70 text-center py-4">No alumni found matching "{alumniSearchTerm}"</p>
                          )}

                          {/* No results for filters */}
                          {filteredAlumni.length === 0 && !alumniSearchTerm && (
                            <div className="text-center py-8">
                              <Users className="h-16 w-16 text-white/30 mx-auto mb-4" />
                              <h4 className="text-lg font-semibold text-white mb-2">No alumni found</h4>
                              <p className="text-white/70">
                                Try adjusting your filters to see more results.
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
      {/* Buy Badge Slots Dialog */}
      {showBuySlotsDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-96 bg-white">
            <CardContent className="p-6">
              <h3 className="text-xl font-bold mb-4">Buy Badge Slots</h3>
              <div className="space-y-4">
                <div>
                  <Label>Number of slots</Label>
                  <Input
                    type="number"
                    min="1"
                    value={slotsToBuy}
                    onChange={(e) => setSlotsToBuy(parseInt(e.target.value) || 1)}
                    data-testid="input-slots-number"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Total: {formatPrice(convertPrice(BADGE_SLOT_PRICE * slotsToBuy))}
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={() => addBadgeSlotsToCartMutation.mutate(slotsToBuy)}
                    className="flex-1"
                    data-testid="button-add-slots-to-cart"
                  >
                    Add to Cart
                  </Button>
                  <Button
                    onClick={() => setShowBuySlotsDialog(false)}
                    variant="outline"
                    data-testid="button-cancel-buy-slots"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      {/* Memory Lightbox Modal */}
      <Dialog open={selectedMemoryIndex !== null} onOpenChange={() => setSelectedMemoryIndex(null)}>
        <DialogContent className="max-w-4xl p-0 bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
          {selectedMemoryIndex !== null && allMemories[selectedMemoryIndex] && (
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 z-10 text-white hover:bg-white/20"
                onClick={() => setSelectedMemoryIndex(null)}
                data-testid="button-close-lightbox"
              >
                <X className="h-4 w-4" />
              </Button>
              {selectedMemoryIndex > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20"
                  onClick={handlePrevImage}
                  data-testid="button-prev-image"
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
              )}
              {selectedMemoryIndex < allMemories.length - 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20"
                  onClick={handleNextImage}
                  data-testid="button-next-image"
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              )}
              {zoom > 1 && (
                <div className="absolute top-2 left-2 z-10 flex items-center gap-2">
                  <span className="bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    className="bg-black/60 text-white text-xs px-2 py-1 rounded-full hover:bg-black/80"
                    onClick={() => { setZoom(1); setPanX(0); setPanY(0); }}
                  >
                    Reset
                  </button>
                </div>
              )}
              <div 
                className="overflow-hidden relative select-none"
                style={{ cursor: zoom > 1 ? (mousePanStart ? 'grabbing' : 'grab') : 'zoom-in' }}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                onWheel={onWheel}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
                onDoubleClick={onDoubleClick}
              >
                <div 
                  className="flex"
                  style={{
                    transform: zoom === 1 ? `translateX(calc(-${selectedMemoryIndex * 100}% + ${isDragging ? dragOffset : 0}px))` : `translateX(-${selectedMemoryIndex * 100}%)`,
                    transition: isDragging || zoom > 1 ? 'none' : 'transform 0.3s ease-out'
                  }}
                >
                  {allMemories.map((memory, index) => (
                    <div
                      key={memory.id}
                      className="w-full flex-shrink-0"
                      style={{ width: '100%' }}
                    >
                      <img
                        src={getPublicMemoryUrl(memory.imageUrl) || ''}
                        alt={memory.title}
                        className="w-full h-auto max-h-[80vh] object-contain select-none"
                        draggable={false}
                        style={index === selectedMemoryIndex ? {
                          transform: `scale(${zoom}) translate(${panX}px, ${panY}px)`,
                          transition: mousePanStart || touchPanStart ? 'none' : 'transform 0.15s ease-out',
                          transformOrigin: 'center center',
                        } : undefined}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-5 bg-gradient-to-t from-black/50 to-transparent border-t border-white/10">
                <h3 className="font-bold text-xl text-white leading-tight tracking-tight">
                  {allMemories[selectedMemoryIndex].title}
                </h3>
                {allMemories[selectedMemoryIndex].description && (
                  <p className="text-sm text-white/70 mt-2 leading-relaxed">
                    {allMemories[selectedMemoryIndex].description}
                  </p>
                )}
                <div className="h-px bg-white/10 my-3" />
                <div className="flex flex-wrap items-center gap-3">
                  {allMemories[selectedMemoryIndex].eventDate && (
                    <div className="flex items-center gap-1.5 text-white/60 text-xs">
                      <Calendar className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                      <span>{allMemories[selectedMemoryIndex].eventDate}</span>
                    </div>
                  )}
                  {allMemories[selectedMemoryIndex].category && (
                    <span className="px-2.5 py-0.5 rounded-full bg-purple-500/25 border border-purple-400/30 text-purple-200 text-xs font-medium capitalize">
                      {allMemories[selectedMemoryIndex].category.replace(/_/g, ' ')}
                    </span>
                  )}
                  {allMemories[selectedMemoryIndex].uploadedBy && (
                    <div className="flex items-center gap-1.5 ml-auto">
                      <UserIcon className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />
                      <span className="text-xs text-white/50">Uploaded by</span>
                      <span className="text-xs font-semibold text-white/90">{allMemories[selectedMemoryIndex].uploadedBy}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Cart Popup */}
      {showCartPopup && selectedYearForCart && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl rounded-lg w-full max-w-md p-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-white mb-2">
                {school.name} - {selectedYearForCart.year} Academic Yearbook
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
      {/* Login Dialog for non-authenticated users */}
      <LoginDialog 
        open={showLoginDialog} 
        onOpenChange={setShowLoginDialog}
        redirectContext={loginRedirectContext}
      />
      {/* Alumni Request Dialog */}
      <AlumniRequestDialog
        open={showAlumniRequestDialog}
        onClose={() => setShowAlumniRequestDialog(false)}
        initialSchoolId={profileData?.school.id}
      />
    </div>
  );
}
