import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchableSchoolSelect } from "@/components/ui/searchable-school-select";
import AdvancedSearch from "@/components/ui/advanced-search";
import AlumniRequestDialog from "@/components/AlumniRequestDialog";
import SchoolProfile from "@/components/ui/school-profile";
import { Eye, LogOut, Images, BookOpen, UserCheck, GraduationCap, User, Home, Award, Plus, CreditCard, Trash2, Bell, X, Library, Folder, FolderOpen, Users, Search, Mail, Phone, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw, Play, Calendar, Video, Menu, Settings, ShoppingCart, Upload, FileImage, FileVideo, AlertCircle, CheckCircle, Copy } from "lucide-react";
import PhotoGallery from "@/components/ui/photo-gallery";
import type { AlumniBadge, User as UserType, School, Memory, Notification} from "@shared/schema";
import logoImage from "@assets/logo_background_null.png";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/contexts/CurrencyContext";
import { CURRENT_YEAR, MIN_FOUNDING_YEAR, BADGE_SLOT_PRICE } from "@shared/constants";

// Expiry Timer Component
function ExpiryTimer({ expiresAt }: { expiresAt: Date }) {
  const [timeLeft, setTimeLeft] = useState('');
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date().getTime();
      const expiry = new Date(expiresAt).getTime();
      const diff = expiry - now;

      if (diff <= 0) {
        setTimeLeft('Expired');
        setIsExpired(true);
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      setIsExpired(false);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  return (
    <div className={`flex items-center gap-2 text-xs ${isExpired ? 'text-red-400' : 'text-green-400'}`}>
      <Calendar className="h-3 w-3" />
      <span className="font-medium">
        {isExpired ? 'Code Expired' : `Expires in: ${timeLeft}`}
      </span>
    </div>
  );
}

export default function ViewerDashboard() {
  const [, setLocation] = useLocation();
  const [selectedSchool, setSelectedSchool] = useState("");
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR.toString());
  const [user, setUser] = useState<UserType | null>(null);
  const [activeTab, setActiveTab] = useState("home");
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAlumniRequestDialog, setShowAlumniRequestDialog] = useState(false);
  const [alumniRequestInitialSchool, setAlumniRequestInitialSchool] = useState<string | undefined>(undefined);
  
  // Phone number editing state
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [editingPhoneNumber, setEditingPhoneNumber] = useState("");
  
  // Alumni tab state
  const [selectedAlumniSchool, setSelectedAlumniSchool] = useState("");
  const [selectedGraduationYear, setSelectedGraduationYear] = useState("");
  const [alumniSearchTerm, setAlumniSearchTerm] = useState("");
  const [expandedSchools, setExpandedSchools] = useState<Set<string>>(new Set());
  const [memoryFilter, setMemoryFilter] = useState<string>('all');
  const [alumniGraduationYearFilter, setAlumniGraduationYearFilter] = useState<string>("all");
  const [alumniAdmissionYearFilter, setAlumniAdmissionYearFilter] = useState<string>("all");
  const [showDidNotGraduate, setShowDidNotGraduate] = useState(false);
  
  // Image preview modal state
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(-1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Hamburger menu state
  const [showHamburgerMenu, setShowHamburgerMenu] = useState(false);
  
  // Memory Upload tab state
  const [uploadCode, setUploadCode] = useState("");
  const [codeValidated, setCodeValidated] = useState(false);
  const [linkInfo, setLinkInfo] = useState<any>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [uploadForm, setUploadForm] = useState({ title: "", description: "" });
  
  // Multiple upload state
  const [uploadMode, setUploadMode] = useState<'single' | 'multiple'>('single');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [multipleUploadForm, setMultipleUploadForm] = useState({ files: [] as { file: File, title: string, description: string }[] });
  
  // Upload loading states
  const [isUploadingMemory, setIsUploadingMemory] = useState(false);
  const [isUploadingMultiple, setIsUploadingMultiple] = useState(false);
  
  const { toast } = useToast();
  const { convertPrice, formatPrice } = useCurrency();

  // Helper function to convert memory URLs to public URLs (same logic as PhotoGallery)
  const getMemoryImageUrl = (imageUrl: string | null | undefined): string => {
    if (!imageUrl) return '/placeholder-image.jpg';
    
    // Memory images are served directly from /public, so we need to ensure the URL is correct
    if (imageUrl.startsWith('/uploads/')) {
      return `/public${imageUrl}`;
    }
    if (imageUrl.startsWith('/public/uploads/')) {
      return imageUrl;
    }
    // If it doesn't start with uploads, assume it's already a full URL
    return imageUrl;
  };

  
  // Image preview handlers
  const handleImageClick = (memory: Memory, index: number) => {
    setSelectedImageIndex(index);
    setIsModalOpen(true);
  };

  const navigateToNext = () => {
    if (selectedImageIndex < memories.length - 1) {
      setSelectedImageIndex(selectedImageIndex + 1);
    }
  };

  const navigateToPrevious = () => {
    if (selectedImageIndex > 0) {
      setSelectedImageIndex(selectedImageIndex - 1);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedImageIndex(-1);
    setZoomLevel(1);
    setImagePosition({ x: 0, y: 0 });
  };

  // Zoom control functions
  const zoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.5, 3));
  };

  const zoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.5, 0.5));
  };

  const resetZoom = () => {
    setZoomLevel(1);
    setImagePosition({ x: 0, y: 0 });
  };

  // Mouse drag handlers for panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - imagePosition.x, y: e.clientY - imagePosition.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoomLevel > 1) {
      setImagePosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  
  // Handle phone number update
  const handlePhoneNumberUpdate = async () => {
    if (!user) return;
    
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phoneNumber: editingPhoneNumber }),
      });
      
      if (response.ok) {
        const updatedUser = { ...user, phoneNumber: editingPhoneNumber };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setIsEditingPhone(false);
        toast({
          title: "Phone number updated",
          description: "Your phone number has been successfully updated.",
        });
      } else {
        throw new Error('Failed to update phone number');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update phone number. Please try again.",
        variant: "destructive",
      });
    }
  };

  const startEditingPhone = () => {
    setEditingPhoneNumber(user?.phoneNumber || "");
    setIsEditingPhone(true);
  };

  const cancelEditingPhone = () => {
    setEditingPhoneNumber("");
    setIsEditingPhone(false);
  };
  
  // Handle phone privacy toggle
  const handlePhonePrivacyToggle = async (checked: boolean) => {
    if (!user) return;
    
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ showPhoneToAlumni: checked }),
      });
      
      if (response.ok) {
        const updatedUser = { ...user, showPhoneToAlumni: checked };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
        toast({
          title: "Privacy setting updated",
          description: checked ? "Your phone number will be visible to alumni" : "Your phone number will be hidden from alumni",
        });
      } else {
        throw new Error('Failed to update privacy setting');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update privacy setting. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Mock alumni badges data - replace with your actual user data structure
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

  // Fetch ALL alumni for the selected school
  const { data: schoolAlumniData = [] } = useQuery<AlumniBadge[]>({
    queryKey: ["/api/alumni-badges/school", selectedAlumniSchool],
    enabled: !!selectedAlumniSchool,
    queryFn: async () => {
      if (!selectedAlumniSchool) return [];
      const res = await fetch(`/api/alumni-badges/school/${selectedAlumniSchool}`);
      if (!res.ok) throw new Error("Failed to fetch school alumni");
      return res.json();
    }
  });

  const maxAlumniBadges = user?.badgeSlots || 4;
  const accountStatus = alumniBadges.length > 0 ? "Alumni" : "Viewer";
  const [showAllBadges, setShowAllBadges] = useState(false);
  const [showBuySlotsDialog, setShowBuySlotsDialog] = useState(false);
  const [slotsToBuy, setSlotsToBuy] = useState(1);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) {
      setLocation("/");
      return;
    }
    
    const parsedUser = JSON.parse(userData);
    
    // Verify this is a viewer or student account, not a school admin account
    if (parsedUser.userType === "school") {
      console.log("School admin account detected in viewer dashboard, redirecting to correct dashboard");
      localStorage.removeItem("user"); // Clear the session
      setLocation("/");
      return;
    }
    
    setUser(parsedUser);
    
    // Refresh user data from server to get latest badge slots and other updates
    if (parsedUser?.id) {
      fetch(`/api/users/${parsedUser.id}`)
        .then(res => res.json())
        .then(updatedUser => {
          setUser(updatedUser);
          localStorage.setItem('user', JSON.stringify(updatedUser));
        })
        .catch(err => console.error('Failed to refresh user data:', err));
    }
    
    // Load previously selected school if it exists
    const savedSchool = localStorage.getItem(`selectedSchool_${parsedUser.id}`);
    if (savedSchool) {
      setSelectedSchool(savedSchool);
    }

    // Handle URL parameters for tab switching and upload code
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    const codeParam = urlParams.get('code');
    
    if (tabParam === 'memory_upload') {
      setActiveTab('memory-upload');
      if (codeParam) {
        setUploadCode(codeParam);
        // Auto-validate the code when redirected from guest upload - pass the code directly
        validateUploadCode(codeParam);
      }
    }
  }, [setLocation]);

  // Helper function to get school logo for a badge
  const getSchoolLogo = (schoolName: string): string | null => {
    const school = schools.find(s => s.name === schoolName);
    return school?.logo || null;
  };

  const { data: schools = [] } = useQuery<School[]>({
    queryKey: ["/api/schools"],
    enabled: !!user,
  });

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

  const { data: memories = [] } = useQuery<Memory[]>({
    queryKey: ["/api/memories/school", selectedSchool, selectedYear],
    enabled: !!selectedSchool,
  });

  const { data: school } = useQuery<School>({
    queryKey: ["/api/schools", selectedSchool],
    enabled: !!selectedSchool,
  });

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isModalOpen) return;
      
      switch (event.key) {
        case 'ArrowLeft':
          navigateToPrevious();
          break;
        case 'ArrowRight':
          navigateToNext();
          break;
        case 'Escape':
          closeModal();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, selectedImageIndex, memories.length]);
  
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
  

  // Fetch user's purchased yearbooks
  const { data: purchasedYearbooks = [] } = useQuery({
    queryKey: ["/api/library", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user?.id) return [];
      const res = await fetch(`/api/library/${user.id}`);
      if (!res.ok) throw new Error("Failed to fetch purchased yearbooks");
      return res.json();
    },
  });

  // Fetch students by school and graduation year for alumni tab
  // Query for all students from the selected school (for search across all years)
  const { data: allSchoolStudents = [] } = useQuery<any[]>({
    queryKey: ["/api/students", selectedAlumniSchool, "search"],
    enabled: !!selectedAlumniSchool,
    queryFn: async () => {
      if (!selectedAlumniSchool) return [];
      
      // Ensure we use the correct school ID
      let schoolId = selectedAlumniSchool;
      if (!selectedAlumniSchool.includes('-')) {
        const schoolObj = schools.find(s => s.name === selectedAlumniSchool);
        if (schoolObj) {
          schoolId = schoolObj.id;
        }
      }
      
      const res = await fetch(`/api/students/${schoolId}/search`);
      if (!res.ok) throw new Error("Failed to fetch students");
      return res.json();
    }
  });

  // Query for specific graduation year students
  const { data: yearStudents = [] } = useQuery<any[]>({
    queryKey: ["/api/students", selectedAlumniSchool, selectedGraduationYear],
    enabled: !!selectedAlumniSchool && !!selectedGraduationYear,
    queryFn: async () => {
      if (!selectedAlumniSchool || !selectedGraduationYear) return [];
      
      // Ensure we use the correct school ID
      let schoolId = selectedAlumniSchool;
      if (!selectedAlumniSchool.includes('-')) {
        const schoolObj = schools.find(s => s.name === selectedAlumniSchool);
        if (schoolObj) {
          schoolId = schoolObj.id;
        }
      }
      
      const res = await fetch(`/api/students/${schoolId}/${selectedGraduationYear}`);
      if (!res.ok) throw new Error("Failed to fetch classmates");
      return res.json();
    }
  });

  // Save selected school to localStorage when it changes
  useEffect(() => {
    if (selectedSchool && user?.id) {
      localStorage.setItem(`selectedSchool_${user.id}`, selectedSchool);
    }
  }, [selectedSchool, user?.id]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    setLocation("/");
  };

  const handleYearbookFinder = () => {
    if (!selectedSchool) {
      toast({
        title: "Please select a school",
        description: "Choose a school from the dropdown before browsing yearbooks.",
        variant: "destructive",
      });
      return;
    }
    setLocation(`/yearbook-finder?school=${selectedSchool}`);
  };

  const handleRequestAlumniStatus = () => {
    if (alumniBadges.length >= maxAlumniBadges) {
      alert("You have reached the maximum number of alumni badges (4). Please upgrade your account to add more alumni statuses.");
      return;
    }
    setAlumniRequestInitialSchool(selectedSchool || undefined);
    setShowAlumniRequestDialog(true);
  };

  const handleUpgradeAccount = () => {
    setShowBuySlotsDialog(true);
  };

  // Alumni badge deletion
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

  const handleDeleteAlumniBadge = (badgeId: string) => {
    deleteAlumniBadgeMutation.mutate(badgeId);
  };

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
    onError: () => {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Failed to add to cart",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handlePurchaseSlots = () => {
    addBadgeSlotsToCartMutation.mutate(slotsToBuy);
  };

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

  // Clear all notifications mutation
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
    } else if (diffDays < 7) {
      return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    } else {
      return new Date(date).toLocaleDateString();
    }
  };

  const unreadNotificationCount = notifications.filter(n => !n.isRead).length;

  // Generate years dynamically based on selected school's founding year
  const currentYear = CURRENT_YEAR;
  const selectedSchoolObj = schools.find(school => school.id === selectedSchool);
  const schoolFoundingYear = selectedSchoolObj?.yearFounded || MIN_FOUNDING_YEAR;
  
  // Generate years from current year down to school founding year
  const availableYears = Array.from({ length: currentYear - schoolFoundingYear + 1 }, (_, i) => {
    return (currentYear - i).toString();
  });

  // Reset selected year when school changes
  useEffect(() => {
    if (selectedSchool && selectedSchoolObj) {
      // If the current selected year is not available for this school, reset to current year
      if (!availableYears.includes(selectedYear)) {
        setSelectedYear(currentYear.toString());
      }
    } else {
      // If no school is selected, reset year to default
      setSelectedYear(currentYear.toString());
    }
  }, [selectedSchool, selectedSchoolObj, availableYears]);

  if (!user) return null;

  // Memory upload validation and upload handlers
  const validateUploadCode = async (codeToValidate?: string) => {
    const code = (codeToValidate || uploadCode).replace(/-/g, ''); // Strip dashes for server validation
    if (!code.trim() || code.length !== 16) {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Code Required",
        description: "Please enter a valid 16-character upload code",
        variant: "destructive"
      });
      return;
    }

    try {
      // Get user ID from localStorage for Authorization header
      const userData = localStorage.getItem("user");
      const userId = userData ? JSON.parse(userData).id : null;
      
      const headers: Record<string, string> = {};
      if (userId) {
        headers["Authorization"] = `Bearer ${userId}`;
      }

      const response = await fetch(`/api/public-upload-links/${code}`, {
        headers,
        credentials: "include"
      });
      
      if (!response.ok) {
        const error = await response.json();
        toast({
          className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
          title: "Invalid Code",
          description: error.message || "The upload code is invalid or expired",
          variant: "destructive"
        });
        return;
      }
      
      const linkData = await response.json();
      setLinkInfo(linkData);
      setCodeValidated(true);
      toast({
        className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Code Validated",
        description: `Upload access granted for ${linkData.category} memories`,
      });
    } catch (error) {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Validation Failed",
        description: "Failed to validate upload code",
        variant: "destructive"
      });
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
          title: "File Too Large",
          description: "Please select a file smaller than 10MB",
          variant: "destructive"
        });
        return;
      }
      
      // Cleanup previous preview URL to prevent memory leaks
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleMultipleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    // Filter files that are too large
    const validFiles = files.filter(file => {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: `${file.name} is larger than 10MB and was skipped`,
          variant: "destructive"
        });
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    // Create file data with default titles
    const newFiles = validFiles.map(file => {
      // Generate default title: EventType + Year (e.g., "Graduation 2013")
      const eventType = linkInfo?.category || 'Event';
      const year = linkInfo?.year || new Date().getFullYear();
      const defaultTitle = `${eventType} ${year}`;
      
      return {
        file,
        title: defaultTitle,
        description: ''
      };
    });

    setMultipleUploadForm(prev => ({
      ...prev,
      files: [...prev.files, ...newFiles]
    }));

    toast({
      className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
      title: "Files Added",
      description: `${validFiles.length} file(s) added with default titles`,
    });
  };

  const handleMemoryUpload = async () => {
    if (!selectedFile || !linkInfo || isUploadingMemory) return;

    setIsUploadingMemory(true);
    try {
      const formData = new FormData();
      formData.append('memoryFile', selectedFile);
      formData.append('title', uploadForm.title || 'Untitled');
      formData.append('description', uploadForm.description || '');
      formData.append('uploadedBy', user?.fullName || `${user?.firstName} ${user?.lastName}` || 'Unknown User');

      const response = await fetch(`/api/public-uploads/${uploadCode.replace(/-/g, '')}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user?.id}`
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      toast({
        className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Upload Successful",
        description: "Your memory has been uploaded and is pending approval!",
      });

      // Reset form
      setUploadForm({ title: '', description: '' });
      setSelectedFile(null);
      setPreviewUrl('');
      setCodeValidated(false);
      setUploadCode('');
      setLinkInfo(null);

    } catch (error) {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Upload Failed",
        description: "Failed to upload memory. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsUploadingMemory(false);
    }
  };

  const handleMultipleMemoryUpload = async () => {
    if (multipleUploadForm.files.length === 0 || !linkInfo || isUploadingMultiple) return;

    setIsUploadingMultiple(true);
    const uploadPromises = multipleUploadForm.files.map(async (fileData, index) => {
      try {
        const formData = new FormData();
        formData.append('memoryFile', fileData.file);
        formData.append('title', fileData.title || 'Untitled');
        formData.append('description', fileData.description || '');
        formData.append('uploadedBy', user?.fullName || `${user?.firstName} ${user?.lastName}` || 'Unknown User');

        const response = await fetch(`/api/public-uploads/${uploadCode.replace(/-/g, '')}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${user?.id}`
          },
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Upload failed for ${fileData.file.name}`);
        }

        return { success: true, filename: fileData.file.name };
      } catch (error) {
        return { success: false, filename: fileData.file.name, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    try {
      const results = await Promise.all(uploadPromises);
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      if (successful.length > 0) {
        toast({
          className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
          title: "Upload Successful",
          description: `${successful.length} memories uploaded successfully and are pending approval!`,
        });
      }

      if (failed.length > 0) {
        toast({
          className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
          title: "Some Uploads Failed",
          description: `${failed.length} files failed to upload. Please try again.`,
          variant: "destructive"
        });
      }

      // Reset form if all uploads were successful
      if (failed.length === 0) {
        setMultipleUploadForm({ files: [] });
        setCodeValidated(false);
        setUploadCode('');
        setLinkInfo(null);
        setUploadMode('single');
      }

    } catch (error) {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Upload Failed",
        description: "Failed to upload memories. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsUploadingMultiple(false);
    }
  };

  const renderMemoryUploadTab = () => {
    return (
      <div className="space-y-8">
        <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
          <CardContent className="p-6">
            <div className="flex items-center space-x-3 mb-6">
              <Upload className="h-6 w-6 text-yellow-500" />
              <div>
                <h3 className="text-lg font-semibold text-white">Memory Upload</h3>
                <p className="text-sm text-white/70">
                  Upload photos and videos using special school codes
                </p>
              </div>
            </div>

            {!codeValidated ? (
              <div className="space-y-4">
                <div>
                  <Label className="text-white">Enter Upload Code</Label>
                  <p className="text-sm text-white/70 mb-2">
                    Enter the 16-character code provided by your school (XXXX-XXXX-XXXX-XXXX format)
                  </p>
                  <div className="flex gap-3">
                    <Input
                      value={uploadCode}
                      onChange={(e) => {
                        let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                        if (value.length > 16) value = value.slice(0, 16);
                        // Auto-format with dashes after every 4 characters
                        const formatted = value.replace(/(.{4})/g, '$1-').replace(/-$/, '');
                        setUploadCode(formatted);
                      }}
                      placeholder="XXXX-XXXX-XXXX-XXXX"
                      className="bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50"
                      data-testid="input-upload-code"
                      maxLength={19}
                    />
                    <Button 
                      onClick={() => validateUploadCode()}
                      className="bg-yellow-500 hover:bg-yellow-600 text-black"
                      data-testid="button-validate-code"
                    >
                      Validate
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Code Validated Success */}
                <div className="flex items-center space-x-2 p-3 bg-green-500/20 border border-green-400/30 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                  <div>
                    <p className="text-green-200 font-medium">Code Validated Successfully!</p>
                    <p className="text-green-300/80 text-sm">
                      Upload access granted for {linkInfo?.category} memories
                    </p>
                  </div>
                </div>

                {/* Upload Mode Toggle */}
                <div className="flex items-center justify-center space-x-4 p-3 bg-white/5 border border-white/10 rounded-lg">
                  <span className="text-white text-sm">Upload Mode:</span>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant={uploadMode === 'single' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setUploadMode('single')}
                      className={uploadMode === 'single' ? 'bg-yellow-500 text-black' : 'text-black border-white/20'}
                      data-testid="button-single-mode"
                    >
                      Single
                    </Button>
                    <Button
                      variant={uploadMode === 'multiple' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setUploadMode('multiple')}
                      className={uploadMode === 'multiple' ? 'bg-yellow-500 text-black' : 'text-black border-white/20'}
                      data-testid="button-multiple-mode"
                    >
                      Multiple
                    </Button>
                  </div>
                </div>

                {/* Upload Form - Conditional based on mode */}
                {uploadMode === 'single' ? (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-white">Title *</Label>
                      <Input
                        value={uploadForm.title}
                        onChange={(e) => setUploadForm(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Enter a title for your memory"
                        className="bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50"
                        data-testid="input-memory-title"
                      />
                  </div>

                  <div>
                    <Label className="text-white">Description (Optional)</Label>
                    <Input
                      value={uploadForm.description}
                      onChange={(e) => setUploadForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Describe this memory"
                      className="bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50"
                      data-testid="input-memory-description"
                    />
                  </div>

                  {/* File Upload */}
                  <div>
                    <Label className="text-white">Upload Photo or Video *</Label>
                    <div className="mt-2">
                      {!selectedFile ? (
                        <div className="border-2 border-dashed border-white/30 bg-white/5 backdrop-blur-lg rounded-lg p-6 text-center">
                          <input
                            type="file"
                            accept="image/*,video/*"
                            onChange={handleFileSelect}
                            className="hidden"
                            id="file-upload"
                            data-testid="input-file-upload"
                          />
                          <label
                            htmlFor="file-upload"
                            className="cursor-pointer flex flex-col items-center space-y-2"
                          >
                            <Upload className="h-12 w-12 text-white/60" />
                            <p className="text-white/80">Click to upload a photo or video</p>
                            <p className="text-white/60 text-sm">Max file size: 10MB</p>
                          </label>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {/* File Preview */}
                          <div className="flex items-center space-x-3 p-3 bg-white/10 rounded-lg">
                            {selectedFile.type.startsWith('image/') ? (
                              <FileImage className="h-6 w-6 text-blue-400" />
                            ) : (
                              <FileVideo className="h-6 w-6 text-green-400" />
                            )}
                            <div className="flex-1">
                              <p className="text-white font-medium">{selectedFile.name}</p>
                              <p className="text-white/70 text-sm">
                                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedFile(null);
                                setPreviewUrl('');
                              }}
                              className="text-red-400 hover:text-red-300"
                              data-testid="button-remove-file"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>

                          {/* Image Preview */}
                          {previewUrl && selectedFile.type.startsWith('image/') && (
                            <div className="rounded-lg overflow-hidden max-w-sm">
                              <img 
                                src={previewUrl} 
                                alt="Preview" 
                                className="w-full h-auto max-h-64 object-contain"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Upload Button */}
                  <div className="flex gap-3">
                    <Button
                      onClick={handleMemoryUpload}
                      disabled={!selectedFile || !uploadForm.title.trim() || isUploadingMemory}
                      className="bg-green-500 hover:bg-green-600 text-white"
                      data-testid="button-upload-memory"
                    >
                      {isUploadingMemory ? (
                        <>
                          <Upload className="h-4 w-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        'Upload Memory'
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setCodeValidated(false);
                        setUploadCode('');
                        setLinkInfo(null);
                        setSelectedFile(null);
                        setPreviewUrl('');
                        setUploadForm({ title: '', description: '' });
                      }}
                      className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl text-white"
                      data-testid="button-reset-upload"
                    >
                      Use Different Code
                    </Button>
                  </div>
                </div>
                ) : (
                  <div className="space-y-4">
                    {/* Multiple Upload Mode */}
                    <div>
                      <Label className="text-white">Uploaded By</Label>
                      <p className="text-white/80 text-sm bg-white/10 p-2 rounded border border-white/20">
                        {user?.fullName || `${user?.firstName} ${user?.lastName}` || 'Unknown User'}
                      </p>
                    </div>

                    {/* Multiple File Upload */}
                    <div>
                      <Label className="text-white">Upload Photos or Videos *</Label>
                      <div className="mt-2">
                        <div className="border-2 border-dashed border-white/30 bg-white/5 backdrop-blur-lg rounded-lg p-6 text-center">
                          <input
                            type="file"
                            accept="image/*,video/*"
                            multiple
                            onChange={handleMultipleFileSelect}
                            className="hidden"
                            id="multiple-file-upload"
                            data-testid="input-multiple-file-upload"
                          />
                          <label
                            htmlFor="multiple-file-upload"
                            className="cursor-pointer flex flex-col items-center space-y-2"
                          >
                            <Upload className="h-12 w-12 text-white/60" />
                            <p className="text-white/80">Click to upload multiple photos or videos</p>
                            <p className="text-white/60 text-sm">Max file size: 10MB per file</p>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* File List with Individual Titles */}
                    {multipleUploadForm.files.length > 0 && (
                      <div className="space-y-3">
                        <Label className="text-white">Files ({multipleUploadForm.files.length})</Label>
                        {multipleUploadForm.files.map((fileData, index) => (
                          <div key={index} className="p-4 bg-white/10 rounded-lg space-y-3">
                            <div className="flex items-center space-x-3">
                              {fileData.file.type.startsWith('image/') ? (
                                <img 
                                  src={URL.createObjectURL(fileData.file)} 
                                  alt={fileData.file.name}
                                  className="h-16 w-16 object-cover rounded-lg border border-white/20"
                                />
                              ) : fileData.file.type.startsWith('video/') ? (
                                <video 
                                  src={URL.createObjectURL(fileData.file)} 
                                  className="h-16 w-16 object-cover rounded-lg border border-white/20"
                                />
                              ) : (
                                <FileImage className="h-16 w-16 text-blue-400" />
                              )}
                              <div className="flex-1">
                                <p className="text-white font-medium">{fileData.file.name}</p>
                                <p className="text-white/70 text-sm">
                                  {(fileData.file.size / (1024 * 1024)).toFixed(2)} MB
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setMultipleUploadForm(prev => ({
                                    ...prev,
                                    files: prev.files.filter((_, i) => i !== index)
                                  }));
                                }}
                                className="text-red-400 hover:text-red-300"
                                data-testid={`button-remove-file-${index}`}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                              <div>
                                <Label className="text-white text-sm">Title *</Label>
                                <Input
                                  value={fileData.title}
                                  onChange={(e) => {
                                    setMultipleUploadForm(prev => ({
                                      ...prev,
                                      files: prev.files.map((f, i) => 
                                        i === index ? { ...f, title: e.target.value } : f
                                      )
                                    }));
                                  }}
                                  placeholder="Edit title"
                                  className="bg-white/5 border border-white/20 text-white placeholder:text-white/50 text-sm"
                                  data-testid={`input-file-title-${index}`}
                                />
                              </div>
                              <div>
                                <Label className="text-white text-sm">Description (Optional)</Label>
                                <Input
                                  value={fileData.description}
                                  onChange={(e) => {
                                    setMultipleUploadForm(prev => ({
                                      ...prev,
                                      files: prev.files.map((f, i) => 
                                        i === index ? { ...f, description: e.target.value } : f
                                      )
                                    }));
                                  }}
                                  placeholder="Add description"
                                  className="bg-white/5 border border-white/20 text-white placeholder:text-white/50 text-sm"
                                  data-testid={`input-file-description-${index}`}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Upload Button */}
                    <div className="flex gap-3">
                      <Button
                        onClick={handleMultipleMemoryUpload}
                        disabled={multipleUploadForm.files.length === 0 || multipleUploadForm.files.some(f => !f.title.trim()) || isUploadingMultiple}
                        className="bg-green-500 hover:bg-green-600 text-white"
                        data-testid="button-upload-multiple-memories"
                      >
                        {isUploadingMultiple ? (
                          <>
                            <Upload className="h-4 w-4 mr-2 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          `Upload ${multipleUploadForm.files.length} Memories`
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setCodeValidated(false);
                          setUploadCode('');
                          setLinkInfo(null);
                          setMultipleUploadForm({ files: [] });
                          setUploadMode('single');
                        }}
                        className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl text-white"
                        data-testid="button-reset-multiple-upload"
                      >
                        Use Different Code
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderHomeTab = () => (
    <div className="space-y-8">
      {/* Welcome Home Section */}
      <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
        <CardContent className="p-8">
          <div className="text-center space-y-6">
            <div>
              <h2 className="text-3xl font-bold text-white mb-4">Welcome to Yearbuk</h2>
              <p className="text-blue-200 text-lg">Your digital yearbook and alumni networking platform</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
                <BookOpen className="h-12 w-12 text-purple-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">Library</h3>
                <p className="text-blue-200">Access your purchased yearbooks</p>
              </div>
              
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
                <Search className="h-12 w-12 text-cyan-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">Search</h3>
                <p className="text-blue-200">Discover schools and memories</p>
              </div>
              
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
                <Users className="h-12 w-12 text-green-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">Connect</h3>
                <p className="text-blue-200">Network with fellow alumni</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderSearchTab = () => (
    <div className="space-y-8">
      {/* Advanced Search Interface */}
      <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
        <CardContent className="p-8">
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Discover Schools</h2>
              <p className="text-blue-200">Search and explore schools to view yearbooks, memories, and connect with alumni</p>
            </div>
            
            <AdvancedSearch
              schools={schools}
              selectedSchool={selectedSchool}
              onSchoolSelect={setSelectedSchool}
            />
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      {selectedSchool && (
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center">
          <Button 
            onClick={handleYearbookFinder}
            className="bg-secondary flex items-center justify-center space-x-2 sm:space-x-3 px-6 sm:px-12 py-6 sm:py-10 text-base sm:text-xl font-bold w-full sm:w-auto bg-green-500/20 backdrop-blur-lg border border-green-400 shadow-2xl cursor-pointer transition-all hover:bg-white/15 hover:scale-105 hover:border-green-400 hover:shadow-green-500/50 hover:shadow-lg hover:scale-105 transition-all duration-200 transform min-w-fit text-green-50 hover:text-green-400"
            data-testid="button-yearbook-finder"
          >
            <BookOpen className="h-5 w-5 sm:h-6 sm:w-6" />
            <span>Find Yearbooks</span>
          </Button>

          <Button 
            onClick={handleRequestAlumniStatus}
            className="bg-secondary flex items-center justify-center space-x-2 sm:space-x-3 px-6 sm:px-12 py-6 sm:py-10 text-base sm:text-xl font-bold w-full sm:w-auto bg-blue-500/20 backdrop-blur-lg border border-blue-400 shadow-2xl cursor-pointer transition-all hover:bg-white/15 hover:scale-105 hover:border-blue-400 hover:shadow-blue-500/50 hover:shadow-lg hover:scale-105 transition-all duration-200 transform min-w-fit text-blue-50 hover:text-blue-400"
            data-testid="button-request-alumni-status"
          >
            <UserCheck className="h-5 w-5 sm:h-6 sm:w-6" />
            <span>Request Alumni Status</span>
          </Button>
        </div>
      )}

      {/* School Profile with Gallery */}
      {school && (
        <div className="space-y-8">
          <SchoolProfile 
            school={school}
            galleryImages={[
              // School-specific gallery images would come from the backend
              // For now using external placeholders - school admins will upload these 12 images
              ...Array.from({ length: 12 }, (_, i) => ({
                image: `https://picsum.photos/seed/${school.id}-${i + 1}/800/450`
              }))
            ]}
          />
          
          {/* Year Selection and Memories Section */}
          <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
            <CardContent className="p-8">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-white">School Memories & Events</h3>
                    <p className="text-blue-200">Browse photos and videos from different academic years</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Label className="text-sm font-medium text-white">Academic Year:</Label>
                    <Select 
                      value={selectedYear} 
                      onValueChange={setSelectedYear}
                    >
                      <SelectTrigger className="w-32 bg-white/10 backdrop-blur-lg border border-white/20 text-white" data-testid="select-academic-year">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-blue-600/60 backdrop-blur-lg border border-white/20 text-white">
                        {availableYears.map(year => (
                          <SelectItem key={year} value={year}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Memory Statistics */}
                <div className="flex items-center space-x-2 text-sm text-blue-200">
                  <Images className="h-4 w-4 text-cyan-400" />
                  <span>
                    {memories.filter(m => m.mediaType === 'image').length} Photos, {memories.filter(m => m.mediaType === 'video').length} Videos for {selectedYear}
                  </span>
                </div>

                {/* Filter Tabs */}
                <div className="flex flex-wrap space-x-1 bg-white/10 backdrop-blur-lg border border-white/20 p-1 rounded-lg">
                  <button 
                    onClick={() => setMemoryFilter('all')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      memoryFilter === 'all' ? 'bg-white/30 text-white shadow-sm' : 'text-blue-100 hover:text-blue-400'
                    }`}
                    data-testid="filter-all-events"
                  >
                    All Events
                  </button>
                  <button 
                    onClick={() => setMemoryFilter('graduation')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      memoryFilter === 'graduation' ? 'bg-white/30 text-white shadow-sm' : 'text-blue-100 hover:text-blue-400'
                    }`}
                    data-testid="filter-graduation"
                  >
                    Graduation
                  </button>
                  <button 
                    onClick={() => setMemoryFilter('sports')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      memoryFilter === 'sports' ? 'bg-white/30 text-white shadow-sm' : 'text-blue-100 hover:text-blue-400'
                    }`}
                    data-testid="filter-sports"
                  >
                    Sports
                  </button>
                  <button 
                    onClick={() => setMemoryFilter('arts')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      memoryFilter === 'arts' ? 'bg-white/30 text-white shadow-sm' : 'text-blue-100 hover:text-blue-400'
                    }`}
                    data-testid="filter-arts"
                  >
                    Arts
                  </button>
                  <button 
                    onClick={() => setMemoryFilter('field_trips')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      memoryFilter === 'field_trips' ? 'bg-white/30 text-white shadow-sm' : 'text-blue-100 hover:text-blue-400'
                    }`}
                    data-testid="filter-field-trips"
                  >
                    Field Trips
                  </button>
                  <button 
                    onClick={() => setMemoryFilter('academic')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      memoryFilter === 'academic' ? 'bg-white/30 text-white shadow-sm' : 'text-blue-100 hover:text-blue-400'
                    }`}
                    data-testid="filter-academic"
                  >
                    Academic
                  </button>
                </div>

                {/* Memory Gallery */}
                {memories.length > 0 ? (
                  <div className="space-y-4">
                    <PhotoGallery 
                      memories={(memoryFilter === 'all' ? memories : memories.filter(m => m.category === memoryFilter)).slice(0, 12)}
                      viewerMode={true}
                      onImageClick={handleImageClick}
                    />
                    
                    {/* View All Button */}
                    {memories.length > 12 && (
                      <div className="text-center">
                        <Button
                          onClick={() => setActiveTab("photos")}
                          variant="outline"
                          className="bg-white/10 hover:bg-white/20 text-white border-white/20 hover:border-white/40"
                          data-testid="button-view-all-memories"
                        >
                          <Images className="h-4 w-4 mr-2" />
                          View All {memories.length} Photos & Videos
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-white/5 backdrop-blur-lg rounded-lg border-2 border-dashed border-white/20">
                    <Images className="mx-auto h-12 w-12 text-white/40 mb-4" />
                    <p className="text-white/60 text-lg font-medium mb-2">No memories found</p>
                    <p className="text-white/40 text-sm">
                      No memories available for {selectedYear} in the {memoryFilter === 'all' ? 'selected' : memoryFilter} category yet.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Welcome Message when no school selected */}
      {!selectedSchool && (
        <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
          <CardContent className="p-12 text-center">
            <div className="space-y-6">
              <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center mx-auto">
                <Search className="w-12 h-12 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white mb-3">Welcome to your Viewer Dashboard</h3>
                <p className="text-blue-200 text-lg leading-relaxed max-w-2xl mx-auto">
                  Search for schools above to explore yearbooks, browse memories, and connect with alumni from your educational journey. 
                  Start by typing a school name, city, or state in the search box.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderProfileTab = () => (
    <div className="space-y-8">
      {/* Account Information Card */}
      <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <User className="h-5 w-5 text-blue-500" />
              <h3 className="text-lg font-semibold text-white">Account Information</h3>
            </div>
          </div>

          <div className="space-y-6">
            {/* Profile Image and Basic Info */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-6 pb-6 border-b border-white/20">
              <div className="relative">
                {user?.profileImage ? (
                  <img 
                    src={user.profileImage} 
                    alt="Profile"
                    className="h-24 w-24 rounded-full object-cover border-4 border-white/20"
                  />
                ) : (
                  <div className="h-24 w-24 rounded-full bg-white/20 flex items-center justify-center border-4 border-white/20">
                    <User className="h-12 w-12 text-white/50" />
                  </div>
                )}
              </div>
              
              <div className="flex-1 text-center sm:text-left">
                <h4 className="text-2xl font-bold text-white mb-1" data-testid="text-user-fullname">
                  {user?.fullName || 'N/A'}
                </h4>
                <p className="text-blue-200 mb-2">@{user?.username || 'N/A'}</p>
                <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                  <span className="px-3 py-1 text-xs rounded-full bg-blue-500/30 text-blue-100 border border-blue-400/30">
                    {accountStatus}
                  </span>
          
                  {user?.isEmailVerified && (
                    <span className="px-3 py-1 text-xs rounded-full bg-green-500/30 text-green-100 border border-green-400/30">
                      ✓ Email Verified
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Personal Information Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* First Name */}
              <div className="space-y-1">
                <Label className="text-white/70 text-sm">First Name</Label>
                <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                  <p className="text-white" data-testid="text-firstname">{user?.firstName || 'N/A'}</p>
                </div>
              </div>

              {/* Middle Name */}
              <div className="space-y-1">
                <Label className="text-white/70 text-sm">Middle Name</Label>
                <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                  <p className="text-white" data-testid="text-middlename">{user?.middleName || 'N/A'}</p>
                </div>
              </div>

              {/* Last Name */}
              <div className="space-y-1">
                <Label className="text-white/70 text-sm">Last Name</Label>
                <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                  <p className="text-white" data-testid="text-lastname">{user?.lastName || 'N/A'}</p>
                </div>
              </div>

              {/* Date of Birth */}
              <div className="space-y-1">
                <Label className="text-white/70 text-sm">Date of Birth</Label>
                <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                  <p className="text-white" data-testid="text-dob">
                    {user?.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1">
                <Label className="text-white/70 text-sm">Email Address</Label>
                <div className="bg-white/5 p-3 rounded-lg border border-white/10 flex items-center justify-between">
                  <p className="text-white break-all" data-testid="text-email">{user?.email || 'N/A'}</p>
                  {user?.isEmailVerified && (
                    <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0 ml-2" />
                  )}
                </div>
              </div>

              {/* Phone Number */}
              <div className="space-y-1">
                <Label className="text-white/70 text-sm">Phone Number</Label>
                <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                  <p className="text-white" data-testid="text-phone">{user?.phoneNumber || 'Not set'}</p>
                </div>
              </div>

              {/* Preferred Currency */}
              <div className="space-y-1">
                <Label className="text-white/70 text-sm">Preferred Currency</Label>
                <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                  <p className="text-white" data-testid="text-currency">{user?.preferredCurrency || 'USD'}</p>
                </div>
              </div>

              {/* Badge Slots */}
              <div className="space-y-1">
                <Label className="text-white/70 text-sm">Alumni Badge Slots</Label>
                <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                  <p className="text-white" data-testid="text-badge-slots">
                    {alumniBadges.length} / {maxAlumniBadges} used
                  </p>
                </div>
              </div>

              {/* Account Created */}
              <div className="space-y-1 md:col-span-2">
                <Label className="text-white/70 text-sm">Account Created</Label>
                <div className="bg-white/5 p-3 rounded-lg border border-white/10">
                  <p className="text-white" data-testid="text-created-at">
                    {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            {/* Privacy Settings */}
            <div className="pt-4 border-t border-white/20">
              <h4 className="text-white font-semibold mb-3">Privacy Settings</h4>
              <div className="flex items-center justify-between bg-white/5 p-4 rounded-lg border border-white/10">
                <div className="flex-1">
                  <Label className="text-white font-medium">Show Phone to Alumni</Label>
                  <p className="text-white/60 text-sm mt-1">
                    Allow verified alumni to see your phone number
                  </p>
                </div>
                <Switch
                  checked={user?.showPhoneToAlumni || false}
                  onCheckedChange={handlePhonePrivacyToggle}
                  data-testid="switch-phone-privacy"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alumni Badges Section */}
      <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <Award className="h-5 w-5 text-green-500" />
              <h3 className="text-lg font-semibold text-white">Alumni Badges</h3>
            </div>
            <div className="text-sm text-white/70">
              {alumniBadges.length} of {maxAlumniBadges} slots used
            </div>
          </div>

          {/* Alumni Badges Grid - Show only first 4 */}
          <div className="grid grid-cols-1 gap-4 mb-6 sm:grid-cols-2">
            {/* Existing badges - limited to 4 */}
            {alumniBadges.slice(0, 4).map((badge) => (
              <Card key={badge.id} className={`border-2 ${
                badge.status === "verified" 
                  ? "bg-green-500/30 backdrop-blur-lg border border-white/20 shadow-2xl border-green-500" 
                  : "bg-orange-500/30 backdrop-blur-lg border border-white/20 shadow-2xl border-orange-500"
              }`} data-testid={`card-badge-${badge.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        {getSchoolLogo(badge.school) ? (
                          <img 
                            src={`/public${getSchoolLogo(badge.school)}`} 
                            alt={badge.school}
                            className="h-6 w-6 rounded-full object-cover border border-white/20"
                          />
                        ) : (
                          <GraduationCap className={`h-4 w-4 ${
                            badge.status === "verified" ? "text-green-600" : "text-orange-600"
                          }`} />
                        )}
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          badge.status === "verified"
                            ? "bg-green-100 text-green-800" 
                            : "bg-orange-100 text-orange-800"
                        }`}>
                          {badge.status === "verified" ? "Approved" : "Pending"}
                        </span>
                      </div>
                      <h4 className="font-semibold text-white text-sm" data-testid={`text-badge-school-${badge.id}`}>{badge.school}</h4>
                      <p className="text-sm text-gray-50">Class of {badge.graduationYear}</p>
                      <p className="text-xs text-gray-50">Admitted: {badge.admissionYear}</p>
                    </div>
                    <div className="ml-2">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1"
                            data-testid={`button-delete-badge-${badge.id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl text-white">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Alumni Badge?</AlertDialogTitle>
                            <AlertDialogDescription className="space-y-2 text-white">
                              <p>Are you sure you want to delete this alumni badge for <strong>{badge.school}</strong>?</p>
                              <div className="bg-amber-500/30 backdrop-blur-lg border border-white/20 shadow-2xl rounded p-3 text-sm">
                                <p className="font-medium text-amber-50 mb-1">⚠️ Important Warning:</p>
                                <ul className="text-amber-50 space-y-1">
                                  <li>• This action is <strong>irreversible</strong></li>
                                
                                  <li>• You will lose your verified/pending status for this school</li>
                                </ul>
                              </div>
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteAlumniBadge(badge.id)}
                              className="bg-red-600/80 backdrop-blur-lg border border-white/20 shadow-2xl hover:bg-red-600"
                              data-testid={`button-confirm-delete-${badge.id}`}
                            >
                              Delete Badge
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Empty slots - show remaining up to 4 total */}
            {alumniBadges.length < 4 && Array.from({ length: Math.min(4 - alumniBadges.length, maxAlumniBadges - alumniBadges.length) }).map((_, index) => (
              <Card key={`empty-${index}`} className="border-2 border-dashed border-white/30 bg-white/5 backdrop-blur-lg" data-testid={`card-empty-slot-${index}`}>
                <CardContent className="p-4 flex items-center justify-center h-24">
                  <div className="text-center text-white/40">
                    <Plus className="h-6 w-6 mx-auto mb-1" />
                    <p className="text-xs">Empty Slot</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* See More Badges Dialog - Show when total slots > 4 */}
          {maxAlumniBadges > 4 && (
            <div className="text-center mb-4">
              <Dialog open={showAllBadges} onOpenChange={setShowAllBadges}>
                <DialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="bg-white/10 hover:bg-white/20 text-white border-white/20 hover:border-white/40"
                    data-testid="button-see-all-badges"
                  >
                    <Award className="h-4 w-4 mr-2" />
                    See All {maxAlumniBadges} Slots
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl text-white max-w-4xl max-h-[80vh] overflow-y-auto">
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold">All Alumni Badge Slots ({alumniBadges.length}/{maxAlumniBadges})</h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {/* Show all existing badges */}
                      {alumniBadges.map((badge) => (
                        <Card key={badge.id} className={`border-2 ${
                          badge.status === "verified" 
                            ? "bg-green-500/30 backdrop-blur-lg border border-white/20 shadow-2xl border-green-500" 
                            : "bg-orange-500/30 backdrop-blur-lg border border-white/20 shadow-2xl border-orange-500"
                        }`}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-2">
                                  {getSchoolLogo(badge.school) ? (
                                    <img 
                                      src={`/public${getSchoolLogo(badge.school)}`} 
                                      alt={badge.school}
                                      className="h-6 w-6 rounded-full object-cover border border-white/20"
                                    />
                                  ) : (
                                    <GraduationCap className={`h-4 w-4 ${
                                      badge.status === "verified" ? "text-green-600" : "text-orange-600"
                                    }`} />
                                  )}
                                  <span className={`px-2 py-1 text-xs rounded-full ${
                                    badge.status === "verified"
                                      ? "bg-green-100 text-green-800" 
                                      : "bg-orange-100 text-orange-800"
                                  }`}>
                                    {badge.status === "verified" ? "Approved" : "Pending"}
                                  </span>
                                </div>
                                <h4 className="font-semibold text-white text-sm">{badge.school}</h4>
                                <p className="text-sm text-gray-50">Class of {badge.graduationYear}</p>
                                <p className="text-xs text-gray-50">Admitted: {badge.admissionYear}</p>
                              </div>
                              <div className="ml-2">
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl text-white">
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Alumni Badge?</AlertDialogTitle>
                                      <AlertDialogDescription className="space-y-2 text-white">
                                        <p>Are you sure you want to delete this alumni badge for <strong>{badge.school}</strong>?</p>
                                        <div className="bg-amber-500/30 backdrop-blur-lg border border-white/20 shadow-2xl rounded p-3 text-sm">
                                          <p className="font-medium text-amber-50 mb-1">⚠️ Important Warning:</p>
                                          <ul className="text-amber-50 space-y-1">
                                            <li>• This action is <strong>irreversible</strong></li>
                                            <li>• You will lose your verified/pending status for this school</li>
                                            <li>• You will not be able to send a request to this school for the next 30 days</li>
                                          </ul>
                                        </div>
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => {
                                          handleDeleteAlumniBadge(badge.id);
                                          if (maxAlumniBadges <= 4) {
                                            setShowAllBadges(false);
                                          }
                                        }}
                                        className="bg-red-600/80 backdrop-blur-lg border border-white/20 shadow-2xl hover:bg-red-600"
                                      >
                                        Delete Badge
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      
                      {/* Show all empty slots */}
                      {Array.from({ length: maxAlumniBadges - alumniBadges.length }).map((_, index) => (
                        <Card key={`empty-dialog-${index}`} className="border-2 border-dashed border-white/30 bg-white/5 backdrop-blur-lg">
                          <CardContent className="p-4 flex items-center justify-center h-24">
                            <div className="text-center text-white/40">
                              <Plus className="h-6 w-6 mx-auto mb-1" />
                              <p className="text-xs">Empty Slot</p>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}

          {/* Badge Actions */}
          <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-white/20">
            <Button 
              onClick={handleRequestAlumniStatus}
              disabled={alumniBadges.length >= maxAlumniBadges}
              className="flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>Add Alumni Badge</span>
            </Button>

            {alumniBadges.length >= maxAlumniBadges && (
              <Button 
                onClick={handleUpgradeAccount}
                variant="outline"
                className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white flex items-center space-x-2"
              >
                <CreditCard className="h-4 w-4" />
                <span>Upgrade for More Slots</span>
              </Button>
            )}
          </div>

          {alumniBadges.length >= maxAlumniBadges && (
            <p className="text-sm text-amber-300 mt-2 bg-amber-900/20 backdrop-blur-lg border border-amber-300/20 p-2 rounded">
              ⚠️ You've reached the maximum number of free alumni badges. Upgrade to add more!
            </p>
          )}
        </CardContent>
      </Card>

      {/* Buy Badge Slots Dialog */}
      <Dialog open={showBuySlotsDialog} onOpenChange={setShowBuySlotsDialog}>
        <DialogContent className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl text-white">
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold mb-2">Purchase Additional Badge Slots</h3>
              <p className="text-white/70 text-sm">
                Currently you have <strong>{maxAlumniBadges}</strong> badge slots. Purchase additional slots to add more alumni badges.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="slots" className="text-white">Number of slots to purchase</Label>
                <Input
                  id="slots"
                  type="number"
                  min="1"
                  max="20"
                  value={slotsToBuy}
                  onChange={(e) => setSlotsToBuy(parseInt(e.target.value) || 1)}
                  className="bg-white/10 border-white/20 text-white"
                  data-testid="input-slots-to-buy"
                />
              </div>

              <div className="bg-white/5 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-white/70">Price per slot:</span>
                  <span className="text-white font-medium">{formatPrice(convertPrice(BADGE_SLOT_PRICE))}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/70">Number of slots:</span>
                  <span className="text-white font-medium">{slotsToBuy}</span>
                </div>
                <div className="h-px bg-white/20 my-2"></div>
                <div className="flex justify-between">
                  <span className="text-white font-semibold">Total:</span>
                  <span className="text-white font-semibold text-lg">{formatPrice(convertPrice(BADGE_SLOT_PRICE * slotsToBuy))}</span>
                </div>
              </div>

              <div className="bg-blue-900/20 rounded-lg p-3 text-sm text-blue-300">
                <p className="font-medium mb-1">ℹ️ Note:</p>
                <p>Add badge slots to your cart, then checkout to complete your purchase.</p>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowBuySlotsDialog(false);
                  setSlotsToBuy(1);
                }}
                className="flex-1 bg-white/10 border-white/20 text-white hover:bg-white/20"
                data-testid="button-cancel-purchase"
              >
                Cancel
              </Button>
              <Button
                onClick={handlePurchaseSlots}
                disabled={addBadgeSlotsToCartMutation.isPending || slotsToBuy < 1}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                data-testid="button-add-to-cart"
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                {addBadgeSlotsToCartMutation.isPending ? "Adding..." : `Add ${slotsToBuy} Slot${slotsToBuy > 1 ? 's' : ''} to Cart`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  const renderLibraryTab = () => {
    // Group purchased yearbooks by school to create school folders/shelves
    const groupedYearbooks = purchasedYearbooks.reduce((acc: any, yearbook: any) => {
      const schoolName = yearbook.school?.name || 'Unknown School';
      if (!acc[schoolName]) {
        acc[schoolName] = [];
      }
      acc[schoolName].push(yearbook);
      return acc;
    }, {});

    const schoolFolders = Object.keys(groupedYearbooks).sort();

    return (
      <div className="space-y-8">
        {/* Library Header */}
        <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Library className="h-6 w-6 text-blue-600" />
                <div>
                  <h3 className="text-lg font-semibold text-white">My Yearbook Library</h3>
                  <p className="text-sm text-white/70">
                    {purchasedYearbooks.length} purchased yearbook{purchasedYearbooks.length !== 1 ? 's' : ''} from {schoolFolders.length} school{schoolFolders.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <div className="text-right">
                
              </div>
            </div>
          </CardContent>
        </Card>

        {/* School Folders */}
        {schoolFolders.length === 0 ? (
          <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
            <CardContent className="p-8 text-center">
              <Library className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">No Yearbooks Yet</h3>
              <p className="text-white/70 mb-4">
                Start building your collection by purchasing yearbooks from schools you're interested in.
              </p>
              <Button 
                onClick={() => setActiveTab("home")}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <BookOpen className="h-4 w-4 mr-2" />
                Browse Yearbooks
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {schoolFolders.map((schoolName) => {
              const schoolYearbooks = groupedYearbooks[schoolName];
              const schoolInfo = schoolYearbooks[0]?.school; // Get school info from first yearbook
              
              return (
                <Card key={schoolName} className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
                  <CardContent className="p-6">
                    {/* School Folder Header */}
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="relative">
                        <Folder className="h-8 w-8 text-blue-500" />
                        <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                          {schoolYearbooks.length}
                        </span>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-blue-50 truncate">{schoolName}</h4>
                        <p className="text-sm text-blue-50">
                          {schoolInfo?.city}, {schoolInfo?.country}
                        </p>
                      </div>
                    </div>

                    {/* Yearbook Years */}
                    <div className="space-y-2 mb-4 ">
                      {schoolYearbooks
                        .sort((a: any, b: any) => b.year - a.year) // Most recent first
                        .slice(0, expandedSchools.has(schoolName) ? schoolYearbooks.length : 4) // Show all if expanded, otherwise first 4
                        .map((yearbook: any) => (
                        <Button
                          key={`${schoolName}-${yearbook.year}`}
                          variant="ghost"
                          className="w-full flex items-center justify-between p-3 bg-blue/10 hover:bg-blue-600 rounded-md transition-colors duration-200 border border-blue-200 hover:border-blue-300"
                          onClick={() => {
                            // Navigate to yearbook viewer like yearbook finder does
                            const schoolParam = schoolInfo?.id ? `?school=${schoolInfo.id}` : '';
                            setLocation(`/waibuk/${yearbook.year}${schoolParam}`);
                          }}
                          data-testid={`button-library-year-${yearbook.year}`}
                        >
                          <div className="flex items-center space-x-2">
                            <BookOpen className="h-4 w-4 text-blue-50" />
                            <span className="text-sm font-medium text-blue-50  ">
                              {yearbook.year} Academic Year
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-blue-50">
                              {new Date(yearbook.purchaseDate).toLocaleDateString()}
                            </span>
                            <Eye className="h-4 w-4 text-blue-50" />
                          </div>
                        </Button>
                      ))}
                      
                      {schoolYearbooks.length > 4 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                          onClick={() => {
                            const newExpanded = new Set(expandedSchools);
                            if (expandedSchools.has(schoolName)) {
                              newExpanded.delete(schoolName);
                            } else {
                              newExpanded.add(schoolName);
                            }
                            setExpandedSchools(newExpanded);
                          }}
                          data-testid={`button-expand-${schoolName.replace(/\s+/g, '-').toLowerCase()}`}
                        >
                          <span className="text-sm">
                            {expandedSchools.has(schoolName) 
                              ? "Show Less" 
                              : `Show ${schoolYearbooks.length - 4} More...`
                            }
                          </span>
                        </Button>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex space-x-2">
                      <Button 
                        size="sm" 
                        className="flex-1 w-full bg-white-500/40 backdrop-blur-lg border border-whhite shadow-2xl cursor-pointer transition-all hover:bg-blue-500 hover:scale-105 hover:border-white text-white hover:text-white"
                        onClick={() => {
                          setSelectedSchool(schoolInfo?.id);
                          setActiveTab("home");
                        }}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="flex-1 w-full bg-white-500/40 backdrop-blur-lg border border-whhite shadow-2xl cursor-pointer transition-all hover:bg-white hover:scale-105 hover:border-black text-white hover:text-black"
                        onClick={() => {
                          const schoolParam = schoolInfo?.id ? `?school=${schoolInfo.id}` : '';
                          setLocation(`/yearbook-finder${schoolParam}`);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add More
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderPhotosTab = () => {
    // Generate available years for selected school (using same logic as home tab)
    const selectedSchoolObj = schools.find(school => school.id === selectedSchool);
    const schoolFoundingYear = selectedSchoolObj?.yearFounded || MIN_FOUNDING_YEAR;
    const currentYear = CURRENT_YEAR;
    
    // Generate years from current year down to school founding year
    const years = Array.from({ length: currentYear - schoolFoundingYear + 1 }, (_, i) => {
      return currentYear - i;
    });

    return (
      <div className="space-y-8">
        {/* School and Year Selectors */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label className="block text-sm font-medium text-white mb-2">Select School</Label>
            <SearchableSchoolSelect
              schools={schools as any}
              value={selectedSchool}
              onValueChange={setSelectedSchool}
              placeholder="Choose a school to view memories..."
            />
          </div>
          <div>
            <Label className="block text-sm font-medium text-white mb-2">Academic Year</Label>
            <Select 
              value={selectedYear} 
              onValueChange={setSelectedYear}
              disabled={!selectedSchool}
            >
              <SelectTrigger className="w-full bg-white/10 backdrop-blur-lg border border-white/20 text-white">
                <SelectValue placeholder={!selectedSchool ? "Select school first" : "Choose year"} />
              </SelectTrigger>
              <SelectContent className="bg-blue-600/60 backdrop-blur-lg border border-white/20 text-white">
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

      {/* Enhanced Photo Gallery */}
      {selectedSchool && (
        <div className="space-y-6">
          {/* Gallery Header with Stats */}
          <div className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl rounded-lg p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-xl font-bold text-white mb-2">
                  {schools.find(s => s.id === selectedSchool)?.name} - {selectedYear}
                </h3>
                <div className="flex items-center space-x-4 text-sm text-white/70">
                  <div className="flex items-center space-x-1">
                    <Images className="h-4 w-4 text-blue-500" />
                    <span className="font-medium">{memories.filter(m => m.mediaType === 'image').length}</span>
                    <span>Photos</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Play className="h-4 w-4 text-green-500" />
                    <span className="font-medium">{memories.filter(m => m.mediaType === 'video').length}</span>
                    <span>Videos</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Calendar className="h-4 w-4 text-purple-500" />
                    <span className="font-medium">{memories.length}</span>
                    <span>Total Memories</span>
                  </div>
                </div>
              </div>
              
            
             
            </div>
          </div>

          {/* Enhanced Filter Controls */}
          <div className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl rounded-lg p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex flex-wrap gap-2">
                <Label className="text-sm font-medium text-white mr-2">Filter by category:</Label>
                {['all', 'sports', 'cultural', 'graduation', 'activities', 'academic'].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setMemoryFilter(filter)}
                    className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                      memoryFilter === filter
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </button>
                ))}
              </div>
              
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Search memories..."
                  className="pl-10 pr-4 py-2 w-48 text-sm bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white"
                />
              </div>
            </div>
          </div>

          {/* Enhanced Photo Grid using PhotoGallery */}
          {memories.length > 0 ? (
            <PhotoGallery 
              memories={memoryFilter === 'all' ? memories : memories.filter(m => m.category === memoryFilter)}
              viewerMode={true}
              onImageClick={handleImageClick}
            />
          ) : (
            <div className="text-center py-12 bg-white/10 backdrop-blur-lg rounded-lg border-2 border-dashed border-white/20">
              <Images className="mx-auto h-12 w-12 text-white/60 mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No memories found</h3>
              <p className="text-white/80">
                {!selectedSchool 
                  ? "Please select a school to view memories" 
                  : `No memories available for ${selectedYear} yet.`
                }
              </p>
            </div>
          )}
        </div>
      )}
    </div>
    );
  };

  const renderAlumniTab = () => {
    // Get verified alumni schools for the dropdown
    const verifiedSchools = alumniBadges.filter(badge => badge.status === 'verified');
    
    // Get all graduation years for selected school (1980 to 2026) + "All" + "Did not graduate"
    const getGraduationYears = () => {
      if (!selectedAlumniSchool) return [];
      
      // First try to find by ID, then by name as fallback
      const selectedSchoolObj = schools.find(s => s.id === selectedAlumniSchool) || 
                                schools.find(s => s.name === selectedAlumniSchool);
      
      // If school not found, use default range
      const startYear = selectedSchoolObj ? Math.max(1980, selectedSchoolObj.yearFounded) : 1980;
      const endYear = CURRENT_YEAR; // Current academic year
      
      // Add "All" option first
      const years = ["all"];
      
      // Generate years in descending order
      const yearList = Array.from({ length: endYear - startYear + 1 }, (_, i) => {
        return (endYear - i).toString();
      });
      
      years.push(...yearList);
      
      // Add "Did not graduate" option
      years.push("did-not-graduate");
      
      return years;
    };

    // Get user's own graduation year for the selected school
    const userGraduationYear = verifiedSchools.find(badge => {
      const school = schools.find(s => s.id === selectedAlumniSchool);
      return school && badge.school === school.name;
    })?.graduationYear;

    // Determine what students to show and how to filter
    let studentsToShow: any[] = [];
    let isUserOwnClass = false;
    
    if (alumniSearchTerm.trim()) {
      // If there's a search term, search across all students from the school
      studentsToShow = allSchoolStudents.filter((student: any) =>
        student.fullName.toLowerCase().includes(alumniSearchTerm.toLowerCase())
      );
    } else if (selectedGraduationYear === "all") {
      // If "all" is selected, show all verified alumni from the school
      studentsToShow = allSchoolStudents;
    } else {
      // If no search term, show students from selected year
      studentsToShow = yearStudents;
      isUserOwnClass = selectedGraduationYear === userGraduationYear;
    }

    // Determine the label based on whether it's user's own graduation year
    const getStudentLabel = () => {
      if (alumniSearchTerm.trim()) {
        return `${studentsToShow.length} Students Found`;
      }
      if (selectedGraduationYear === "all") {
        return `${studentsToShow.length} Verified Alumni`;
      }
      if (selectedGraduationYear === "did-not-graduate") {
        return `${studentsToShow.length} Did Not Graduate`;
      }
      if (isUserOwnClass) {
        return `${studentsToShow.length} Classmates`;
      }
      return `${studentsToShow.length} Alumni Accounts`;
    };

    const filteredClassmates = studentsToShow;

    return (
      <div className="space-y-8">
        {/* Alumni Connection Header */}
        <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
          <CardContent className="p-6">
            <div className="flex items-center space-x-3 mb-6">
              <Users className="h-6 w-6 text-blue-600" />
              <div>
                <h3 className="text-lg font-semibold text-white">Alumni Network</h3>
                <p className="text-sm text-white/70">
                  Connect with your former classmates and explore graduating classes
                </p>
              </div>
            </div>

            {/* School Dropdown */}
            <div className="mb-6">
              <Label className="text-white" htmlFor="alumni-school">Select Your Alumni School</Label>
              <Select 
                value={selectedAlumniSchool} 
                onValueChange={(value) => {
                  setSelectedAlumniSchool(value);
                  setAlumniGraduationYearFilter('all');
                  setAlumniAdmissionYearFilter('all');
                  setShowDidNotGraduate(false);
                  setAlumniSearchTerm('');
                }}
              >
                <SelectTrigger className="bg-white/10 backdrop-blur-lg border border-white/20 text-white">
                  <SelectValue placeholder="Choose a school" />
                </SelectTrigger>
                <SelectContent className="bg-blue-600/60 backdrop-blur-lg border border-white/20 text-white">
                  {verifiedSchools.map((badge) => {
                    const school = schools.find(s => s.name === badge.school);
                    return school ? (
                      <SelectItem className="text-white" key={school.id} value={school.id}>
                        {badge.school}
                      </SelectItem>
                    ) : (
                      <SelectItem className="text-white" key={badge.id} value={badge.school}>
                        {badge.school}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Filter Controls - Only show when school is selected */}
            {selectedAlumniSchool && (
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
                          const selectedSchoolObj = schools.find(s => s.id === selectedAlumniSchool);
                          const foundingYear = selectedSchoolObj?.yearFounded || MIN_FOUNDING_YEAR;
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
                        id="did-not-graduate-viewer"
                        checked={showDidNotGraduate}
                        onCheckedChange={(checked) => setShowDidNotGraduate(checked === true)}
                        className="border-white data-[state=checked]:bg-white data-[state=checked]:text-blue-600"
                        data-testid="checkbox-did-not-graduate"
                      />
                      <Label 
                        htmlFor="did-not-graduate-viewer" 
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
                          const selectedSchoolObj = schools.find(s => s.id === selectedAlumniSchool);
                          const foundingYear = selectedSchoolObj?.yearFounded || MIN_FOUNDING_YEAR;
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
            )}
          </CardContent>
        </Card>

        {/* Students Display */}
        {selectedAlumniSchool && (
          <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
            <CardContent className="p-6">
              {(() => {
                // Get school name for display
                const selectedSchoolObj = schools.find(s => s.id === selectedAlumniSchool);
                const schoolName = selectedSchoolObj?.name || '';
                
                // Use ALL alumni from the selected school (fetched from API)
                const schoolAlumni = schoolAlumniData.filter(badge => badge.status === 'verified');

                if (schoolAlumni.length === 0) {
                  return (
                    <p className="text-blue-200 text-center py-4">No alumni accounts found for this school</p>
                  );
                }

                // Filter alumni based on search term and year filters
                const filteredAlumni = schoolAlumni.filter((badge) => {
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
                  badge.graduationYear && !badge.graduationYear.toString().startsWith("Did not graduate from")
                );
                const nonGraduated = filteredAlumni.filter(badge => 
                  badge.graduationYear && badge.graduationYear.toString().startsWith("Did not graduate from")
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
                          {sortedGraduated.map((badge) => (
                            <Card key={badge.id} className="bg-green-500/10 backdrop-blur-lg border border-green-400/20 shadow-2xl hover:shadow-lg transition-shadow">
                              <CardContent className="p-4">
                                <div className="flex flex-col space-y-3">
                                  <div className="flex items-center space-x-3">
                                    {badge.profileImage ? (
                                      <img 
                                        src={badge.profileImage} 
                                        alt={badge.fullName}
                                        className="w-12 h-12 rounded-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-12 h-12 bg-green-200 rounded-full flex items-center justify-center">
                                        <User className="h-6 w-6 text-green-600" />
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <h4 className="font-semibold text-white text-sm truncate">
                                        {badge.fullName}
                                      </h4>
                                      <p className="text-xs text-green-200">
                                        Class of {badge.graduationYear}
                                      </p>
                                      <p className="text-xs text-green-200">
                                        Admitted: {badge.admissionYear}
                                      </p>
                                    </div>
                                  </div>
                                  
                                  {/* Contact Information */}
                                  <div className="space-y-2 border-t border-green-400/20 pt-3">
                                    <div className="flex items-start space-x-2">
                                      <Mail className="h-4 w-4 text-green-300 mt-0.5 flex-shrink-0" />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs text-green-200 font-medium">Email</p>
                                        {badge.email ? (
                                          <p className="text-sm text-white truncate">{badge.email}</p>
                                        ) : (
                                          <p className="text-sm text-white/40 italic">Not provided</p>
                                        )}
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-start space-x-2">
                                      <Phone className="h-4 w-4 text-green-300 mt-0.5 flex-shrink-0" />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs text-green-200 font-medium">Mobile</p>
                                        {badge.phoneNumber && (badge as any).showPhoneToAlumni !== false ? (
                                          <p className="text-sm text-white">{badge.phoneNumber}</p>
                                        ) : badge.phoneNumber && (badge as any).showPhoneToAlumni === false ? (
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
                          Did Not Graduate from {schoolName} ({sortedNonGraduated.length})
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {sortedNonGraduated.map((badge) => (
                            <Card key={badge.id} className="bg-blue-500/10 backdrop-blur-lg border border-blue-400/20 shadow-2xl hover:shadow-lg transition-shadow">
                              <CardContent className="p-4">
                                <div className="flex flex-col space-y-3">
                                  <div className="flex items-center space-x-3">
                                    {badge.profileImage ? (
                                      <img 
                                        src={badge.profileImage} 
                                        alt={badge.fullName}
                                        className="w-12 h-12 rounded-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-12 h-12 bg-blue-200 rounded-full flex items-center justify-center">
                                        <User className="h-6 w-6 text-blue-600" />
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <h4 className="font-semibold text-white text-sm truncate">
                                        {badge.fullName}
                                      </h4>
                                      <p className="text-xs text-blue-200">
                                        Did not graduate
                                      </p>
                                      <p className="text-xs text-blue-200">
                                        Admitted: {badge.admissionYear}
                                      </p>
                                    </div>
                                  </div>
                                  
                                  {/* Contact Information */}
                                  <div className="space-y-2 border-t border-blue-400/20 pt-3">
                                    <div className="flex items-start space-x-2">
                                      <Mail className="h-4 w-4 text-blue-300 mt-0.5 flex-shrink-0" />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs text-blue-200 font-medium">Email</p>
                                        {badge.email ? (
                                          <p className="text-sm text-white truncate">{badge.email}</p>
                                        ) : (
                                          <p className="text-sm text-white/40 italic">Not provided</p>
                                        )}
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-start space-x-2">
                                      <Phone className="h-4 w-4 text-blue-300 mt-0.5 flex-shrink-0" />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs text-blue-200 font-medium">Mobile</p>
                                        {badge.phoneNumber && (badge as any).showPhoneToAlumni !== false ? (
                                          <p className="text-sm text-white">{badge.phoneNumber}</p>
                                        ) : badge.phoneNumber && (badge as any).showPhoneToAlumni === false ? (
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

        {/* No verified alumni message */}
        {verifiedSchools.length === 0 && (
          <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
            <CardContent className="p-8 text-center">
              <GraduationCap className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">No Verified Alumni Status</h3>
              <p className="text-white/70 mb-4">
                You need to have at least one verified alumni badge to access the Alumni network.
              </p>
              <Button 
                onClick={handleRequestAlumniStatus}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <GraduationCap className="h-4 w-4 mr-2" />
                Request Alumni Status
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    );
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
              <img 
                src={logoImage} 
                alt="Logo" 
                className="w-6 h-6 sm:w-8 sm:h-8 object-contain flex-shrink-0"
              />
              <h1 className="ml-2 sm:ml-3 text-sm sm:text-xl font-semibold text-white truncate">Viewer/Alumni Portal</h1>
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
                  className={`p-4 border-b border-white/20 hover:bg-white/10 transition-colors ${
                    !notification.isRead ? 'bg-blue-500/20' : ''
                  }`}
                  data-testid={`notification-${notification.id}`}
                >
                  <div className="flex items-start space-x-3">
                    <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                      !notification.isRead ? 'bg-blue-500' : 'bg-gray-300'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div onClick={() => {
                        if (!notification.isRead) {
                          handleMarkNotificationRead(notification.id);
                        }
                      }} className="cursor-pointer">
                        <h4 className="text-sm font-medium text-white">
                          {notification.title}
                        </h4>
                        <p className="text-sm text-white/80 mt-1">
                          {notification.message}
                        </p>
                      </div>
                      
                      {/* Special UI for upload code notifications */}
                      {notification.type === 'upload_code_created' && notification.uploadCode && notification.expiresAt && (
                        <div className="mt-3 space-y-2">
                          {/* Upload Code with Copy Button */}
                          <div className="flex items-center gap-2">
                            <code className="flex-1 bg-white/10 px-3 py-2 rounded text-white font-mono text-sm border border-white/20">
                              {notification.uploadCode}
                            </code>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(notification.uploadCode!);
                                toast({
                                  className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
                                  title: "Copied!",
                                  description: "Upload code copied to clipboard",
                                });
                              }}
                              className="text-white hover:bg-white/20"
                              data-testid={`button-copy-code-${notification.id}`}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                          
                          {/* Expiry Countdown */}
                          <ExpiryTimer expiresAt={new Date(notification.expiresAt)} />
                        </div>
                      )}
                      
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
        <div className="hamburger-dropdown fixed top-16 right-4 w-48 bg-blue-600/60 backdrop-blur-lg border border-white/20 rounded-lg shadow-xl z-[999999]">
          <div className="py-1">
            <button
              className="flex items-center w-full px-4 py-2 text-sm text-white hover:bg-white/10 transition-colors"
              onClick={() => {
                setShowHamburgerMenu(false);
                setActiveTab("home");
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


      {/* Desktop Left Sidebar Navigation - Fixed Position */}
      <nav className="hidden lg:flex fixed left-0 top-20 bottom-0 w-64 bg-white/10 backdrop-blur-lg border-r border-white/20 shadow-2xl z-20 flex-col py-6 px-4">
        <div className="flex flex-col gap-3">
          <button
            onClick={() => setActiveTab("home")}
            className={`px-4 py-3 text-sm font-medium rounded-xl flex items-center space-x-3 transition-all duration-300 ${
              activeTab === "home" 
                ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/25" 
                : "bg-white/10 text-blue-100 hover:bg-white/20 hover:text-white"
            }`}
            data-testid="tab-home-desktop"
          >
            <Home className="h-5 w-5" />
            <span>Home</span>
          </button>
          <button
            onClick={() => setActiveTab("search")}
            className={`px-4 py-3 text-sm font-medium rounded-xl flex items-center space-x-3 transition-all duration-300 ${
              activeTab === "search" 
                ? "bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-lg shadow-cyan-500/25" 
                : "bg-white/10 text-blue-100 hover:bg-white/20 hover:text-white"
            }`}
            data-testid="tab-search-desktop"
          >
            <Search className="h-5 w-5" />
            <span>Search</span>
          </button>
          <button
            onClick={() => setActiveTab("library")}
            className={`px-4 py-3 text-sm font-medium rounded-xl flex items-center space-x-3 transition-all duration-300 ${
              activeTab === "library" 
                ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/25" 
                : "bg-white/10 text-blue-100 hover:bg-white/20 hover:text-white"
            }`}
            data-testid="tab-library-desktop"
          >
            <Library className="h-5 w-5" />
            <span>Library</span>
          </button>
          <button
            onClick={() => setActiveTab("profile")}
            className={`px-4 py-3 text-sm font-medium rounded-xl flex items-center space-x-3 transition-all duration-300 ${
              activeTab === "profile" 
                ? "bg-gradient-to-r from-green-500 to-teal-500 text-white shadow-lg shadow-green-500/25" 
                : "bg-white/10 text-blue-100 hover:bg-white/20 hover:text-white"
            }`}
            data-testid="tab-profile-desktop"
          >
            <User className="h-5 w-5" />
            <span>Profile</span>
          </button>
          <button
            onClick={() => setActiveTab("memory-upload")}
            className={`px-4 py-3 text-sm font-medium rounded-xl flex items-center space-x-3 transition-all duration-300 ${
              activeTab === "memory-upload" 
                ? "bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-lg shadow-yellow-500/25" 
                : "bg-white/10 text-blue-100 hover:bg-white/20 hover:text-white"
            }`}
            data-testid="tab-memory-upload-desktop"
          >
            <Upload className="h-5 w-5" />
            <span>Memory Upload</span>
          </button>
          {alumniBadges.some(badge => badge.status === 'verified') && (
            <button
              onClick={() => setActiveTab("alumni")}
              className={`px-4 py-3 text-sm font-medium rounded-xl flex items-center space-x-3 transition-all duration-300 ${
                activeTab === "alumni" 
                  ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/25" 
                  : "bg-white/10 text-blue-100 hover:bg-white/20 hover:text-white"
              }`}
              data-testid="tab-alumni-desktop"
            >
              <Users className="h-5 w-5" />
              <span>Alumni</span>
            </button>
          )}
        </div>
      </nav>

      {/* Mobile Bottom Navigation - Fixed at Bottom of Screen */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/10 backdrop-blur-lg border-t border-white/20 shadow-2xl z-20">
        <div className="flex justify-around items-center px-2 py-3">
          <button
            onClick={() => setActiveTab("home")}
            className={`flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-all duration-300 ${
              activeTab === "home" 
                ? "text-white" 
                : "text-blue-200"
            }`}
            data-testid="tab-home-mobile"
          >
            <Home className={`h-6 w-6 mb-1 ${activeTab === "home" ? "text-blue-400" : ""}`} />
            <span className="text-xs">Home</span>
          </button>
          <button
            onClick={() => setActiveTab("search")}
            className={`flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-all duration-300 ${
              activeTab === "search" 
                ? "text-white" 
                : "text-blue-200"
            }`}
            data-testid="tab-search-mobile"
          >
            <Search className={`h-6 w-6 mb-1 ${activeTab === "search" ? "text-cyan-400" : ""}`} />
            <span className="text-xs">Search</span>
          </button>
          <button
            onClick={() => setActiveTab("library")}
            className={`flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-all duration-300 ${
              activeTab === "library" 
                ? "text-white" 
                : "text-blue-200"
            }`}
            data-testid="tab-library-mobile"
          >
            <Library className={`h-6 w-6 mb-1 ${activeTab === "library" ? "text-purple-400" : ""}`} />
            <span className="text-xs">Library</span>
          </button>
          <button
            onClick={() => setActiveTab("profile")}
            className={`flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-all duration-300 ${
              activeTab === "profile" 
                ? "text-white" 
                : "text-blue-200"
            }`}
            data-testid="tab-profile-mobile"
          >
            <User className={`h-6 w-6 mb-1 ${activeTab === "profile" ? "text-green-400" : ""}`} />
            <span className="text-xs">Profile</span>
          </button>
          <button
            onClick={() => setActiveTab("memory-upload")}
            className={`flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-all duration-300 ${
              activeTab === "memory-upload" 
                ? "text-white" 
                : "text-blue-200"
            }`}
            data-testid="tab-memory-upload-mobile"
          >
            <Upload className={`h-6 w-6 mb-1 ${activeTab === "memory-upload" ? "text-yellow-400" : ""}`} />
            <span className="text-xs">Upload</span>
          </button>
          {alumniBadges.some(badge => badge.status === 'verified') && (
            <button
              onClick={() => setActiveTab("alumni")}
              className={`flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-all duration-300 ${
                activeTab === "alumni" 
                  ? "text-white" 
                  : "text-blue-200"
              }`}
              data-testid="tab-alumni-mobile"
            >
              <Users className={`h-6 w-6 mb-1 ${activeTab === "alumni" ? "text-indigo-400" : ""}`} />
              <span className="text-xs">Alumni</span>
            </button>
          )}
        </div>
      </nav>

      {/* Main Content Area - Adjusted for Fixed Navigation */}
      <div className="lg:ml-64 pb-20 lg:pb-8">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-6 sm:py-8 relative z-10">
        {/* Tab Content */}
        {activeTab === "home" ? renderHomeTab() : 
         activeTab === "search" ? renderSearchTab() :
         activeTab === "library" ? renderLibraryTab() : 
         activeTab === "alumni" ? renderAlumniTab() :
         activeTab === "memory-upload" ? renderMemoryUploadTab() :
         renderProfileTab()}
      </div>

      {/* Fullscreen Image Viewer */}
      {isModalOpen && selectedImageIndex >= 0 && memories[selectedImageIndex] && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          {/* Close Button */}
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-4 right-4 z-20 bg-black/50 text-white hover:bg-black/70 rounded-full"
            onClick={closeModal}
          >
            <X className="h-4 w-4" />
          </Button>

          {/* Image Container - True Fullscreen */}
          <div 
            className="relative flex-1 flex items-center justify-center bg-black overflow-hidden cursor-grab"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ cursor: isDragging ? 'grabbing' : zoomLevel > 1 ? 'grab' : 'default' }}
          >
            <img
              src={getMemoryImageUrl(memories[selectedImageIndex].imageUrl) || '/placeholder-image.jpg'}
              alt={memories[selectedImageIndex].title}
              className="max-w-full max-h-full object-contain transition-transform duration-200"
              style={{ 
                transform: `scale(${zoomLevel}) translate(${imagePosition.x / zoomLevel}px, ${imagePosition.y / zoomLevel}px)`,
              }}
              draggable={false}
            />

            {/* Zoom Controls */}
            <div className="absolute top-4 left-4 flex flex-col gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="bg-black/50 text-white hover:bg-black/70 rounded-full w-10 h-10 p-0"
                onClick={zoomIn}
                disabled={zoomLevel >= 3}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="bg-black/50 text-white hover:bg-black/70 rounded-full w-10 h-10 p-0"
                onClick={zoomOut}
                disabled={zoomLevel <= 0.5}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="bg-black/50 text-white hover:bg-black/70 rounded-full w-10 h-10 p-0"
                onClick={resetZoom}
                disabled={zoomLevel === 1}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>

            {/* Navigation Buttons */}
            {selectedImageIndex > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black/50 text-white hover:bg-black/70 rounded-full w-12 h-12"
                onClick={navigateToPrevious}
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
            )}

            {selectedImageIndex < memories.length - 1 && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black/50 text-white hover:bg-black/70 rounded-full w-12 h-12"
                onClick={navigateToNext}
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            )}
          </div>

          {/* Bottom Info Bar */}
          <div className="bg-black/90 text-white px-6 py-4 flex items-center justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-semibold">{memories[selectedImageIndex].title}</h3>
              <p className="text-sm text-gray-300 mt-1">{memories[selectedImageIndex].description}</p>
              <div className="flex items-center space-x-4 mt-2 text-xs text-gray-400">
                <span className="flex items-center space-x-1">
                  <Calendar className="h-3 w-3" />
                  <span>{memories[selectedImageIndex].eventDate}</span>
                </span>
                {memories[selectedImageIndex].category && (
                  <span className="capitalize">{memories[selectedImageIndex].category.replace('_', ' ')}</span>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-xs text-gray-400 ml-4 flex-shrink-0">
                {selectedImageIndex + 1} of {memories.length}
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
      </div>

      <AlumniRequestDialog
        open={showAlumniRequestDialog}
        onClose={() => setShowAlumniRequestDialog(false)}
        initialSchoolId={alumniRequestInitialSchool}
      />
    </div>
  );
}