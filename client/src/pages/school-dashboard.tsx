import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "../lib/queryClient";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Textarea } from "../components/ui/textarea";
import { Switch } from "../components/ui/switch";
import { Checkbox } from "../components/ui/checkbox";
import { 
  GraduationCap, 
  LogOut, 
  UserPlus, 
  Users, 
  User as UserIcon,
  Calendar, 
  ShoppingCart, 
  Upload, 
  Images, 
  Edit, 
  Trash2,
  Eye,
  UserCheck,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Loader2,
  Settings,
  Grid3X3,
  List,
  Menu,
  DollarSign,
  Home,
  FileImage,
  FileVideo,
  AlertCircle,
  Bell,
  X
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { User, School, Memory, AlumniRequest, AlumniBadge, Notification } from "@shared/schema";
import { useToast } from "../hooks/use-toast";
import { YearbookConfigDialog } from "../components/YearbookConfigDialog";
import { CURRENT_YEAR, SCHOOL_YEAR_PRICE } from "@shared/constants";
import { useCurrency } from "@/contexts/CurrencyContext";
import appLogo from "@assets/logo_background_null.png";

export default function SchoolDashboard() {
  const [, setLocation] = useLocation();
  const [previewMemory, setPreviewMemory] = useState<Memory | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState("profile");
  const [yearViewMode, setYearViewMode] = useState<'grid' | 'list'>('grid');
  
  // Check for tab parameter in URL on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    if (tab && ['years', 'memories', 'viewers', 'profile'].includes(tab)) {
      setActiveTab(tab);
    }
  }, []);
  const [showAddViewer, setShowAddViewer] = useState(false);
  const [yearSearchTerm, setYearSearchTerm] = useState(""); // Added search state
  const [alumniSearchTerm, setAlumniSearchTerm] = useState(""); // Alumni search state
  const [alumniGraduationYearFilter, setAlumniGraduationYearFilter] = useState<string>("all"); // Graduation year filter
  const [alumniAdmissionYearFilter, setAlumniAdmissionYearFilter] = useState<string>("all"); // Admission year filter
  const [showDidNotGraduate, setShowDidNotGraduate] = useState(false); // Did not graduate filter checkbox
  const [selectedRequest, setSelectedRequest] = useState<AlumniRequest | null>(null);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [showPurchaseOverlay, setShowPurchaseOverlay] = useState(false);
  const [editableSchoolData, setEditableSchoolData] = useState({ email: "", city: "" });
  const [isEditingSchool, setIsEditingSchool] = useState(false);
  
  // Hamburger menu and notification state
  const [showHamburgerMenu, setShowHamburgerMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [selectedYearForPurchase, setSelectedYearForPurchase] = useState<string>("");
  const [schoolProfileForm, setSchoolProfileForm] = useState({
    address: "",
    state: ""
  });
  const { toast } = useToast();
  const { convertPrice, formatPrice } = useCurrency();


  // Form states
  const [newViewer, setNewViewer] = useState({ username: "", password: "", fullName: "" });
  const [selectedYear, setSelectedYear] = useState("2024");

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) {
      setLocation("/");
      return;
    }
    const parsedUser = JSON.parse(userData);
    
    // Verify this is a school admin account, not a viewer account  
    if (parsedUser.userType !== "school") {
      console.log("Non-school account detected in school dashboard, redirecting to correct dashboard");
      localStorage.removeItem("user"); // Clear the session
      setLocation("/");
      return;
    }
    setUser(parsedUser);
  }, [setLocation]);

  const currentYear = CURRENT_YEAR;

  // Fetch pricing configuration from API
  const { data: priceConfig } = useQuery<{ schoolYearPrice: number; viewerYearPrice: number; badgeSlotPrice: number }>({
    queryKey: ["/api/config/prices"],
  });

  // Fetch school info to get founding year (moved before alumni queries)
  const { data: school } = useQuery<School>({
    queryKey: ["/api/schools", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user?.id) throw new Error("No user");
      const res = await fetch(`/api/schools/${user.id}`);
      if (!res.ok) throw new Error("Failed to fetch school");
      return res.json();
    },
  });

  // Fetch pending memories for approval
  const { data: pendingMemories = [] } = useQuery<Memory[]>({
    queryKey: ["/api/memories/pending", school?.id],
    enabled: !!school?.id,
    queryFn: async () => {
      if (!school?.id) return [];
      const res = await fetch(`/api/memories/school/${school.id}/pending`, {
        headers: {
          'Authorization': `Bearer ${user?.id}`
        }
      });
      if (!res.ok) throw new Error("Failed to fetch pending memories");
      return res.json();
    },
  });

  // Fetch alumni requests for this school (moved after school query)
  const { data: allRequests = [] } = useQuery<AlumniRequest[]>({
    queryKey: ["/api/alumni-requests", school?.id],
    enabled: !!school?.id,
    queryFn: async () => {
      if (!school?.id) return [];
      const res = await fetch(`/api/alumni-requests/school/${school.id}`);
      if (!res.ok) throw new Error("Failed to fetch alumni requests");
      return res.json();
    },
    refetchInterval: 10000, // Refetch every 10 seconds for near real-time updates
  });

  // Filter only pending requests
  const pendingRequests = allRequests.filter(request => request.status === 'pending');

  // Fetch pending alumni request count for notification badge
  const { data: requestCountData } = useQuery<{ pendingCount: number }>({
    queryKey: ["/api/alumni-requests/count", school?.id],
    enabled: !!school?.id,
    queryFn: async () => {
      if (!school?.id) return { pendingCount: 0 };
      const res = await fetch(`/api/alumni-requests/school/${school.id}/count`);
      if (!res.ok) throw new Error("Failed to fetch request count");
      return res.json();
    },
    refetchInterval: 10000, // Refetch every 10 seconds for near real-time updates
  });

  const pendingRequestCount = requestCountData?.pendingCount || 0;

  // Fetch notifications for this school
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

  const unreadNotificationCount = notifications.filter(n => !n.isRead).length;

  // Memory approval mutations
  const approveMemoryMutation = useMutation({
    mutationFn: async (memoryId: string) => {
      const response = await fetch(`/api/memories/${memoryId}/approve`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${user?.id}`
        },
        body: JSON.stringify({
          approvedBy: user?.id
        })
      });
      if (!response.ok) throw new Error("Failed to approve memory");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/memories/pending", school?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/memories/school"] });
      toast({ title: "Memory approved successfully" });
    },
  });

  const denyMemoryMutation = useMutation({
    mutationFn: async (memoryId: string) => {
      const response = await fetch(`/api/memories/${memoryId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${user?.id}`
        }
      });
      if (!response.ok) throw new Error("Failed to deny memory");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/memories/pending", school?.id] });
      toast({ title: "Memory denied and removed" });
    },
  });

  // Alumni request mutations (moved after school query)
  const approveAlumniRequestMutation = useMutation({
    mutationFn: async ({ requestId, reviewNotes }: { requestId: string; reviewNotes?: string }) => {
      await apiRequest("PATCH", `/api/alumni-requests/${requestId}/approve`, {
        reviewedBy: user?.id,
        reviewNotes
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alumni-requests", school?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/alumni-requests/count", school?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/alumni-badges/school", school?.id] });
      toast({
        className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Alumni request approved successfully" });
    },
  });

  const denyAlumniRequestMutation = useMutation({
    mutationFn: async ({ requestId, reviewNotes }: { requestId: string; reviewNotes?: string }) => {
      await apiRequest("PATCH", `/api/alumni-requests/${requestId}/deny`, {
        reviewedBy: user?.id,
        reviewNotes
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alumni-requests", school?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/alumni-requests/count", school?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/alumni-badges/school", school?.id] });
      toast({ title: "Alumni request denied successfully" });
    },
  });

  // Notification mutations
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

  const clearAllNotificationsMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) return;
      await apiRequest("DELETE", `/api/notifications/user/${user.id}/clear-all`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications", user?.id] });
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

  // Helper function to format relative time (e.g., "2 hours ago", "3 days ago")
  const formatRelativeTime = (date: Date | null | undefined): string => {
    if (!date) return '';
    
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffSeconds < 60) {
      return 'Just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 30) {
      return `${diffDays} days ago`;
    } else {
      return new Date(date).toLocaleDateString();
    }
  };

  // Mock data for demonstration 
const mockMemories = [
  { id: "1", title: "Graduation Day", eventDate: "June 2024", year: "2024", category: "graduation" },
    { id: "2", title: "Science Fair", eventDate: "March 2024", year: "2024", category: "academic" },
    { id: "3", title: "Sports Day", eventDate: "February 2024", year: "2024", category: "sports" },
    { id: "4", title: "Art Exhibition", eventDate: "November 2023", year: "2023", category: "arts" }
  ];
//years here remember to add more down to 2000 and also add a search bar to search for a specific year

  // Fetch purchased years for this school
  const { data: purchasedYears = [], isLoading: isPurchaseDataLoading } = useQuery({
    queryKey: ["/api/year-purchases", school?.id],
    enabled: !!school,
    queryFn: async () => {
      if (!user?.id) return [];
      const res = await fetch(`/api/year-purchases/school/${school?.id}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch all yearbooks for this school to get isFree status and prices
  const { data: schoolYearbooks = [] } = useQuery({
    queryKey: ["/api/yearbooks-all", school?.id],
    enabled: !!school,
    queryFn: async () => {
      if (!school?.id) return [];
      const res = await fetch(`/api/yearbooks/${school.id}/all`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Generate years from school's founding year to current year (2026)
  // Only generate years if we have school data AND purchase data has finished loading
  const mockYears = !school || isPurchaseDataLoading ? [] : (() => {
    const schoolFoundingYear = school?.yearFounded;
    // Use the actual founding year, with minimum of 1980 if school was founded before 1980
    const startYear = (schoolFoundingYear && schoolFoundingYear < 1980) ? 1980 : (schoolFoundingYear || 1980);
    // Show years up to current year
    const endYear = currentYear;
    
    return Array.from({ length: endYear - startYear + 1 }, (_, i) => {
      const year = endYear - i; // Generate in descending order
      
      // Skip years before the school was founded or after current year
      if (year < startYear || year > endYear) return null;
    
    // Check if this year has been purchased
    const yearPurchase = purchasedYears.find((p: any) => p.year === year);
    const purchased = !!yearPurchase?.purchased;
    
    // Check if this year's yearbook is free
    const yearbook = schoolYearbooks.find((yb: any) => yb.year === year);
    const isFree = yearbook?.isFree || false;
    const priceExplicitlySet = yearbook?.price != null; // Check if price was explicitly set
    // Only use yearbook price if explicitly set, otherwise use system default for non-purchased years
    const yearbookPrice = yearbook?.price ?? (priceConfig?.schoolYearPrice ?? SCHOOL_YEAR_PRICE);
    
    let status;
    if (purchased) {
      status = year === currentYear ? "Active" : "Archived"; // Current year is active
    } else {
      status = "Available";
    }
    
      return { 
        year: year.toString(), 
        purchased, 
        status, 
        price: yearbookPrice, // Use actual yearbook price or fallback
        priceExplicitlySet, // Track if price was explicitly set
        isFree 
      };
    }).filter(Boolean); // Remove null entries
  })();

  // Filter years based on search term
  const filteredYears = mockYears.filter((year: any) => 
    year && year.year.includes(yearSearchTerm)
  );

  console.log(mockYears);

  //gpt coded part end

  // Fetch alumni badges for this school (only verified alumni)
  const { data: allAlumniBadges = [] } = useQuery<AlumniBadge[]>({
    queryKey: ["/api/alumni-badges/school", school?.id],
    enabled: !!school?.id,
    queryFn: async () => {
      if (!school?.id) return [];
      const res = await fetch(`/api/alumni-badges/school/${school.id}`);
      if (!res.ok) throw new Error("Failed to fetch alumni badges");
      return res.json();
    },
  });

  // Filter to only show verified alumni in the current alumni list
  const alumniBadges = allAlumniBadges.filter(badge => badge.status === 'verified');

  // Update school profile mutation
  const updateSchoolProfileMutation = useMutation({
    mutationFn: async (updates: { address?: string; state?: string }) => {
      await apiRequest("PATCH", `/api/schools/${user?.id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schools", user?.id] });
      toast({ title: "Profile updated successfully" });
      setSchoolProfileForm({ address: "", state: "" });
    },
    onError: () => {
      toast({ title: "Failed to update profile", variant: "destructive" });
    },
  });

  // Delete alumni badge mutation
  const deleteAlumniBadgeMutation = useMutation({
    mutationFn: async (badgeId: string) => {
      await apiRequest("DELETE", `/api/alumni-badges/${badgeId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alumni-badges/school", school?.id] });
      toast({ title: "Alumni badge deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete alumni badge", variant: "destructive" });
    },
  });

  const handleLogout = () => {
    localStorage.removeItem("user");
    window.dispatchEvent(new Event('userChanged'));
    setLocation("/home");
  };



  const handleAddViewer = () => {
    // In real implementation, this would make API call
    console.log("Adding viewer:", newViewer);
    setNewViewer({ username: "", password: "", fullName: "" });
    setShowAddViewer(false);
  };

  const handleApproveRequest = (requestId: string) => {
    approveAlumniRequestMutation.mutate({ requestId });
  };

  const handleDenyRequest = (requestId: string) => {
    denyAlumniRequestMutation.mutate({ requestId });
  };

  const handleViewRequest = (request: AlumniRequest) => {
    setSelectedRequest(request);
    setShowRequestDialog(true);
  };


  const handleBuyYear = (year: string) => {
    setSelectedYearForPurchase(year);
    setShowPurchaseOverlay(true);
  };

  const handleEditSchoolInfo = () => {
    setEditableSchoolData({
      email: school?.email || "",
      city: school?.city || ""
    });
    setIsEditingSchool(true);
  };

  const handleSaveSchoolInfo = async () => {
    try {
      // Use the school ID from the school data, not the user ID
      const schoolId = school?.id;
      if (!schoolId) {
        toast({
          title: "Error",
          description: "School information not found.",
          variant: "destructive",
        });
        return;
      }
      
      await apiRequest("PATCH", `/api/schools/${schoolId}`, editableSchoolData);
      queryClient.invalidateQueries({ queryKey: ["/api/schools", user?.id] });
      setIsEditingSchool(false);
      toast({
        title: "School information updated",
        description: "Changes have been saved successfully.",
      });
    } catch (error) {
      toast({
        title: "Update failed",
        description: "Could not save changes. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleManageYear = (year: string) => {
    // Navigate to yearbook management page for purchased year
    setLocation(`/yearbook-manage/${year}?school=${school?.id}`);
  };



  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 relative overflow-hidden">
      {/* Main Animated Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-20 left-20 w-32 h-32 bg-white rounded-full opacity-5 animate-float"></div>
          <div className="absolute top-60 right-40 w-24 h-24 bg-white rounded-full opacity-5 animate-float-delayed"></div>
          <div className="absolute bottom-40 left-40 w-20 h-20 bg-white rounded-full opacity-5 animate-float"></div>
          <div className="absolute bottom-20 right-20 w-16 h-16 bg-white rounded-full opacity-5 animate-float-delayed"></div>
        </div>
      </div>
      
      {/* Main Content Container */}
      <div className="relative z-10 min-h-screen bg-white/5 backdrop-blur-sm">
      {/* Header with Liquid Glass Theme */}
      <header className="bg-white/10 backdrop-blur-lg border-b border-white/20 shadow-2xl relative overflow-hidden">
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
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                <img 
                  src={appLogo} 
                  alt="App Logo" 
                  className="w-full h-full object-contain"
                />
              </div>
              <h1 className="ml-2 sm:ml-3 text-sm sm:text-xl font-semibold text-white truncate">ADMINISTRATOR PORTAL</h1>
            </div>

            <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0">
              <span className="text-xs sm:text-sm font-medium text-white">
                <span className="sm:hidden truncate max-w-20">{school?.name.split(" ")[0]}</span>
                <span className="hidden sm:inline">{school?.name}</span>
              </span>
              
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
              
              {/* NEW SIMPLE HAMBURGER MENU */}
              <div className="relative">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowHamburgerMenu(!showHamburgerMenu)}
                  className="text-white hover:bg-white/20 p-2 bg-white/10 rounded-lg border border-white/20"
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
        <div className="notification-dropdown fixed top-16 right-16 w-72 sm:w-80 max-w-[calc(100vw-2rem)] bg-blue-800/90 backdrop-blur-lg rounded-lg shadow-xl border border-white/20 z-[999999]">
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
                setLocation("/");
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
                setLocation("/school-settings");
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
            <div className="border-t border-gray-100"></div>
            <button
              className="flex items-center w-full px-4 py-2 text-sm text-red-500 hover:bg-red-500/40 transition-colors"
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

      {/* Navigation Tabs - Modern design matching viewer dashboard */}
      <div className="bg-white/10 backdrop-blur-lg border-b border-white/20 shadow-lg">
        <div className="mx-auto px-2 sm:px-4 lg:px-8 xl:px-12 2xl:px-16">
          <div className="flex justify-center sm:justify-start gap-2 sm:gap-3 py-4 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setActiveTab("profile")}
              className={`px-4 sm:px-6 py-3 text-sm font-medium rounded-xl flex items-center space-x-2 whitespace-nowrap transition-all duration-300 transform min-w-fit ${
                activeTab === "profile" 
                  ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg scale-105 shadow-indigo-500/25" 
                  : "bg-white/10 text-blue-100 hover:bg-white/20 hover:text-white hover:scale-102"
              }`}
              data-testid="tab-profile"
            >
              <UserIcon className="h-4 w-4 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">Profile</span>
            </button>
            <button
              onClick={() => setActiveTab("years")}
              className={`px-4 sm:px-6 py-3 text-sm font-medium rounded-xl flex items-center space-x-2 whitespace-nowrap transition-all duration-300 transform min-w-fit ${
                activeTab === "years" 
                  ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg scale-105 shadow-purple-500/25" 
                  : "bg-white/10 text-blue-100 hover:bg-white/20 hover:text-white hover:scale-102"
              }`}
              data-testid="tab-years"
            >
              <Calendar className="h-4 w-4 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">Years</span>
            </button>
            <button
              onClick={() => setActiveTab("memories")}
              className={`px-4 sm:px-6 py-3 text-sm font-medium rounded-xl flex items-center space-x-2 whitespace-nowrap transition-all duration-300 transform min-w-fit relative ${
                activeTab === "memories" 
                  ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg scale-105 shadow-orange-500/25" 
                  : "bg-white/10 text-blue-100 hover:bg-white/20 hover:text-white hover:scale-102"
              }`}
              data-testid="tab-memories"
            >
              <Images className="h-4 w-4 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">Photos</span>
              {/* Red notification badge for pending memories */}
              {pendingMemories.length > 0 && (
                <span 
                  className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center shadow-lg ring-2 ring-red-200 dark:ring-red-800 transition-all duration-200 ease-out"
                  data-testid="notification-badge-pending-memories"
                >
                  {pendingMemories.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("viewers")}
              className={`px-4 sm:px-6 py-3 text-sm font-medium rounded-xl flex items-center space-x-2 whitespace-nowrap transition-all duration-300 transform min-w-fit relative ${
                activeTab === "viewers" 
                  ? "bg-gradient-to-r from-green-500 to-teal-500 text-white shadow-lg scale-105 shadow-green-500/25" 
                  : "bg-white/10 text-blue-100 hover:bg-white/20 hover:text-white hover:scale-102"
              }`}
              data-testid="tab-viewers"
            >
              <UserCheck className="h-4 w-4 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">Alumni</span>
              {/* Red notification badge for alumni requests */}
              {pendingRequestCount > 0 && (
                <span 
                  className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center shadow-lg ring-2 ring-red-200 dark:ring-red-800 transition-all duration-200 ease-out"
                  data-testid="notification-badge-pending-requests"
                >
                  {pendingRequestCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto px-2 sm:px-4 lg:px-8 xl:px-12 2xl:px-16 py-4 sm:py-8">


        {/* Year Management Tab */}
        {activeTab === "years" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-white">Year Management</h2>
            </div>

            {/* Search Bar */}
            <div className="mb-6">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/60 h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Search years"
                  value={yearSearchTerm}
                  onChange={(e) => setYearSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/60"
                />
              </div>
            </div>

            <Card className="bg-white/10 backdrop-blur-lg border border-white/20">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-white">
                  <span>Available Years</span>
                  <div className="flex items-center space-x-4">
                    <span className="text-sm text-blue-200">{filteredYears.length} years available</span>
                    {/* View Mode Toggle */}
                    <div className="flex items-center bg-white/10 backdrop-blur-lg border border-white/20 rounded-lg p-1">
                      <button
                        onClick={() => setYearViewMode('grid')}
                        className={`p-1.5 rounded ${yearViewMode === 'grid' ? 'bg-white/30 shadow-sm text-blue-300' : 'text-white/70 hover:text-white'}`}
                        title="Grid View"
                      >
                        <Grid3X3 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setYearViewMode('list')}
                        className={`p-1.5 rounded ${yearViewMode === 'list' ? 'bg-white/30 shadow-sm text-blue-300' : 'text-white/70 hover:text-white'}`}
                        title="List View"
                      >
                        <List className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isPurchaseDataLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="flex items-center space-x-3">
                      <Loader2 className="h-6 w-6 animate-spin text-white" />
                      <span className="text-white">Loading purchase status...</span>
                    </div>
                  </div>
                ) : yearViewMode === 'grid' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredYears.map((year) => year && (
                      <div key={`year-${year.year}`} className="bg-white/5 backdrop-blur border border-white/20 rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold text-white">{year.year}</h3>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            year.status === "Active" 
                              ? "bg-green-100 text-green-800" 
                              : year.status === "Archived"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-800"
                          }`}>
                            {year.status}
                          </span>
                        </div>

                        {/* Show pricing info */}
                        {year.purchased && (
                          <div className="text-sm text-blue-200">
                            Price: <span className="font-semibold">{year.priceExplicitlySet ? formatPrice(convertPrice(year.price)) : 'Not set'}</span>
                            {year.isFree && <span className="ml-1 text-green-400">(free)</span>}
                          </div>
                        )}

                        <div className="flex space-x-2 ">
                          {isPurchaseDataLoading ? (
                            <Button 
                              className="flex-1 text-white border-gray-400 bg-gray-600/20"
                              size="sm" 
                              variant="outline" 
                              disabled
                              data-testid={`button-loading-year-${year.year}`}
                            >
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              Loading...
                            </Button>
                          ) : year.purchased ? (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => handleManageYear(year.year)}
                              className="flex-1 text-white border-blue-400 bg-blue-600/20 hover:bg-blue-600/30 transition-colors hover:text-white"
                              data-testid={`button-manage-year-${year.year}`}
                            >
                              <Settings className="h-4 w-4 mr-1 text-white" />
                              Manage
                            </Button>
                          ) : (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleBuyYear(year.year)}
                              className="flex-1 text-white border-green-400 bg-green-600/20 hover:bg-green-600/30 transition-colors hover:text-white"
                              data-testid={`button-buy-year-${year.year}`}
                            >
                              <ShoppingCart className="h-4 w-4 mr-1" />
                              Buy {formatPrice(convertPrice(year.price))}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredYears.map((year) => year && (
                      <div key={`year-${year.year}`} className="flex items-center justify-between p-4 bg-white/5 backdrop-blur border border-white/20 rounded-lg hover:bg-white/10 transition-colors">
                        <div className="flex items-center space-x-4">
                          <div className="flex-shrink-0">
                            <span className="text-xl font-bold text-white">{year.year}</span>
                          </div>
                          <div className="flex items-center space-x-3">
                            <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                              year.status === "Active" 
                                ? "bg-green-100 text-green-800" 
                                : year.status === "Archived"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-gray-100 text-gray-800"
                            }`}>
                              {year.status}
                            </span>
                            {/* Show pricing info for purchased years */}
                            {year.purchased && (
                              <span className="text-sm text-blue-200">
                                {year.priceExplicitlySet ? formatPrice(convertPrice(year.price)) : 'Not set'}
                                {year.isFree && <span className="ml-1 text-green-400">(free)</span>}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex-shrink-0 ">
                          {isPurchaseDataLoading ? (
                            <Button 
                              className="flex-1 text-white border-gray-400 bg-gray-600/20"
                              size="sm" 
                              variant="outline" 
                              disabled
                              data-testid={`button-loading-year-${year.year}`}
                            >
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Loading...
                            </Button>
                          ) : year.purchased ? (
                            <Button 
                               className="flex-1 text-white border-blue-400 bg-blue-600/20 hover:bg-blue-600/30 transition-colors hover:text-white"
                              size="sm" 
                              variant="outline" 
                              onClick={() => handleManageYear(year.year)}
                              data-testid={`button-manage-year-${year.year}`}
                            >
                              <Settings className="h-4 w-4 mr-2" />
                              Manage
                            </Button>
                          ) : (
                            <Button 
                              variant="outline"
                              className="flex-1 text-white border-green-400 bg-green-600/20 hover:bg-green-600/30 transition-colors hover:text-white"
                              size="sm" 
                              onClick={() => handleBuyYear(year.year)}
                              data-testid={`button-buy-year-${year.year}`}
                            >
                              <ShoppingCart className="h-4 w-4 mr-2" />
                              Buy {formatPrice(convertPrice(year.price))}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* No results message */}
                {filteredYears.length === 0 && yearSearchTerm && (
                  <div className="text-center py-8">
                    <p className="text-white/70">No years found matching "{yearSearchTerm}"</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Photos & Memories Tab */}
        {activeTab === "memories" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-white">Photos & Memories</h2>
              {pendingMemories.length > 0 && (
                <div className="bg-orange-500/20 text-orange-200 px-3 py-1 rounded-full text-sm">
                  {pendingMemories.length} pending approval
                </div>
              )}
            </div>


            {/* Search Bar */}
            <div className="mb-6">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/60 h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Search years"
                  value={yearSearchTerm}
                  onChange={(e) => setYearSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/60"
                />
              </div>
            </div>

            <Card className="bg-white/10 backdrop-blur-lg border border-white/20">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-white">
                  <span>Available Years</span>
                  <span className="text-sm font-normal text-blue-200">Storage for all years</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isPurchaseDataLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="flex items-center space-x-3">
                      <Loader2 className="h-6 w-6 animate-spin text-white" />
                      <span className="text-white">Loading years...</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredYears.map((year) => {
                    if (!year) return null;
                    return (
                    <div key={year.year || 'unknown'} className="flex items-center justify-between p-4 bg-white/5 backdrop-blur border border-white/20 rounded-lg hover:bg-white/10">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <div className="flex flex-col">
                            <h3 className="text-lg font-medium text-white">Year {year.year || 'Unknown'}</h3>
                            <p className="text-sm text-blue-200">
                              Photos & memories
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="text-right">
                          
                          <p className="text-xs text-blue-200">Storage</p>
                        </div>
                        <div className="relative">
                          <Button 
                            variant="outline"
                            onClick={() => setLocation(`/photos-memories-manage?year=${year.year || 'unknown'}&school=${school?.id}`)}
                            data-testid={`button-manage-memories-${year.year || 'unknown'}`} className="text-sm text-white border-white bg-black/20 hover:bg-blue-300/20 transition-colors hover:text-blue-600 border-white/20"
                          >
                            <Settings className="h-4 w-4 mr-1 text-white-100" />
                            
                            Manage
                          </Button>
                          {/* Notification badge for pending memories per year */}
                          {(() => {
                            const yearPendingCount = pendingMemories.filter(memory => memory.year?.toString() === year.year?.toString()).length;
                            return yearPendingCount > 0 ? (
                              <span 
                                className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center shadow-lg ring-2 ring-red-200 dark:ring-red-800 transition-all duration-200 ease-out"
                                data-testid={`notification-badge-pending-memories-year-${year.year}`}
                              >
                                {yearPendingCount}
                              </span>
                            ) : null;
                          })()}
                        </div>
                      </div>
                    </div>
                    )
                  }).filter(Boolean)}
                  </div>
                )}

                {/* No results message */}
                {filteredYears.length === 0 && yearSearchTerm && (
                  <div className="text-center py-8">
                    <p className="text-white/70">No years found matching "{yearSearchTerm}"</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

{/* Alumni Authentication Tab */}
        {activeTab === "viewers" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-white">Alumni Authentication</h2>      
            </div>

            {/* Pending Alumni Upgrade Requests */}
            {pendingRequests.length > 0 && (
              <Card className="bg-white/10 backdrop-blur-lg border border-white/20">
                <CardHeader>
                  <CardTitle className="flex items-center text-white">
                    <Clock className="h-5 w-5 mr-2 text-orange-500" />
                    Pending Alumni Upgrade Requests ({pendingRequests.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {pendingRequests.map((request) => (
                      <div key={request.id} className="flex items-center justify-between p-4 bg-orange-500/30 backdrop-blur-lg border border-orange-400 shadow-2xl transition-all hover:text-orange-400 rounded-lg">
                        <div>
                          <h4 className="font-medium text-orange-100 ">{request.fullName}</h4>
                          <p className="text-sm text-orange-100">Requested on {new Date(request.createdAt || "").toLocaleDateString()}</p>
                          <p className="text-xs text-orange-500">Status: {request.status}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleViewRequest(request)}
                            className="bg-blue-500/40 backdrop-blur-lg border hover:bg-blue-500/50 text-blue-200 border-blue-200 hover:text-blue-100"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={() => handleApproveRequest(request.id)}
                            disabled={approveAlumniRequestMutation.isPending}
                            className="bg-green-500/40 backdrop-blur-lg border hover:bg-green-500/50 text-green-400 border-green-200 hover:text-green-100"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleDenyRequest(request.id)}
                            disabled={denyAlumniRequestMutation.isPending}
                            className="bg-red-500/40 backdrop-blur-lg border hover:bg-red-500/50 text-red-200 border-red-200 hover:text-red-100"
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Deny
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {showAddViewer && (
              <Card className="bg-white/10 backdrop-blur-lg border border-white/20">
                <CardHeader>
                  <CardTitle className="text-white">Add New Viewer Account</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="viewerFullName" className="text-white">Full Name</Label>
                      <Input
                        id="viewerFullName"
                        value={newViewer.fullName}
                        onChange={(e) => setNewViewer({...newViewer, fullName: e.target.value})}
                        placeholder="Viewer's full name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="viewerUsername" className="text-white">Username</Label>
                      <Input
                        id="viewerUsername"
                        value={newViewer.username}
                        onChange={(e) => setNewViewer({...newViewer, username: e.target.value})}
                        placeholder="Login username"
                      />
                    </div>
                    <div>
                      <Label htmlFor="viewerPassword" className="text-white">Password</Label>
                      <Input
                        id="viewerPassword"
                        type="password"
                        value={newViewer.password}
                        onChange={(e) => setNewViewer({...newViewer, password: e.target.value})}
                        placeholder="Login password"
                      />
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button onClick={handleAddViewer}>Add Viewer</Button>
                    <Button variant="outline" onClick={() => setShowAddViewer(false)}>Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="bg-white/10 backdrop-blur-lg border border-white/20">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-white">
                  <span>Current Alumni Accounts</span>
                  <span className="text-sm text-blue-200">{alumniBadges.length} total</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Filter Controls */}
                <div className="mb-6 space-y-4">
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
                            const foundingYear = school?.yearFounded || 1980;
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
                            const foundingYear = school?.yearFounded || 1980;
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

                {(() => {
                  if (alumniBadges.length === 0) {
                    return <p className="text-blue-200 text-center py-4">No alumni accounts found</p>;
                  }

                  // Filter alumni based on search term and year filters
                  const filteredAlumni = alumniBadges.filter((badge) => {
                    const searchLower = alumniSearchTerm.toLowerCase();
                    const fullName = badge.fullName?.toLowerCase() || '';
                    const graduationYear = badge.graduationYear?.toString() || '';
                    const admissionYear = badge.admissionYear?.toString() || '';
                    
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
                  const graduated = filteredAlumni.filter(badge => 
                    badge.graduationYear && badge.graduationYear !== "Did not graduate from " + badge.school
                  );
                  const nonGraduated = filteredAlumni.filter(badge => 
                    badge.graduationYear && badge.graduationYear.startsWith("Did not graduate from")
                  );

                  // Sort graduated alumni by graduation year (most recent first), then by school name
                  const sortedGraduated = graduated.sort((a, b) => {
                    const yearA = parseInt(a.graduationYear) || 0;
                    const yearB = parseInt(b.graduationYear) || 0;
                    if (yearA !== yearB) return yearB - yearA; // Most recent first
                    return (a.school || '').localeCompare(b.school || '');
                  });

                  // Sort non-graduated by school name
                  const sortedNonGraduated = nonGraduated.sort((a, b) => 
                    (a.school || '').localeCompare(b.school || '')
                  );

                  // Filter based on school founding year if available
                  const schoolFoundingYear = school?.yearFounded;
                  const filteredByFoundingYear = schoolFoundingYear ? 
                    sortedGraduated.filter(badge => {
                      const gradYear = parseInt(badge.graduationYear);
                      return !gradYear || gradYear >= schoolFoundingYear;
                    }) : sortedGraduated;

                  return (
                    <div className="space-y-6">
                      {/* Graduated Alumni Section */}
                      {filteredByFoundingYear.length > 0 && (
                        <div>
                          <h4 className="text-lg font-semibold text-green-600 mb-4 flex items-center">
                            <GraduationCap className="h-5 w-5 mr-2 text-green-600" />
                            Graduated Alumni ({filteredByFoundingYear.length})
                          </h4>
                          <div className="space-y-2">
                            {filteredByFoundingYear.map((badge) => (
                              <div key={badge.id} className="flex items-center justify-between p-4 bg-green-300/10 backdrop-blur-lg border border-white/20 shadow-2xl rounded-lg">
                                <div className="flex items-center space-x-4">
                                  {/* Profile Picture */}
                                  <div className="w-32 h-32 rounded-full overflow-hidden flex-shrink-0 bg-white/20">
                                    {badge.profileImage ? (
                                      <img 
                                        src={badge.profileImage} 
                                        alt={badge.fullName}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center bg-green-500/20">
                                        <UserIcon className="w-16 h-16 text-green-200" />
                                      </div>
                                    )}
                                  </div>
                                  {/* Info */}
                                  <div>
                                    <h4 className="text-lg font-semibold text-green-50">{badge.fullName}</h4>
                                    <p className="text-base text-green-50">
                                      Class of {badge.graduationYear} • 
                                      <span className={`ml-1 font-medium ${
                                        badge.status === 'verified' ? 'text-green-200' : 'text-yellow-600'
                                      }`}>
                                        {badge.status === 'verified' ? 'Verified' : 'Pending'}
                                      </span>
                                    </p>
                                    <p className="text-sm text-green-50 mt-1">Admitted: {badge.admissionYear}</p>
                                    {badge.email && (
                                      <p className="text-sm text-green-50 mt-1">Email: {badge.email}</p>
                                    )}
                                    {badge.phoneNumber && (
                                      <p className="text-sm text-green-50 mt-1">Phone: {badge.phoneNumber}</p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => deleteAlumniBadgeMutation.mutate(badge.id)}
                                    disabled={deleteAlumniBadgeMutation.isPending}
                                    className="text-red-600 border-red-200 hover:bg-red-50"
                                  >
                                    {deleteAlumniBadgeMutation.isPending ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Non-Graduated Alumni Section */}
                      {sortedNonGraduated.length > 0 && (
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                            <UserCheck className="h-5 w-5 mr-2 text-blue-600" />
                            Did Not Graduate from {school?.name} ({sortedNonGraduated.length})
                          </h4>
                          <div className="space-y-2">
                            {sortedNonGraduated.map((badge) => (
                              <div key={badge.id} className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <div className="flex items-center space-x-4">
                                  {/* Profile Picture */}
                                  <div className="w-32 h-32 rounded-full overflow-hidden flex-shrink-0 bg-gray-200">
                                    {badge.profileImage ? (
                                      <img 
                                        src={badge.profileImage} 
                                        alt={badge.fullName}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center bg-blue-500/20">
                                        <UserIcon className="w-16 h-16 text-blue-600" />
                                      </div>
                                    )}
                                  </div>
                                  {/* Info */}
                                  <div>
                                    <h4 className="text-lg font-semibold text-gray-900">{badge.fullName}</h4>
                                    <p className="text-base text-gray-600">
                                      Did not graduate • 
                                      <span className={`ml-1 font-medium ${
                                        badge.status === 'verified' ? 'text-green-600' : 'text-yellow-600'
                                      }`}>
                                        {badge.status === 'verified' ? 'Verified' : 'Pending'}
                                      </span>
                                    </p>
                                    <p className="text-sm text-gray-500 mt-1">Admitted: {badge.admissionYear}</p>
                                    {badge.email && (
                                      <p className="text-sm text-gray-500 mt-1">Email: {badge.email}</p>
                                    )}
                                    {badge.phoneNumber && (
                                      <p className="text-sm text-gray-500 mt-1">Phone: {badge.phoneNumber}</p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => deleteAlumniBadgeMutation.mutate(badge.id)}
                                    disabled={deleteAlumniBadgeMutation.isPending}
                                    className="text-red-600 border-red-200 hover:bg-red-50"
                                  >
                                    {deleteAlumniBadgeMutation.isPending ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* No results message */}
                      {filteredAlumni.length === 0 && alumniSearchTerm && (
                        <p className="text-gray-500 text-center py-4">No alumni found matching "{alumniSearchTerm}"</p>
                      )}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        )}
        
        {/* Profile Tab */}
        {activeTab === "profile" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-white">School Profile</h2>
            </div>

            {/* School Header with Name and Logo - Default Liquid Glass */}
            <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-xl">
              <CardContent className="p-6">
                <div className="flex items-center space-x-6">
                  {/* School Logo */}
                  <div className="w-24 h-24 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {school?.logo ? (
                      <img 
                        src={school.logo.startsWith('http') ? school.logo : (school.logo.startsWith('/') ? school.logo : `/${school.logo}`)}
                        alt={`${school.name} logo`}
                        className="w-full h-full object-cover"
                        style={{ aspectRatio: '1 / 1' }}
                        data-testid="img-school-logo"
                      />
                    ) : (
                      <GraduationCap className="w-12 h-12 text-white" />
                    )}
                  </div>
                  
                  {/* School Name */}
                  <div className="flex-1">
                    <h1 className="text-3xl font-bold text-white mb-2" data-testid="text-school-name">
                      {school?.name || "School Name"}
                    </h1>
                    <p className="text-white" data-testid="text-school-subtitle">
                      {school?.address || "Address not available"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* School Information Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Founding Year - Blue Stained Glass */}
              <Card className="bg-blue-500/10 backdrop-blur-lg border border-blue-300/20 shadow-xl">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Calendar className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-blue-50">Founded</h3>
                      <p className="text-2xl font-bold text-blue-600" data-testid="text-founding-year">
                        {school?.yearFounded || "N/A"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Alumni Count - Green Stained Glass */}
              <Card className="bg-green-500/10 backdrop-blur-lg border border-green-300/20 shadow-xl">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <UserCheck className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-green-50">Alumni Count</h3>
                      <p className="text-2xl font-bold text-green-600" data-testid="text-alumni-count">
                        {alumniBadges.length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Location and Website */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* School Location - Orange Stained Glass */}
              <Card className="bg-orange-500/10 backdrop-blur-lg border border-orange-300/20 shadow-xl">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <span className="font-semibold text-orange-50">Location</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2" data-testid="section-location">
                    <p className="text-lg font-medium text-orange-600">
                      {school?.city || "City"}{school?.state ? `, ${school.state}` : ""}
                    </p>
                    <p className="text-orange-600">
                      {school?.country || "Country"}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* School Website - Purple Stained Glass */}
              <Card className="bg-purple-500/10 backdrop-blur-lg border border-purple-300/20 shadow-xl">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9m0 9c4.97 0 9-4.03 9-9s-4.03-9-9-9" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 21a9 9 0 009-9H3a9 9 0 009 9z" />
                      </svg>
                    </div>
                    <span className="text-purple-50">Website</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {school?.website ? (
                    <div data-testid="section-website">
                      <a 
                        href={school.website.startsWith('http') ? school.website : `https://${school.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                        data-testid="link-school-website"
                      >
                        {school.website}
                      </a>
                    </div>
                  ) : (
                    <div className="text-gray-500" data-testid="no-website">
                      <p className="mb-3 text-purple-50">No website provided</p>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setLocation("/school-settings?tab=profile")}
                        data-testid="button-add-website"
                        className="text-purple-50 border-purple-200 bg-purple-5 hover:bg-purple-50 hover:text-purple-600"
                      >
                        Add Website
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
        
        {/* Request Details Dialog */}
        <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
          <DialogContent className="max-w-2xl bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-white">Alumni Status Request Details</DialogTitle>
              <DialogDescription className="text-blue-50">
                Review the submitted alumni verification information
              </DialogDescription>
            </DialogHeader>
            
            {selectedRequest && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-white">Full Name</Label>
                    <p className="text-white/80">{selectedRequest.fullName}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-white">Status</Label>
                    <p className={`text-sm font-medium ${
                      selectedRequest.status === 'pending' ? 'text-orange-600' :
                      selectedRequest.status === 'approved' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {selectedRequest.status.charAt(0).toUpperCase() + selectedRequest.status.slice(1)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-white">Admission Year</Label>
                    <p className="text-white/80">{selectedRequest.admissionYear}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-white">Graduation Year</Label>
                    <p className="text-white/80">{selectedRequest.graduationYear}</p>
                  </div>
                </div>
                
                {selectedRequest.postHeld && (
                  <div>
                    <Label className="text-sm font-medium text-white">Post Held</Label>
                    <p className="text-white/80">{selectedRequest.postHeld}</p>
                  </div>
                )}
                
                {selectedRequest.studentName && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-white">Student Reference Name</Label>
                      <p className="text-white/80">{selectedRequest.studentName}</p>
                    </div>
                    {selectedRequest.studentAdmissionYear && (
                      <div>
                        <Label className="text-sm font-medium text-white">Reference Admission Year</Label>
                        <p className="text-white/80">{selectedRequest.studentAdmissionYear}</p>
                      </div>
                    )}
                  </div>
                )}
                
                {selectedRequest.additionalInfo && (
                  <div>
                    <Label className="text-sm font-medium text-white">Additional Information</Label>
                    <p className="text-white/80 bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl p-3 rounded-md">{selectedRequest.additionalInfo}</p>
                  </div>
                )}
                
                <div>
                  <Label className="text-sm font-medium text-white">Request Date</Label>
                  <p className="text-white/80">{new Date(selectedRequest.createdAt || "").toLocaleDateString()}</p>
                </div>
                
                {selectedRequest.status === 'pending' && (
                  <div className="flex gap-3 pt-4 border-t border-gray-200">
                    <Button 
                      onClick={() => {
                        handleApproveRequest(selectedRequest.id);
                        setShowRequestDialog(false);
                      }}
                      disabled={approveAlumniRequestMutation.isPending}
                      className="bg-green-500/20 backdrop-blur-lg border border-white/20 shadow-2xl text-green-600 hover:bg-green-500 hover:text-white"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve Request
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => {
                        handleDenyRequest(selectedRequest.id);
                        setShowRequestDialog(false);
                      }}
                      disabled={denyAlumniRequestMutation.isPending}
                      className="bg-red-500/20 backdrop-blur-lg border border-white/20 shadow-2xl text-red-600 hover:bg-red-500 hover:text-white"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Deny Request
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Memory Preview Modal */}
        <Dialog open={!!previewMemory} onOpenChange={(open) => !open && setPreviewMemory(null)}>
          <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] flex flex-col bg-white/95 backdrop-blur-lg border border-white/20 shadow-2xl">
            {previewMemory && (
              <>
                <DialogHeader className="shrink-0">
                  <DialogTitle className="text-xl font-semibold">
                    {previewMemory.title}
                  </DialogTitle>
                  <DialogDescription className="text-gray-600">
                    Preview uploaded memory
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 overflow-y-auto flex-1 pr-1">
                  {/* Media Display */}
                  <div className="flex justify-center">
                    {previewMemory.mediaType === 'image' ? (
                      previewMemory.imageUrl ? (
                        <img 
                          src={previewMemory.imageUrl} 
                          alt={previewMemory.title}
                          className="max-w-full max-h-96 object-contain rounded-lg border"
                        />
                      ) : (
                        <div className="w-64 h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                          <FileImage className="h-16 w-16 text-gray-400" />
                          <span className="ml-2 text-gray-500">No image available</span>
                        </div>
                      )
                    ) : (
                      previewMemory.videoUrl ? (
                        <video 
                          src={previewMemory.videoUrl} 
                          controls
                          className="max-w-full max-h-96 rounded-lg border"
                        />
                      ) : (
                        <div className="w-64 h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                          <FileVideo className="h-16 w-16 text-gray-400" />
                          <span className="ml-2 text-gray-500">No video available</span>
                        </div>
                      )
                    )}
                  </div>
                  
                  {/* Memory Details */}
                  <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
                    {previewMemory.description && (
                      <div>
                        <h4 className="font-medium text-gray-900">Description</h4>
                        <p className="text-gray-700">{previewMemory.description}</p>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-600">Category:</span>
                        <br />
                        <span className="text-gray-800 capitalize">
                          {previewMemory.category?.replace('_', ' ') || 'None'}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Year:</span>
                        <br />
                        <span className="text-gray-800">{previewMemory.year}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Uploaded by:</span>
                        <br />
                        <span className="text-gray-800">{previewMemory.uploadedBy}</span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Upload Date:</span>
                        <br />
                        <span className="text-gray-800">
                          {new Date(previewMemory.createdAt || '').toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                </div>

                {/* Action Buttons — pinned outside scroll area */}
                <div className="flex justify-end space-x-3 pt-4 border-t shrink-0">
                  <Button
                    variant="outline"
                    onClick={() => setPreviewMemory(null)}
                  >
                    Close
                  </Button>
                  <Button
                    onClick={() => {
                      denyMemoryMutation.mutate(previewMemory.id);
                      setPreviewMemory(null);
                    }}
                    disabled={denyMemoryMutation.isPending}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Deny
                  </Button>
                  <Button
                    onClick={() => {
                      approveMemoryMutation.mutate(previewMemory.id);
                      setPreviewMemory(null);
                    }}
                    disabled={approveMemoryMutation.isPending}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Yearbook Configuration Dialog */}
        {showPurchaseOverlay && selectedYearForPurchase && user && school && (
          <YearbookConfigDialog
            isOpen={showPurchaseOverlay}
            onClose={() => setShowPurchaseOverlay(false)}
            year={selectedYearForPurchase}
            price={mockYears.find(y => y && y.year === selectedYearForPurchase)?.price || 14.99}
            schoolId={school.id}
            userId={user.id}
            isFree={mockYears.find(y => y && y.year === selectedYearForPurchase)?.isFree || false}
          />
        )}
      </div>
    </div>
    </div>
  );
}