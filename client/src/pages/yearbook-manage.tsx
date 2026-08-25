import { useState, useEffect, useCallback, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getSecureImageUrl } from "@/lib/secure-image";
import { ArrowLeft, Upload, Plus, Trash2, Settings, Eye, BookOpen, FileText, Layers, Send as Publish, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Edit, Menu, ShoppingCart, LogOut, Home, Undo2, GripVertical, DollarSign, Check, X, AlertCircle, Bell } from "lucide-react";
import type { Notification } from "@shared/schema";
import { BETA_VERSION } from "@shared/constants";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  MeasuringStrategy,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';


// Navigation utility import - placed after other imports
const navigateToSchoolDashboardYears = (setLocation: any) => {
  setLocation("/school-dashboard?tab=years");
};

interface User {
  id: string;
  username: string;
  userType: "school" | "viewer" | "student";
  fullName: string;
}

interface School {
  id: string;
  name: string;
  yearFounded: number;
}

interface YearbookPage {
  id: string;
  yearbookId: string;
  pageNumber: number;
  title: string;
  imageUrl: string;
  pageType: "front_cover" | "back_cover" | "content";
  status: "published" | "draft" | "draft_deleted";
  pdfUploadBatchId?: string;
  createdAt: Date;
}

interface TableOfContentsItem {
  id: string;
  yearbookId: string;
  title: string;
  pageNumber: number;
  description?: string;
  createdAt: Date;
}

interface Yearbook {
  id: string;
  schoolId: string;
  year: number;
  title: string;
  isPublished: boolean;
  isInitialized?: boolean; // Tracks if yearbook setup (orientation and upload type) has been completed
  isFree?: boolean; // Whether yearbook is free for all viewers
  frontCoverUrl?: string;
  backCoverUrl?: string;
  orientation?: string | null; // legacy field, kept for backward compat
  uploadType?: string | null; // 'image', 'pdf', null (not selected)
  detectedAspectRatio?: string | null; // Auto-detected float ratio (width/height) from first upload, e.g. "0.7500"
  price?: string; // Yearbook price as string (e.g., "14.99")
  hasUnsavedDrafts?: boolean; // Track if there are unsaved draft changes
  pages: YearbookPage[];
  tableOfContents: TableOfContentsItem[];
  createdAt: Date;
  publishedAt?: Date;
}

export default function YearbookManage() {
  const [, params] = useRoute("/yearbook-manage/:year");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Drag and drop state
  const [activePageId, setActivePageId] = useState<string | null>(null);
  
  // Manual page assignment state
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [tempPageNumber, setTempPageNumber] = useState<number>(0);
  
  // Autoscroll state
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const previewThumbsRef = useRef<HTMLDivElement>(null);
  const [overId, setOverId] = useState<string | null>(null);
  
  // Set up sensors for drag and drop with enhanced responsiveness
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Minimum drag distance to activate (prevents accidental drags)
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Measuring configuration for better performance
  const measuringConfig = {
    droppable: {
      strategy: MeasuringStrategy.Always,
    },
  };
  
  // Autoscroll hook - handles scrolling when dragging near edges (touch & pointer aware)
  useEffect(() => {
    if (!activePageId || !scrollContainerRef.current) return;
    
    let animationFrameId: number;
    const scrollSpeed = 8; // Pixels per frame
    const scrollZone = 80; // Pixels from edge to trigger scroll
    
    const handleAutoScroll = (e: PointerEvent) => {
      const container = scrollContainerRef.current;
      if (!container) return;
      
      const rect = container.getBoundingClientRect();
      const y = e.clientY - rect.top;
      
      // Cancel any existing animation frame
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      
      const scroll = () => {
        if (!container) return;
        
        // Scroll up when near top
        if (y < scrollZone && container.scrollTop > 0) {
          const distance = Math.max(1, (scrollZone - y) / scrollZone);
          container.scrollTop -= scrollSpeed * distance;
          animationFrameId = requestAnimationFrame(scroll);
        }
        // Scroll down when near bottom
        else if (y > rect.height - scrollZone && container.scrollTop < container.scrollHeight - container.clientHeight) {
          const distance = Math.max(1, (y - (rect.height - scrollZone)) / scrollZone);
          container.scrollTop += scrollSpeed * distance;
          animationFrameId = requestAnimationFrame(scroll);
        }
      };
      
      scroll();
    };
    
    // Use pointermove for both mouse and touch support
    document.addEventListener('pointermove', handleAutoScroll as any);
    
    return () => {
      document.removeEventListener('pointermove', handleAutoScroll as any);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [activePageId]);
  
  const year = params?.year;
  const schoolId = new URLSearchParams(window.location.search).get("school");
  
  const [user, setUser] = useState<User | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showTOCDialog, setShowTOCDialog] = useState(false);
  const [selectedPageType, setSelectedPageType] = useState<"front_cover" | "back_cover" | "content">("content");
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{
    isProcessingPDF: boolean;
    currentFile: string;
    totalFiles: number;
    currentFileIndex: number;
    pdfPageCount?: number;
  }>({
    isProcessingPDF: false,
    currentFile: "",
    totalFiles: 0,
    currentFileIndex: 0
  });
  
  // Enhanced upload progress tracking per file
  const [fileUploadProgress, setFileUploadProgress] = useState<Map<string, {
    file: File;
    progress: number;
    status: 'pending' | 'uploading' | 'completed' | 'failed';
    error?: string;
  }>>(new Map());
  
  const [isUploading, setIsUploading] = useState(false);
  const [newTOCItem, setNewTOCItem] = useState({
    title: "",
    pageNumber: null as number | null,
    description: ""
  });
  
  // Setup state for when yearbook record doesn't exist yet (beta unlock recovery)
  const [setupUploadType, setSetupUploadType] = useState<'image' | 'pdf' | null>(null);

  // Settings dialog — aspect ratio selection
  const [settingsAspectRatio, setSettingsAspectRatio] = useState<string | null>(null);
  const [customWidth, setCustomWidth] = useState<string>('');
  const [customHeight, setCustomHeight] = useState<string>('');
  const [customModeActive, setCustomModeActive] = useState<boolean>(false);

  const PRESET_RATIOS = ['3/4', '9/16', '1/1', '4/3', '16/9'] as const;
  const isCustomRatio = (r: string | null): boolean =>
    !!r && !(PRESET_RATIOS as readonly string[]).includes(r);

  // Track navigation history for back button
  const [hasNavigationHistory, setHasNavigationHistory] = useState(false);
  
  // Track unsaved changes (only for published yearbooks)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [pendingTOCItems, setPendingTOCItems] = useState<any[]>([]);
  const [pendingPageUploads, setPendingPageUploads] = useState<any[]>([]);
  
  // Hamburger menu state
  const [showHamburgerMenu, setShowHamburgerMenu] = useState(false);
  
  // Notification state
  const [showNotifications, setShowNotifications] = useState(false);
  
  // TOC editing state
  const [editingTOCId, setEditingTOCId] = useState<string | null>(null);
  const [editingTOCData, setEditingTOCData] = useState({
    title: "",
    pageNumber: 1,
    description: ""
  });
  
  // Price management state
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [priceInput, setPriceInput] = useState("");
  const [showPriceConfirmDialog, setShowPriceConfirmDialog] = useState(false);
  const [showDeleteAllPagesDialog, setShowDeleteAllPagesDialog] = useState(false);
  
  // PDF deletion confirmation state
  const [showDeletePdfDialog, setShowDeletePdfDialog] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [pdfBatchIdToDelete, setPdfBatchIdToDelete] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  
  // Auto-save state
  const [lastAutoSaved, setLastAutoSaved] = useState<Date | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  
  // Settings dialog state
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [isFreeYearbook, setIsFreeYearbook] = useState(false);
  const [pendingUploadType, setPendingUploadType] = useState<string | null>(null);
  const [showUploadTypeConfirm, setShowUploadTypeConfirm] = useState(false);

  // Live preview state
  const [previewCurrentIndex, setPreviewCurrentIndex] = useState(0);

  useEffect(() => {
    const container = previewThumbsRef.current;
    if (!container) return;
    const activeThumb = container.children[previewCurrentIndex] as HTMLElement;
    if (!activeThumb) return;
    const containerCenter = container.offsetWidth / 2;
    const thumbCenter = activeThumb.offsetLeft + activeThumb.offsetWidth / 2;
    container.scrollTo({ left: thumbCenter - containerCenter, behavior: 'smooth' });
  }, [previewCurrentIndex]);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      setUser(JSON.parse(userData));
    } else {
      setLocation("/");
    }
    
    // Check if there's navigation history
    setHasNavigationHistory(window.history.length > 1);
  }, [setLocation]);
  
  // Add beforeunload warning when uploading or has unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isUploading || hasUnsavedChanges) {
        e.preventDefault();
        const message = isUploading 
          ? 'Your uploads are still in progress. Are you sure you want to leave?'
          : 'You have unsaved changes. Are you sure you want to leave this page?';
        e.returnValue = message;
        return e.returnValue;
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isUploading, hasUnsavedChanges]);

  const handleBackNavigation = () => {
    // Navigate specifically to school dashboard with years tab active
    navigateToSchoolDashboardYears(setLocation);
  };

  // Fetch school data
  const { data: school } = useQuery<School>({
    queryKey: ["/api/schools", schoolId],
    enabled: !!schoolId,
  });

  // Fetch notifications (school users don't get alumni notifications)
  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['/api/notifications', user?.id],
    enabled: !!user && user?.userType !== "viewer",
    refetchInterval: 30000,
  });

  const unreadNotificationCount = notifications.filter(n => !n.isRead).length;

  // Notification mutations
  const markNotificationReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      await apiRequest("PATCH", `/api/notifications/${notificationId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications', user?.id] });
    },
  });

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

  const handleMarkNotificationRead = (notificationId: string) => {
    markNotificationReadMutation.mutate(notificationId);
  };

  const handleClearAllNotifications = () => {
    clearAllNotificationsMutation.mutate();
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

  // Fetch yearbook data
  const { data: yearbook, isLoading, error: yearbookError } = useQuery<Yearbook>({
    queryKey: ["/api/yearbooks", schoolId, year],
    enabled: !!schoolId && !!year,
    queryFn: async () => {
      const res = await fetch(`/api/yearbooks/${schoolId}/${year}`);
      if (!res.ok) {
        throw new Error("Yearbook not found. Please purchase this year first.");
      }
      return res.json();
    },
    retry: false, // Don't retry failed requests to avoid cache issues
    refetchOnWindowFocus: false, // Prevent unnecessary refetches
  });

  // Initialize price input when yearbook loads
  useEffect(() => {
    if (yearbook?.price) {
      setPriceInput(yearbook.price);
    }
  }, [yearbook?.price]);

  // Sync settingsAspectRatio with loaded yearbook data
  useEffect(() => {
    if (yearbook?.detectedAspectRatio !== undefined) {
      const r = yearbook.detectedAspectRatio || null;
      setSettingsAspectRatio(r);
      if (r && isCustomRatio(r)) {
        const parts = r.split('/');
        if (parts.length === 2) {
          setCustomWidth(parts[0]);
          setCustomHeight(parts[1]);
          setCustomModeActive(true);
        }
      } else {
        setCustomModeActive(false);
      }
    }
  }, [yearbook?.detectedAspectRatio]);

  // Sync frontend unsaved changes state with backend hasUnsavedDrafts field
  useEffect(() => {
    if (yearbook?.hasUnsavedDrafts && !hasUnsavedChanges) {
      setHasUnsavedChanges(true);
    } else if (!yearbook?.hasUnsavedDrafts && hasUnsavedChanges && pendingPageUploads.length === 0 && pendingTOCItems.length === 0) {
      setHasUnsavedChanges(false);
    }
  }, [yearbook?.hasUnsavedDrafts, hasUnsavedChanges, pendingPageUploads.length, pendingTOCItems.length]);

  // Sync free status with yearbook data
  useEffect(() => {
    if (yearbook?.isFree !== undefined) {
      setIsFreeYearbook(yearbook.isFree);
    }
  }, [yearbook?.isFree]);

  // Fetch price history
  const { data: priceHistory = [] } = useQuery({
    queryKey: ["/api/yearbooks", yearbook?.id, "price-history"],
    enabled: !!yearbook?.id,
    queryFn: async () => {
      const res = await fetch(`/api/yearbooks/${yearbook?.id}/price-history`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Check if price can be increased (30-day cooldown)
  const { data: canIncreasePrice } = useQuery({
    queryKey: ["/api/yearbooks", yearbook?.id, "can-increase-price"],
    enabled: !!yearbook?.id && isEditingPrice,
    queryFn: async () => {
      const res = await fetch(`/api/yearbooks/${yearbook?.id}/can-increase-price`);
      if (!res.ok) return { canIncrease: true };
      return res.json();
    },
  });

  // Update price mutation
  const updatePriceMutation = useMutation({
    mutationFn: async ({ yearbookId, price }: { yearbookId: string; price: string }) => {
      const response = await apiRequest("PATCH", `/api/yearbooks/${yearbookId}/price`, {
        price,
        userId: user?.id,
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/yearbooks", schoolId, year] });
      queryClient.invalidateQueries({ queryKey: ["/api/yearbooks", yearbook?.id, "price-history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/yearbooks", yearbook?.id, "can-increase-price"] });
      setIsEditingPrice(false);
      toast({ 
        className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Price updated successfully",
        description: `Yearbook price is now $${priceInput}`,
      });
    },
    onError: (error: any) => {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Failed to update price",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  // Update free status mutation
  const updateFreeStatusMutation = useMutation({
    mutationFn: async ({ yearbookId, isFree }: { yearbookId: string; isFree: boolean }) => {
      const response = await apiRequest("PATCH", `/api/yearbooks/${yearbookId}/free-status`, {
        isFree,
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/yearbooks", schoolId, year] });
      toast({ 
        className: "bg-green-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Setting updated",
        description: data.isFree ? "This yearbook is now accessible to all logged-in users without payment." : "This yearbook will now require purchase to view.",
      });
    },
    onError: (error: any) => {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Failed to update setting",
        description: error.message || "Please try again",
        variant: "destructive",
      });
      setIsFreeYearbook(!isFreeYearbook);
    },
  });

  // Upload page mutation
  const uploadPageMutation = useMutation({
    mutationFn: async ({ file, pageType, title, yearbookId }: { file: File; pageType: string; title: string; yearbookId: string }) => {
      // Set progress for PDF processing
      if (file.type === 'application/pdf') {
        setUploadProgress(prev => ({ 
          ...prev, 
          isProcessingPDF: true, 
          currentFile: file.name 
        }));
      }
      
      // For covers, always upload immediately to enable replacement, even for published yearbooks
      if (pageType === "front_cover" || pageType === "back_cover") {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("pageType", pageType);
        formData.append("title", title);
        
        const response = await fetch(`/api/yearbooks/${yearbookId}/upload-page`, {
          method: "POST",
          body: formData,
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          if (file.type === 'application/pdf') {
            throw new Error(errorData.message || "PDF processing failed. Please ensure the PDF is not password-protected and contains valid pages.");
          }
          throw new Error(errorData.message || "Upload failed");
        }
        
        const result = await response.json();
        
        // Reset PDF processing state
        if (file.type === 'application/pdf') {
          setUploadProgress(prev => ({ ...prev, isProcessingPDF: false }));
        }
        
        return result;
      }
      
      // For PDF upload type, always upload immediately (live changes)
      // For image upload type with published yearbook, queue for "Save Changes"
      if (yearbook?.isPublished && yearbook?.uploadType !== 'pdf') {
        // Create a local URL for immediate preview
        const tempUrl = URL.createObjectURL(file);
        setPendingPageUploads(prev => [...prev, { 
          file, 
          pageType, 
          title, 
          tempId: Date.now(),
          tempUrl, // Add temp URL for immediate preview
          pageNumber: pageType === "content" ? (yearbook?.pages?.filter(p => p.pageType === "content")?.length || 0) + prev.filter(p => p.pageType === "content").length + 1 : 0
        }]);
        setHasUnsavedChanges(true);
        return Promise.resolve({ tempId: Date.now() });
      }
      
      // For unpublished yearbooks, upload immediately
      const formData = new FormData();
      formData.append("file", file);
      formData.append("pageType", pageType);
      formData.append("title", title);
      
      const response = await fetch(`/api/yearbooks/${yearbookId}/upload-page`, {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Check for specific PDF_ALREADY_EXISTS error
        if (errorData.error === "PDF_ALREADY_EXISTS") {
          throw new Error(errorData.message || "A PDF has already been uploaded. Please delete existing pages first.");
        }
        
        if (file.type === 'application/pdf') {
          throw new Error(errorData.message || "PDF processing failed. Please ensure the PDF is not password-protected and contains valid pages.");
        }
        
        throw new Error(errorData.message || "Upload failed");
      }
      return response.json();
    },
    onSuccess: (data, variables) => {
      // Always refresh UI when covers are uploaded (since they upload immediately)
      // For content pages, only refresh for unpublished yearbooks
      const isCover = variables.pageType === "front_cover" || variables.pageType === "back_cover";
      if (isCover || !yearbook?.isPublished) {
        queryClient.invalidateQueries({ queryKey: ["/api/yearbooks", schoolId, year] });
      }
      
      // Reset PDF processing state
      setUploadProgress({
        isProcessingPDF: false,
        currentFile: "",
        totalFiles: 0,
        currentFileIndex: 0
      });
      
      // Check if it was a PDF that got processed into multiple pages
      if (variables.file?.type === 'application/pdf' && data?.pagesCreated) {
        toast({ 
          className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
          title: "PDF uploaded successfully!", 
          description: `Extracted ${data.pagesCreated} page${data.pagesCreated > 1 ? 's' : ''} from ${variables.file.name}` 
        });
      } else {
        const uploadType = isCover ? "Cover" : "Page";
        toast({
          className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
          title: `${uploadType} uploaded successfully!` });
      }
      
      // Reset file input
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
      
      setShowUploadDialog(false);
      setUploadingFiles([]);
    },
    onError: (error: any) => {
      // Reset PDF processing state
      setUploadProgress({
        isProcessingPDF: false,
        currentFile: "",
        totalFiles: 0,
        currentFileIndex: 0
      });
      
      const errorMessage = error?.message || "Upload failed";
      
      // Show specific message for PDF already exists error
      if (errorMessage.includes("already been uploaded") || errorMessage.includes("delete existing pages")) {
        toast({ 
          className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
          title: "PDF Already Uploaded", 
          description: errorMessage,
          variant: "destructive",
        });
      } else {
        toast({ 
          className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
          title: "Upload failed", 
          description: errorMessage.includes("PDF") ? errorMessage : "Please try again.", 
          variant: "destructive" 
        });
      }
    },
  });

  // Add table of contents item mutation
  const addTOCMutation = useMutation({
    mutationFn: async (tocData: typeof newTOCItem) => {
      // If yearbook is published, queue the change for "Save Changes"
      if (yearbook?.isPublished) {
        setPendingTOCItems(prev => [...prev, { ...tocData, tempId: Date.now() }]);
        setHasUnsavedChanges(true);
        return Promise.resolve({ tempId: Date.now() });
      }
      
      // For unpublished yearbooks, add immediately
      return apiRequest("POST", `/api/yearbooks/${yearbook?.id}/table-of-contents`, {
        ...tocData,
        yearbookId: yearbook?.id
      });
    },
    onSuccess: () => {
      if (!yearbook?.isPublished) {
        queryClient.invalidateQueries({ queryKey: ["/api/yearbooks", schoolId, year] });
      }
      toast({
        className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Table of contents item added!" });
      setShowTOCDialog(false);
      setNewTOCItem({ title: "", pageNumber: null, description: "" });
    },
  });

  // Update TOC item mutation
  const updateTOCMutation = useMutation({
    mutationFn: async ({ tocId, updates }: { tocId: string, updates: any }) => {
      return apiRequest("PATCH", `/api/yearbooks/table-of-contents/${tocId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/yearbooks", schoolId, year] });
      toast({ 
        className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Table of contents item updated!" });
      setEditingTOCId(null);
    },
    onError: () => {
      toast({ title: "Update failed", description: "Please try again.", variant: "destructive" });
    },
  });

  // Delete TOC item mutation
  const deleteTOCMutation = useMutation({
    mutationFn: async (tocId: string) => {
      return apiRequest("DELETE", `/api/yearbooks/table-of-contents/${tocId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/yearbooks", schoolId, year] });
      toast({
        className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Table of contents item deleted!" });
    },
    onError: () => {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Delete failed", description: "Please try again.", variant: "destructive" });
    },
  });

  // Publish yearbook mutation
  const publishMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/yearbooks/${yearbook?.id}/publish`, {
        isPublished: true
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/yearbooks", schoolId, year] });
      toast({ 
        className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Yearbook published successfully!", description: "Viewers can now access this yearbook." });
    },
    onError: () => {
      toast({ 
        className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Publish failed", description: "Please ensure you have uploaded front and back covers.", variant: "destructive" });
    },
  });

  // Delete page mutation with optimistic updates for instant feedback
  const deletePageMutation = useMutation({
    mutationFn: async (pageId: string) => {
      // Get the page to be deleted to know its type and page number
      const allPages = yearbook?.pages || [];
      const deletedPage = allPages.find(p => p.id === pageId);
      
      // First delete the page
      await apiRequest("DELETE", `/api/yearbooks/pages/${pageId}`);
      
      // Only renumber if it was a content page (not covers)
      if (deletedPage && deletedPage.pageType === "content") {
        const contentPages = allPages.filter(p => p.pageType === "content").sort((a, b) => a.pageNumber - b.pageNumber);
        const pagesToRenumber = contentPages.filter(p => p.pageNumber > deletedPage.pageNumber);
        
        // Renumber each page sequentially to close the gap
        for (const page of pagesToRenumber) {
          await apiRequest("PATCH", `/api/yearbooks/pages/${page.id}/reorder`, {
            pageNumber: page.pageNumber - 1
          });
        }
      }
      
      return pageId;
    },
    onMutate: async (pageId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["/api/yearbooks", schoolId, year] });
      
      // Snapshot the previous value
      const previousYearbook = queryClient.getQueryData(["/api/yearbooks", schoolId, year]);
      
      // Optimistically update the page status
      queryClient.setQueryData(["/api/yearbooks", schoolId, year], (old: any) => {
        if (!old) return old;
        
        // For published yearbooks, mark as draft_deleted; for unpublished, remove immediately
        if (yearbook?.isPublished) {
          return {
            ...old,
            pages: old.pages.map((page: any) => 
              page.id === pageId 
                ? { ...page, status: 'draft_deleted' }
                : page
            )
          };
        } else {
          // For unpublished yearbooks, remove the page from the list
          return {
            ...old,
            pages: old.pages.filter((page: any) => page.id !== pageId)
          };
        }
      });
      
      // Mark as having unsaved changes if published AND not PDF type (PDF changes are live)
      if (yearbook?.isPublished && yearbook?.uploadType !== 'pdf') {
        setHasUnsavedChanges(true);
      }
      
      return { previousYearbook };
    },
    onSuccess: (_, pageId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/yearbooks", schoolId, year] });
      const allPages = yearbook?.pages || [];
      const deletedPage = allPages.find(p => p.id === pageId);
      const pageType = deletedPage?.pageType;
      
      if (pageType === "front_cover" || pageType === "back_cover") {
        const coverType = pageType === "front_cover" ? "Front cover" : "Back cover";
        toast({
          className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
          title: `${coverType} deleted successfully!`, description: "You can upload a new one when ready." });
      } else {
        toast({
          className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
          title: "Page deleted and pages renumbered!" });
      }
    },
    onError: (_error, _variables, context) => {
      // Rollback on error
      if (context?.previousYearbook) {
        queryClient.setQueryData(["/api/yearbooks", schoolId, year], context.previousYearbook);
      }
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Delete failed", description: "Please try again.", variant: "destructive" });
    },
  });

  // Verify password mutation
  const verifyPasswordMutation = useMutation({
    mutationFn: async (password: string) => {
      const userData = localStorage.getItem("user");
      const userId = userData ? JSON.parse(userData).id : null;
      return apiRequest("POST", "/api/auth/verify-password", { password, userId });
    },
  });

  // Delete PDF batch mutation
  const deletePdfBatchMutation = useMutation({
    mutationFn: async (batchId: string) => {
      return apiRequest("DELETE", `/api/yearbooks/pdf-batch/${batchId}`, {});
    },
    onSuccess: (_, batchId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/yearbooks", schoolId, year] });
      setShowDeletePdfDialog(false);
      setDeletePassword("");
      setPdfBatchIdToDelete(null);
      toast({
        className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "PDF upload deleted successfully!",
        description: "All pages from this PDF have been removed."
      });
    },
    onError: () => {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Delete failed",
        description: "Failed to delete PDF upload. Please try again.",
        variant: "destructive"
      });
    },
  });

  // Reset upload type mutation — deletes all pages and switches the upload type
  const resetUploadTypeMutation = useMutation({
    mutationFn: async (newUploadType: string) => {
      return apiRequest("DELETE", `/api/yearbooks/${yearbook?.id}/reset-upload-type`, { newUploadType });
    },
    onSuccess: (_, newUploadType) => {
      queryClient.invalidateQueries({ queryKey: ["/api/yearbooks", schoolId, year] });
      setShowUploadTypeConfirm(false);
      setPendingUploadType(null);
      setShowSettingsDialog(false);
      toast({
        className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Upload type changed",
        description: `Switched to ${newUploadType === 'pdf' ? 'PDF' : 'Image'} upload. All previous content has been deleted.`,
      });
    },
    onError: () => {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Failed to change upload type",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete all content pages mutation
  const deleteAllPagesMutation = useMutation({
    mutationFn: async () => {
      const contentPages = yearbook?.pages?.filter(p => p.pageType === "content") || [];
      // Delete all content pages sequentially
      for (const page of contentPages) {
        await apiRequest("DELETE", `/api/yearbooks/pages/${page.id}`);
      }
      return { deletedCount: contentPages.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/yearbooks", schoolId, year] });
      toast({
        className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "All pages deleted",
        description: `Successfully deleted ${data.deletedCount} content page${data.deletedCount !== 1 ? 's' : ''}.`,
      });
      setShowDeleteAllPagesDialog(false);
    },
    onError: (error: any) => {
      console.error("Error deleting all pages:", error);
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Error",
        description: error.message || "Failed to delete all pages. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Save changes mutation (for published yearbooks)
  const saveChangesMutation = useMutation({
    mutationFn: async () => {
      // Apply all pending page uploads WITH their custom page numbers
      for (const upload of pendingPageUploads) {
        const formData = new FormData();
        formData.append("file", upload.file);
        formData.append("pageType", upload.pageType);
        formData.append("title", upload.title);
        // Send the page number so it's preserved after reordering
        formData.append("pageNumber", upload.pageNumber.toString());
        
        const response = await fetch(`/api/yearbooks/${yearbook?.id}/upload-page`, {
          method: "POST",
          body: formData,
        });
        
        if (!response.ok) throw new Error(`Upload failed for ${upload.title}`);
      }
      
      // Apply all pending TOC items
      for (const tocItem of pendingTOCItems) {
        await apiRequest("POST", `/api/yearbooks/${yearbook?.id}/table-of-contents`, {
          ...tocItem,
          yearbookId: yearbook?.id
        });
      }
      
      // Publish all drafts to make them live
      const result = await apiRequest("POST", `/api/yearbooks/${yearbook?.id}/publish-drafts`, {});
      
      return result;
    },
    onSuccess: () => {
      setPendingPageUploads([]);
      setPendingTOCItems([]);
      setHasUnsavedChanges(false);
      // Force refetch to ensure UI shows published status immediately
      queryClient.invalidateQueries({ queryKey: ["/api/yearbooks", schoolId, year] });
      queryClient.refetchQueries({ queryKey: ["/api/yearbooks", schoolId, year] });
      toast({ 
        className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "All changes saved successfully!" 
      });
    },
    onError: (error) => {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Save failed", description: "Some changes could not be saved. Please try again.", variant: "destructive" });
    },
  });

  // Discard changes mutation (for published yearbooks)
  const discardChangesMutation = useMutation({
    mutationFn: async () => {
      // Call backend to discard all drafts
      const result = await apiRequest("POST", `/api/yearbooks/${yearbook?.id}/discard-drafts`, {});
      return result;
    },
    onSuccess: () => {
      // Reset local pending state
      setPendingPageUploads([]);
      setPendingTOCItems([]);
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: ["/api/yearbooks", schoolId, year] });
      toast({ 
        className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Changes discarded", 
        description: "All unsaved changes have been reverted." 
      });
    },
    onError: (error) => {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Discard failed", 
        description: "Could not discard changes. Please try again.", 
        variant: "destructive" 
      });
    },
  });

  // Auto-save mutation
  const autoSaveMutation = useMutation({
    mutationFn: async () => {
      if (!yearbook?.id || !hasUnsavedChanges) return;
      
      // Update draft timestamp on backend
      const result = await apiRequest("PATCH", `/api/yearbooks/${yearbook.id}/auto-save`, {
        isAutoSave: true
      });
      return result;
    },
    onSuccess: () => {
      const now = new Date();
      setLastAutoSaved(now);
      setIsAutoSaving(false);
    },
    onError: () => {
      setIsAutoSaving(false);
    },
  });

  // Auto-save effect - runs every 60 seconds when there are unsaved changes
  useEffect(() => {
    if (!yearbook?.isPublished || !hasUnsavedChanges) {
      return; // Only auto-save for published yearbooks with unsaved changes
    }

    // Auto-save every 60 seconds (1 minute)
    const autoSaveInterval = setInterval(() => {
      if (hasUnsavedChanges && !isAutoSaving && !saveChangesMutation.isPending) {
        setIsAutoSaving(true);
        autoSaveMutation.mutate();
      }
    }, 60000); // 60 seconds

    return () => clearInterval(autoSaveInterval);
  }, [yearbook?.isPublished, hasUnsavedChanges, isAutoSaving, saveChangesMutation.isPending, autoSaveMutation]);

  // Reorder page mutation
  const reorderPageMutation = useMutation({
    mutationFn: async ({ pageId, newPageNumber }: { pageId: string, newPageNumber: number }) => {
      return apiRequest("PATCH", `/api/yearbooks/pages/${pageId}/reorder`, {
        pageNumber: newPageNumber
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/yearbooks", schoolId, year] });
      toast({
        className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Page order updated successfully!" });
    },
    onError: () => {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Failed to reorder page", description: "Please try again.", variant: "destructive" });
    },
  });

  // Manual page swap mutation with optimistic updates for instant feedback
  const swapPagesMutation = useMutation({
    mutationFn: async ({ page1Id, page2Id, page1Number, page2Number }: { 
      page1Id: string, page2Id: string, page1Number: number, page2Number: number 
    }) => {
      // Swap the page numbers between two pages
      await Promise.all([
        apiRequest("PATCH", `/api/yearbooks/pages/${page1Id}/reorder`, {
          pageNumber: page2Number
        }),
        apiRequest("PATCH", `/api/yearbooks/pages/${page2Id}/reorder`, {
          pageNumber: page1Number
        })
      ]);
    },
    onMutate: async ({ page1Id, page2Id, page1Number, page2Number }) => {
      // Cancel outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ["/api/yearbooks", schoolId, year] });
      
      // Snapshot the previous value
      const previousYearbook = queryClient.getQueryData(["/api/yearbooks", schoolId, year]);
      
      // Optimistically update to the new value
      queryClient.setQueryData(["/api/yearbooks", schoolId, year], (old: any) => {
        if (!old) return old;
        
        return {
          ...old,
          pages: old.pages.map((page: any) => {
            if (page.id === page1Id) {
              return { ...page, pageNumber: page2Number };
            }
            if (page.id === page2Id) {
              return { ...page, pageNumber: page1Number };
            }
            return page;
          })
        };
      });
      
      // Return context with snapshot for rollback
      return { previousYearbook };
    },
    onSuccess: () => {
      // Refetch to ensure we're in sync with server
      queryClient.invalidateQueries({ queryKey: ["/api/yearbooks", schoolId, year] });
      setEditingPageId(null);
      setTempPageNumber(0);
    },
    onError: (_error, _variables, context) => {
      // Rollback to previous state on error
      if (context?.previousYearbook) {
        queryClient.setQueryData(["/api/yearbooks", schoolId, year], context.previousYearbook);
      }
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Failed to swap pages", description: "Please try again.", variant: "destructive" });
    },
  });

  // Enhanced upload function with progress tracking
  const uploadFileWithProgress = (file: File, pageType: string, title: string, yearbookId: string): Promise<any> => {
    return new Promise((resolve, reject) => {
      const fileId = `${file.name}-${Date.now()}`;
      
      // Update progress state to show this file is uploading
      setFileUploadProgress(prev => new Map(prev).set(fileId, {
        file,
        progress: 0,
        status: 'uploading',
      }));
      
      // For PUBLISHED yearbooks, queue content pages instead of uploading
      if (yearbook?.isPublished && pageType === "content") {
        const tempUrl = URL.createObjectURL(file);
        setPendingPageUploads(prev => [...prev, { 
          file, 
          pageType, 
          title, 
          tempId: Date.now(),
          tempUrl,
          pageNumber: (yearbook?.pages?.filter(p => p.pageType === "content")?.length || 0) + prev.filter(p => p.pageType === "content").length + 1
        }]);
        setHasUnsavedChanges(true);
        
        // Mark as completed immediately since we're queuing
        setFileUploadProgress(prev => {
          const newMap = new Map(prev);
          newMap.set(fileId, { file, progress: 100, status: 'completed' });
          return newMap;
        });
        
        resolve({ tempId: Date.now(), queued: true });
        return;
      }
      
      // For covers or unpublished yearbooks, upload immediately
      const formData = new FormData();
      formData.append('file', file);
      formData.append('pageType', pageType);
      formData.append('title', title);
      
      const xhr = new XMLHttpRequest();
      
      // Track upload progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          setFileUploadProgress(prev => {
            const newMap = new Map(prev);
            const current = newMap.get(fileId);
            if (current) {
              newMap.set(fileId, { ...current, progress: percentComplete });
            }
            return newMap;
          });
        }
      });
      
      // Handle completion
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const response = JSON.parse(xhr.responseText);
          setFileUploadProgress(prev => {
            const newMap = new Map(prev);
            const current = newMap.get(fileId);
            if (current) {
              newMap.set(fileId, { ...current, progress: 100, status: 'completed' });
            }
            return newMap;
          });
          resolve(response);
        } else {
          const errorData = JSON.parse(xhr.responseText || '{}');
          setFileUploadProgress(prev => {
            const newMap = new Map(prev);
            const current = newMap.get(fileId);
            if (current) {
              newMap.set(fileId, { 
                ...current, 
                status: 'failed', 
                error: errorData.message || 'Upload failed'
              });
            }
            return newMap;
          });
          reject(new Error(errorData.message || 'Upload failed'));
        }
      });
      
      // Handle errors
      xhr.addEventListener('error', () => {
        setFileUploadProgress(prev => {
          const newMap = new Map(prev);
          const current = newMap.get(fileId);
          if (current) {
            newMap.set(fileId, { ...current, status: 'failed', error: 'Network error occurred' });
          }
          return newMap;
        });
        reject(new Error('Network error occurred'));
      });
      
      xhr.open('POST', `/api/yearbooks/${yearbookId}/upload-page`);
      xhr.send(formData);
    });
  };
  
  // Retry failed upload
  const retryUpload = async (fileId: string) => {
    const fileInfo = fileUploadProgress.get(fileId);
    if (!fileInfo || !yearbook?.id) return;
    
    const pageNumber = (yearbook?.pages?.filter(p => p.pageType === "content")?.length || 0) + 1;
    const title = selectedPageType === "front_cover" ? "Front Cover" : 
                  selectedPageType === "back_cover" ? "Back Cover" : 
                  `Page ${pageNumber}`;
    
    try {
      await uploadFileWithProgress(fileInfo.file, selectedPageType, title, yearbook.id);
      toast({
        className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Upload successful!",
        description: `${fileInfo.file.name} uploaded successfully.`
      });
      queryClient.invalidateQueries({ queryKey: ["/api/yearbooks", schoolId, year] });
    } catch (error: any) {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Retry failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };
  
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      // Validate file types based on uploadType
      const invalidFiles = files.filter(file => {
        const isImage = file.type.startsWith('image/');
        const isPDF = file.type === 'application/pdf';
        
        // For PDF upload mode
        if (yearbook?.uploadType === "pdf") {
          // Covers not applicable in PDF mode
          if (selectedPageType !== "content") {
            return true; // Invalid
          }
          // Only PDFs allowed in PDF mode
          return !isPDF;
        }
        
        // For image upload mode (or default)
        // Covers only allow images
        if (selectedPageType !== "content") {
          return !isImage;
        }
        
        // Content pages allow only images in image mode
        return !isImage;
      });
      
      if (invalidFiles.length > 0) {
        const allowedTypes = yearbook?.uploadType === "pdf" 
          ? "PDF files only" 
          : (selectedPageType === "content" ? "images only" : "images only");
        toast({ 
          className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
          title: "Invalid file type", 
          description: `For ${selectedPageType === "content" ? "content pages" : "covers"}, please upload ${allowedTypes}.`, 
          variant: "destructive" 
        });
        // Reset file input
        event.target.value = '';
        return;
      }
      
      // Enhanced PDF validation
      const pdfFiles = files.filter(file => file.type === 'application/pdf');
      
      // Check PDF file sizes (limit to 50MB per PDF)
      const oversizedPDFs = pdfFiles.filter(file => file.size > 50 * 1024 * 1024);
      if (oversizedPDFs.length > 0) {
        toast({
          className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
          title: "PDF file too large",
          description: `PDF files must be under 50MB. Please compress or split larger PDFs.`,
          variant: "destructive"
        });
        event.target.value = '';
        return;
      }
      
      // Check total file sizes (limit to 100MB total)
      const totalSize = files.reduce((sum, file) => sum + file.size, 0);
      if (totalSize > 100 * 1024 * 1024) {
        toast({
          className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
          title: "Upload size limit exceeded",
          description: "Total upload size must be under 100MB. Please reduce file sizes or upload fewer files.",
          variant: "destructive"
        });
        event.target.value = '';
        return;
      }
      
      // For front/back covers, only allow single file
      if (selectedPageType !== "content" && files.length > 1) {
        toast({
          className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
          title: "Multiple files not allowed", description: "Only one file allowed for covers.", variant: "destructive" });
        // Reset file input
        event.target.value = '';
        return;
      }
      
      // Warn about mixing PDFs with images
      const imageFiles = files.filter(file => file.type.startsWith('image/'));
      if (pdfFiles.length > 0 && imageFiles.length > 0) {
        toast({
          className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
          title: "Mixed file types detected",
          description: "Consider uploading PDFs and images separately for better organization.",
          variant: "default"
        });
      }
      
      // Inform about multiple PDFs
      if (pdfFiles.length > 1) {
        toast({
          className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
          title: "Multiple PDFs selected",
          description: `${pdfFiles.length} PDFs will be processed. Each PDF page will become a separate yearbook page.`,
          variant: "default"
        });
      }
      
      setUploadingFiles(files);
    }
  };
  
  const removeUploadingFile = (index: number) => {
    setUploadingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUploadSubmit = async () => {
    if (uploadingFiles.length === 0 || !yearbook?.id) return;
    
    setIsUploading(true);
    setFileUploadProgress(new Map());
    
    try {
      // Upload files one by one with progress tracking
      for (let i = 0; i < uploadingFiles.length; i++) {
        const file = uploadingFiles[i];
        const pageNumber = (yearbook?.pages?.filter(p => p.pageType === "content")?.length || 0) + i + 1;
        const title = selectedPageType === "front_cover" ? "Front Cover" : 
                      selectedPageType === "back_cover" ? "Back Cover" : 
                      `Page ${pageNumber}`;
        
        try {
          await uploadFileWithProgress(file, selectedPageType, title, yearbook.id);
        } catch (error: any) {
          // Error is already tracked in fileUploadProgress state
          console.error(`Failed to upload ${file.name}:`, error);
        }
      }
      
      // Check if all uploads completed successfully
      const allCompleted = Array.from(fileUploadProgress.values()).every(f => f.status === 'completed');
      const anyFailed = Array.from(fileUploadProgress.values()).some(f => f.status === 'failed');
      
      if (allCompleted) {
        toast({
          className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
          title: "All files uploaded successfully!",
          description: `Successfully uploaded ${uploadingFiles.length} file(s).`
        });
        
        // Refresh yearbook data
        queryClient.invalidateQueries({ queryKey: ["/api/yearbooks", schoolId, year] });
        
        // Clear and close dialog after a short delay
        setTimeout(() => {
          setUploadingFiles([]);
          setFileUploadProgress(new Map());
          setShowUploadDialog(false);
          
          // Reset file input
          const fileInput = document.getElementById('file-upload') as HTMLInputElement;
          if (fileInput) {
            fileInput.value = '';
          }
        }, 1500);
      } else if (anyFailed) {
        toast({
          className: "bg-orange-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
          title: "Some uploads failed",
          description: "You can retry failed uploads using the retry button.",
          variant: "default"
        });
        
        // Refresh to show successful uploads
        queryClient.invalidateQueries({ queryKey: ["/api/yearbooks", schoolId, year] });
      }
      
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddTOC = () => {
    addTOCMutation.mutate(newTOCItem);
  };

  const [previewPageId, setPreviewPageId] = useState<string | null>(null);
  const [previewPendingUrl, setPreviewPendingUrl] = useState<string | null>(null);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);


  // Drag and drop handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActivePageId(event.active.id as string);
  };
  
  const handleDragOver = (event: any) => {
    setOverId(event.over?.id || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    setActivePageId(null);
    setOverId(null);
    
    if (!over || active.id === over.id) {
      return;
    }
    
    // Get all content pages (published + pending) for unified drag and drop
    const publishedContent = yearbook?.pages?.filter(p => p.pageType === "content").sort((a, b) => a.pageNumber - b.pageNumber) || [];
    const pendingContent = pendingPageUploads.filter(p => p.pageType === "content");
    
    // Create combined items array
    const allItems = [
      ...publishedContent.map(p => ({ id: p.id, type: 'published' as const, pageNumber: p.pageNumber, data: p })),
      ...pendingContent.map(p => ({ id: p.tempId, type: 'pending' as const, pageNumber: p.pageNumber, data: p }))
    ];
    
    // Find indices in combined array
    const activeIndex = allItems.findIndex(item => item.id === active.id);
    const overIndex = allItems.findIndex(item => item.id === over.id);
    
    if (activeIndex === -1 || overIndex === -1) {
      return;
    }
    
    // Reorder in the combined context
    const reordered = arrayMove(allItems, activeIndex, overIndex);
    
    // Separate published and pending items with new page numbers
    const publishedUpdates: Array<{pageId: string, oldPageNumber: number, newPageNumber: number}> = [];
    const updatedPendingPages: typeof pendingPageUploads = [];
    
    reordered.forEach((item, visualIndex) => {
      const newPageNumber = visualIndex + 1;
      
      if (item.type === 'published') {
        if (item.pageNumber !== newPageNumber) {
          publishedUpdates.push({
            pageId: item.id,
            oldPageNumber: item.pageNumber,
            newPageNumber
          });
        }
      } else {
        // Update pending page number
        updatedPendingPages.push({
          ...item.data,
          pageNumber: newPageNumber
        });
      }
    });
    
    // Update pending pages immediately (instant feedback)
    if (updatedPendingPages.length > 0) {
      setPendingPageUploads(prev => [
        ...prev.filter(p => p.pageType !== "content"),
        ...updatedPendingPages
      ]);
    }
    
    // OPTIMISTIC UPDATE: Update React Query cache immediately for saved pages
    if (publishedUpdates.length > 0) {
      // Store previous state for rollback
      const previousYearbook = yearbook;
      
      // Optimistically update the cache
      queryClient.setQueryData(
        ["/api/yearbooks", schoolId, year],
        (oldData: any) => {
          if (!oldData?.pages) return oldData;
          
          const updatedPages = oldData.pages.map((page: any) => {
            const update = publishedUpdates.find(u => u.pageId === page.id);
            if (update) {
              return { ...page, pageNumber: update.newPageNumber };
            }
            return page;
          });
          
          return { ...oldData, pages: updatedPages };
        }
      );
      
      // Execute API calls in the background (don't wait)
      Promise.all(
        publishedUpdates.map(update => 
          apiRequest("PATCH", `/api/yearbooks/pages/${update.pageId}/reorder`, {
            pageNumber: update.newPageNumber
          })
        )
      ).then(() => {
        // Success - refetch to ensure consistency with server
        queryClient.invalidateQueries({ queryKey: ["/api/yearbooks", schoolId, year] });
      }).catch((error) => {
        // Rollback on failure
        console.error("Failed to reorder pages:", error);
        queryClient.setQueryData(["/api/yearbooks", schoolId, year], previousYearbook);
        toast({
          className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
          title: "Failed to reorder pages", 
          description: "Changes have been reverted. Please try again.", 
          variant: "destructive" 
        });
      });
    }
  };

  // Handle manual page number change (swap pages)
  const handleManualPageChange = (pageId: string, newPageNumber: number) => {
    // Combine published and pending pages
    const publishedPages = (yearbook?.pages?.filter(p => p.pageType === "content") || []).map(p => ({ 
      type: 'published' as const, 
      data: p, 
      pageNumber: p.pageNumber,
      id: p.id
    }));
    
    const pendingPages = pendingPageUploads.filter(p => p.pageType === "content").map(p => ({ 
      type: 'pending' as const, 
      data: p, 
      pageNumber: p.pageNumber,
      id: p.tempId
    }));
    
    const allPages = [...publishedPages, ...pendingPages].sort((a, b) => a.pageNumber - b.pageNumber);
    
    // Find current page and target page by visual position
    const currentPageIndex = allPages.findIndex(p => p.id === pageId);
    const targetPageIndex = newPageNumber - 1; // Convert to 0-based index
    
    if (currentPageIndex === -1 || targetPageIndex < 0 || targetPageIndex >= allPages.length || currentPageIndex === targetPageIndex) {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Invalid page number", 
        description: "Please enter a valid page number.", 
        variant: "destructive" 
      });
      setEditingPageId(null);
      setTempPageNumber(0);
      return;
    }
    
    const currentItem = allPages[currentPageIndex];
    const targetItem = allPages[targetPageIndex];
    const currentPageNumber = currentItem.pageNumber;
    const targetPageNumber = targetItem.pageNumber;
    
    // Clear editing state
    setEditingPageId(null);
    setTempPageNumber(0);
    
    // Handle different swap scenarios
    if (currentItem.type === 'published' && targetItem.type === 'published') {
      // Both published - use existing mutation
      swapPagesMutation.mutate({
        page1Id: currentItem.id,
        page2Id: targetItem.id,
        page1Number: currentPageNumber,
        page2Number: targetPageNumber
      });
    } else if (currentItem.type === 'pending' && targetItem.type === 'pending') {
      // Both pending - swap in state
      const updatedPending = pendingPageUploads.map(p => {
        if (p.tempId === currentItem.id) {
          return { ...p, pageNumber: targetPageNumber };
        } else if (p.tempId === targetItem.id) {
          return { ...p, pageNumber: currentPageNumber };
        }
        return p;
      });
      setPendingPageUploads(updatedPending);
    } else if (currentItem.type === 'published' && targetItem.type === 'pending') {
      // Published swapping with pending
      apiRequest("PATCH", `/api/yearbooks/pages/${currentItem.id}/reorder`, {
        pageNumber: targetPageNumber
      }).then(() => {
        const updatedPending = pendingPageUploads.map(p => {
          if (p.tempId === targetItem.id) {
            return { ...p, pageNumber: currentPageNumber };
          }
          return p;
        });
        setPendingPageUploads(updatedPending);
        queryClient.invalidateQueries({ queryKey: ["/api/yearbooks", schoolId, year] });
      });
    } else if (currentItem.type === 'pending' && targetItem.type === 'published') {
      // Pending swapping with published
      apiRequest("PATCH", `/api/yearbooks/pages/${targetItem.id}/reorder`, {
        pageNumber: currentPageNumber
      }).then(() => {
        const updatedPending = pendingPageUploads.map(p => {
          if (p.tempId === currentItem.id) {
            return { ...p, pageNumber: targetPageNumber };
          }
          return p;
        });
        setPendingPageUploads(updatedPending);
        queryClient.invalidateQueries({ queryKey: ["/api/yearbooks", schoolId, year] });
      });
    }
  };

  // Start editing page number
  const startEditingPageNumber = (pageId: string, currentPageNumber: number) => {
    setEditingPageId(pageId);
    setTempPageNumber(currentPageNumber);
  };

  // Cancel editing page number
  const cancelEditingPageNumber = () => {
    setEditingPageId(null);
    setTempPageNumber(0);
  };

  // Basic reorder functions using up/down buttons (kept for compatibility)
  const handleReorderPage = (pageId: string, direction: 'up' | 'down') => {
    const contentPages = yearbook?.pages?.filter(p => p.pageType === "content").sort((a, b) => a.pageNumber - b.pageNumber) || [];
    const currentPage = contentPages.find(p => p.id === pageId);
    
    if (!currentPage) return;
    
    const currentIndex = contentPages.findIndex(p => p.id === pageId);
    
    if (direction === 'up' && currentIndex > 0) {
      const targetPage = contentPages[currentIndex - 1];
      // Swap page numbers
      reorderPageMutation.mutate({ pageId: currentPage.id, newPageNumber: targetPage.pageNumber });
      reorderPageMutation.mutate({ pageId: targetPage.id, newPageNumber: currentPage.pageNumber });
    } else if (direction === 'down' && currentIndex < contentPages.length - 1) {
      const targetPage = contentPages[currentIndex + 1];
      // Swap page numbers
      reorderPageMutation.mutate({ pageId: currentPage.id, newPageNumber: targetPage.pageNumber });
      reorderPageMutation.mutate({ pageId: targetPage.id, newPageNumber: currentPage.pageNumber });
    }
  };

  // Handle left/right page movement
  const handleMovePageLeft = (pageId: string) => {
    // Combine published and pending pages
    const publishedPages = (yearbook?.pages?.filter(p => p.pageType === "content") || []).map(p => ({ 
      type: 'published' as const, 
      data: p, 
      pageNumber: p.pageNumber,
      id: p.id
    }));
    
    const pendingPages = pendingPageUploads.filter(p => p.pageType === "content").map(p => ({ 
      type: 'pending' as const, 
      data: p, 
      pageNumber: p.pageNumber,
      id: p.tempId
    }));
    
    const allPages = [...publishedPages, ...pendingPages].sort((a, b) => a.pageNumber - b.pageNumber);
    
    // Find current page in combined array
    const currentIndex = allPages.findIndex(p => p.id === pageId);
    
    if (currentIndex > 0) {
      const currentItem = allPages[currentIndex];
      const targetItem = allPages[currentIndex - 1];
      const currentPageNumber = currentItem.pageNumber;
      const targetPageNumber = targetItem.pageNumber;
      
      // If both are published, use mutation to swap
      if (currentItem.type === 'published' && targetItem.type === 'published') {
        swapPagesMutation.mutate({
          page1Id: currentItem.id,
          page2Id: targetItem.id,
          page1Number: currentPageNumber,
          page2Number: targetPageNumber
        });
      }
      // If current is published and target is pending
      else if (currentItem.type === 'published' && targetItem.type === 'pending') {
        // Update published page
        apiRequest("PATCH", `/api/yearbooks/pages/${currentItem.id}/reorder`, {
          pageNumber: targetPageNumber
        }).then(() => {
          // Update pending page
          const updatedPending = pendingPageUploads.map(p => {
            if (p.tempId === targetItem.id) {
              return { ...p, pageNumber: currentPageNumber };
            }
            return p;
          });
          setPendingPageUploads(updatedPending);
          queryClient.invalidateQueries({ queryKey: ["/api/yearbooks", schoolId, year] });
        });
      }
    }
  };

  const handleMovePageRight = (pageId: string) => {
    // Combine published and pending pages
    const publishedPages = (yearbook?.pages?.filter(p => p.pageType === "content") || []).map(p => ({ 
      type: 'published' as const, 
      data: p, 
      pageNumber: p.pageNumber,
      id: p.id
    }));
    
    const pendingPages = pendingPageUploads.filter(p => p.pageType === "content").map(p => ({ 
      type: 'pending' as const, 
      data: p, 
      pageNumber: p.pageNumber,
      id: p.tempId
    }));
    
    const allPages = [...publishedPages, ...pendingPages].sort((a, b) => a.pageNumber - b.pageNumber);
    
    // Find current page in combined array
    const currentIndex = allPages.findIndex(p => p.id === pageId);
    
    if (currentIndex < allPages.length - 1) {
      const currentItem = allPages[currentIndex];
      const targetItem = allPages[currentIndex + 1];
      const currentPageNumber = currentItem.pageNumber;
      const targetPageNumber = targetItem.pageNumber;
      
      // If both are published, use mutation to swap
      if (currentItem.type === 'published' && targetItem.type === 'published') {
        swapPagesMutation.mutate({
          page1Id: currentItem.id,
          page2Id: targetItem.id,
          page1Number: currentPageNumber,
          page2Number: targetPageNumber
        });
      }
      // If current is published and target is pending
      else if (currentItem.type === 'published' && targetItem.type === 'pending') {
        // Update published page
        apiRequest("PATCH", `/api/yearbooks/pages/${currentItem.id}/reorder`, {
          pageNumber: targetPageNumber
        }).then(() => {
          // Update pending page
          const updatedPending = pendingPageUploads.map(p => {
            if (p.tempId === targetItem.id) {
              return { ...p, pageNumber: currentPageNumber };
            }
            return p;
          });
          setPendingPageUploads(updatedPending);
          queryClient.invalidateQueries({ queryKey: ["/api/yearbooks", schoolId, year] });
        });
      }
    }
  };






  // Update page numbering mutation - renumbers all pages sequentially
  const updateNumberingMutation = useMutation({
    mutationFn: async () => {
      const contentPages = yearbook?.pages?.filter(p => p.pageType === "content").sort((a, b) => a.pageNumber - b.pageNumber) || [];
      
      // Renumber all pages sequentially starting from 1
      for (let i = 0; i < contentPages.length; i++) {
        const page = contentPages[i];
        const newPageNumber = i + 1;
        
        if (page.pageNumber !== newPageNumber) {
          await apiRequest("PATCH", `/api/yearbooks/pages/${page.id}/reorder`, {
            pageNumber: newPageNumber
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/yearbooks", schoolId, year] });
      toast({
        className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Page numbering updated successfully!" });
    },
    onError: () => {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Update failed", description: "Please try again.", variant: "destructive" });
    },
  });

  // Handle update page numbering button click
  const handleUpdatePageNumbering = () => {
    const publishedPages = (yearbook?.pages?.filter(p => p.pageType === "content") || []).map(p => ({ 
      type: 'published' as const, 
      data: p, 
      pageNumber: p.pageNumber,
      id: p.id
    }));
    
    const pendingPages = pendingPageUploads.filter(p => p.pageType === "content").map(p => ({ 
      type: 'pending' as const, 
      data: p, 
      pageNumber: p.pageNumber,
      id: p.tempId
    }));
    
    const allPages = [...publishedPages, ...pendingPages].sort((a, b) => a.pageNumber - b.pageNumber);
    
    if (allPages.length === 0) {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "No content pages to renumber", variant: "destructive" });
      return;
    }

    // Check if renumbering is needed (for published pages)
    const publishedNeedsRenumbering = publishedPages.some((item, visualIndex) => {
      const correctPageNumber = allPages.findIndex(p => p.id === item.id) + 1;
      return item.data.pageNumber !== correctPageNumber;
    });
    
    // Check if pending pages need renumbering
    const pendingNeedsRenumbering = pendingPages.some((item, visualIndex) => {
      const correctPageNumber = allPages.findIndex(p => p.id === item.id) + 1;
      return item.data.pageNumber !== correctPageNumber;
    });
    
    if (!publishedNeedsRenumbering && !pendingNeedsRenumbering) {
      toast({
        className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Page numbering is already correct" });
      return;
    }

    // Update pending pages immediately
    if (pendingNeedsRenumbering) {
      const updatedPending = pendingPages.map(item => {
        const correctPageNumber = allPages.findIndex(p => p.id === item.id) + 1;
        return {
          ...item.data,
          pageNumber: correctPageNumber
        };
      });
      
      setPendingPageUploads(prev => [
        ...prev.filter(p => p.pageType !== "content"),
        ...updatedPending
      ]);
    }

    // Update published pages via mutation if needed
    if (publishedNeedsRenumbering) {
      updateNumberingMutation.mutate();
    } else {
      toast({
        className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Page numbering updated!" });
    }
  };


  const canPublish = yearbook?.pages?.some(p => p.pageType === "front_cover") && 
                    yearbook?.pages?.some(p => p.pageType === "back_cover") &&
                    (BETA_VERSION || (yearbook?.price && parseFloat(yearbook.price) >= 1.99 && parseFloat(yearbook.price) <= 49.99));

// Sortable Page Component (with drag and drop)
interface SortablePageProps {
  page: YearbookPage;
  index: number;
  onPreview: (pageId: string) => void;
  onDelete: (pageId: string) => void;
  reorderPending: boolean;
  totalPages: number;
  isDragging?: boolean;
  editingPageId: string | null;
  tempPageNumber: number;
  onStartEditingPageNumber: (pageId: string, currentPageNumber: number) => void;
  onCancelEditingPageNumber: () => void;
  onManualPageChange: (pageId: string, newPageNumber: number) => void;
  onMoveLeft: (pageId: string) => void;
  onMoveRight: (pageId: string) => void;
  aspectRatio?: string | null;
}

function SortablePage({ 
  page, 
  index, 
  onPreview,
  onDelete,
  reorderPending,
  totalPages,
  isDragging = false,
  editingPageId,
  tempPageNumber,
  onStartEditingPageNumber,
  onCancelEditingPageNumber,
  onManualPageChange,
  onMoveLeft,
  onMoveRight,
  aspectRatio
}: SortablePageProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
    isOver,
  } = useSortable({ 
    id: page.id,
    transition: {
      duration: 0, // Instant grid-locked movement
      easing: 'linear',
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isSortableDragging ? 'none' : (transition || 'none'),
    zIndex: isSortableDragging ? 999 : 1,
  };

  const isDraftPage = page.status === 'draft' || page.status === 'draft_deleted';
  
  return (
    <div
      ref={setNodeRef}
      style={{ ...style, aspectRatio: aspectRatio || '3/4' }}
      className={`relative border-2 rounded-lg p-3 backdrop-blur-lg min-w-[160px] flex flex-col
        ${isSortableDragging 
          ? (isDraftPage 
            ? 'bg-orange-500/40 border-orange-400 shadow-2xl ring-4 ring-orange-400/80 shadow-orange-500/60'
            : 'bg-blue-500/40 border-blue-400 shadow-2xl ring-4 ring-blue-400/80 shadow-blue-500/60')
          : (isDraftPage
            ? 'bg-orange-500/20 hover:bg-orange-500/30 hover:shadow-lg hover:border-orange-400/50 border-orange-400/30'
            : 'bg-white/10 hover:bg-white/15 hover:shadow-lg hover:border-white/30')
        }
        ${isOver && !isSortableDragging 
          ? (isDraftPage
            ? 'ring-4 ring-orange-400/60 border-orange-400 shadow-xl shadow-orange-500/30 scale-105'
            : 'ring-4 ring-blue-400/60 border-blue-400 shadow-xl shadow-blue-500/30 scale-105')
          : (isSortableDragging ? '' : (isDraftPage ? 'border-orange-400/30' : 'border-white/20'))
        }
        ${isDragging && !isSortableDragging ? (isDraftPage ? 'ring-2 ring-orange-400' : 'ring-2 ring-blue-400') : ''}
        ${page.status === 'draft_deleted' ? 'opacity-60' : ''}
      `}
      data-testid={`page-item-${page.id}`}
    >
      {/* Page Number and Drag Handle */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {editingPageId === page.id ? (
            <div className="flex items-center gap-1">
              <span className="text-xs text-white">Page</span>
              <Input
                type="number"
                min="1"
                max={totalPages}
                value={tempPageNumber || ''}
                onChange={(e) => {
                  const newValue = e.target.value === '' ? 0 : parseInt(e.target.value);
                  onStartEditingPageNumber(page.id, newValue);
                }}
                onBlur={() => {
                  if (tempPageNumber !== page.pageNumber && tempPageNumber >= 1 && tempPageNumber <= totalPages) {
                    onManualPageChange(page.id, tempPageNumber);
                  } else {
                    onCancelEditingPageNumber();
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  } else if (e.key === 'Escape') {
                    onCancelEditingPageNumber();
                  }
                }}
                className="w-12 h-6 text-xs px-1 bg-white/20 border-white/30 text-white"
                autoFocus
                data-testid={`input-page-number-${page.id}`}
              />
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span 
                className="text-xs font-medium text-white cursor-pointer hover:text-blue-300 transition-colors"
                onClick={() => onStartEditingPageNumber(page.id, page.pageNumber)}
                title="Click to edit page number"
                data-testid={`text-page-number-${page.id}`}
              >
                Page {page.pageNumber}
              </span>
              {page.status === 'draft' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500 text-white font-semibold">
                  DRAFT
                </span>
              )}
              {page.status === 'draft_deleted' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500 text-white font-semibold">
                  DELETED
                </span>
              )}
            </div>
          )}
        </div>
        <div 
          className="cursor-grab active:cursor-grabbing text-white/80 hover:text-white hover:bg-white/30 p-1.5 rounded-md transition-all"
          style={{ touchAction: 'none' }}
          title="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5" />
        </div>
      </div>
      
      {/* Page Image */}
      <div className="flex-1 w-full mb-2 overflow-hidden rounded">
        <img
          src={getSecureImageUrl(page.imageUrl) || ''}
          alt={page.title ?? ''}
          className="w-full h-full object-cover pointer-events-none"
        />
      </div>
     
      {/* Action buttons */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onMoveLeft(page.id);
            }}
            className="p-1 h-5 w-5 text-white hover:bg-white/20"
            title="Move page left"
            data-testid={`button-move-left-${page.id}`}
          >
            <ChevronLeft className="h-2 w-2" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onMoveRight(page.id);
            }}
            className="p-1 h-5 w-5 text-white hover:bg-white/20"
            title="Move page right"
            data-testid={`button-move-right-${page.id}`}
          >
            <ChevronRight className="h-2 w-2" />
          </Button>
        </div>
        
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onPreview(page.id);
            }}
            className="p-1 h-5 w-5"
            title="Preview page"
            data-testid={`button-preview-${page.id}`}
          >
            <Eye className="h-2 w-2" />
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(page.id);
            }}
            className="p-1 h-5 w-5"
            title="Delete page"
            data-testid={`button-delete-${page.id}`}
          >
            <Trash2 className="h-2 w-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// Sortable Pending Page Component
interface PendingPageUpload {
  tempId: string;
  tempUrl: string;
  title: string;
  pageNumber: number;
  pageType: string;
}

function SortablePendingPage({ 
  pendingPage,
  onDelete,
  onPreview,
  onMoveLeft,
  onMoveRight,
  totalPages,
  editingPageId,
  tempPageNumber,
  onStartEditingPageNumber,
  onCancelEditingPageNumber,
  onManualPageChange,
  aspectRatio
}: {
  pendingPage: PendingPageUpload;
  onDelete: () => void;
  onPreview: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  totalPages: number;
  editingPageId: string | null;
  tempPageNumber: number;
  onStartEditingPageNumber: (pageId: string, currentPageNumber: number) => void;
  onCancelEditingPageNumber: () => void;
  onManualPageChange: (pageId: string, newPageNumber: number) => void;
  aspectRatio?: number | null;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ 
    id: pendingPage.tempId,
    transition: {
      duration: 0, // Instant grid-locked movement
      easing: 'linear',
    },
  });

  const cardStyle = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : (transition || 'none'),
    zIndex: isDragging ? 999 : 1,
    aspectRatio: aspectRatio || '3/4',
  };

  return (
    <div
      ref={setNodeRef}
      style={cardStyle}
      className={`border-2 rounded-lg p-2 w-[200px] flex flex-col
        ${isDragging 
          ? 'bg-orange-400/60 border-orange-500 shadow-2xl ring-4 ring-orange-400/80 shadow-orange-500/60' 
          : 'bg-orange-600/60 backdrop-blur-lg border border-white/20 shadow-2xl hover:shadow-lg'
        }
        ${isOver && !isDragging 
          ? 'ring-4 ring-blue-400/60 border-blue-400 shadow-xl shadow-blue-500/30 scale-105' 
          : isDragging ? '' : 'border-orange-300'
        }
      `}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {editingPageId === pendingPage.tempId ? (
            <div className="flex items-center gap-1">
              <span className="text-xs text-white">Page</span>
              <Input
                type="number"
                min="1"
                max={totalPages}
                value={tempPageNumber || ''}
                onChange={(e) => {
                  const newValue = e.target.value === '' ? 0 : parseInt(e.target.value);
                  onStartEditingPageNumber(pendingPage.tempId, newValue);
                }}
                onBlur={() => {
                  if (tempPageNumber !== pendingPage.pageNumber && tempPageNumber >= 1 && tempPageNumber <= totalPages) {
                    onManualPageChange(pendingPage.tempId, tempPageNumber);
                  } else {
                    onCancelEditingPageNumber();
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  } else if (e.key === 'Escape') {
                    onCancelEditingPageNumber();
                  }
                }}
                className="w-12 h-6 text-xs px-1 bg-white/20 border-white/30 text-white"
                autoFocus
                data-testid={`input-page-number-${pendingPage.tempId}`}
              />
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500 text-white font-semibold">
                UNSAVED
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span 
                className="text-xs font-medium text-white cursor-pointer hover:text-orange-300 transition-colors"
                onClick={() => onStartEditingPageNumber(pendingPage.tempId, pendingPage.pageNumber)}
                title="Click to edit page number"
                data-testid={`text-page-number-${pendingPage.tempId}`}
              >
                Page {pendingPage.pageNumber}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500 text-white font-semibold">
                UNSAVED
              </span>
            </div>
          )}
        </div>
        <div 
          {...attributes} 
          {...listeners} 
          className="cursor-grab active:cursor-grabbing hover:bg-orange-200 p-1.5 rounded-md transition-all"
          style={{ touchAction: 'none' }}
        >
          <GripVertical className="h-5 w-5 text-white" />
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center overflow-hidden rounded mb-2">
        <img
          src={pendingPage.tempUrl || ''}
          alt={pendingPage.title || ''}
          className="w-full h-full object-cover rounded"
        />
      </div>
      
      {/* Action buttons */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onMoveLeft();
            }}
            className="p-1 h-5 w-5 text-white hover:bg-white/20"
            title="Move page left"
            data-testid={`button-move-left-${pendingPage.tempId}`}
          >
            <ChevronLeft className="h-2 w-2" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onMoveRight();
            }}
            className="p-1 h-5 w-5 text-white hover:bg-white/20"
            title="Move page right"
            data-testid={`button-move-right-${pendingPage.tempId}`}
          >
            <ChevronRight className="h-2 w-2" />
          </Button>
        </div>
        
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onPreview();
            }}
            className="p-1 h-5 w-5"
            title="Preview page"
            data-testid={`button-preview-${pendingPage.tempId}`}
          >
            <Eye className="h-2 w-2" />
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 h-5 w-5"
            title="Delete page"
            data-testid={`button-delete-${pendingPage.tempId}`}
          >
            <Trash2 className="h-2 w-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}


  if (!user || user.userType !== "school") {
    return <div className="p-4">Access denied. School administrators only.</div>;
  }

  if (isLoading) {
    return <div className="p-4">Loading yearbook...</div>;
  }

  if (yearbookError) {
    const canSetup = !!schoolId && !!year;
    const isSetupComplete = setupUploadType !== null;

    const handleCreateYearbook = async () => {
      if (!isSetupComplete || !schoolId || !year) return;
      try {
        const res = await fetch("/api/yearbooks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            schoolId,
            year: parseInt(year),
            title: `${year} Yearbook`,
            uploadType: setupUploadType,
            isInitialized: true
          })
        });
        if (!res.ok) throw new Error("Failed");
        queryClient.invalidateQueries({ queryKey: ["/api/yearbooks", schoolId, year] });
        window.location.reload();
      } catch {
        alert("Something went wrong. Please try again.");
      }
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-white/10 backdrop-blur-lg border border-white/20">
          <CardHeader>
            <CardTitle className="text-xl text-white flex items-center gap-2">
              <Settings className="h-6 w-6 text-purple-400" />
              Complete Yearbook Setup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-white/70 text-sm">
              Your yearbook was unlocked but needs one more step. Select your preferences to finish setup.
            </p>

            <div className="space-y-2">
              <Label className="text-white text-sm font-semibold">Yearbook Type</Label>
              <div className="grid grid-cols-2 gap-2">
                {(['image', 'pdf'] as const).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSetupUploadType(type)}
                    className={`p-3 rounded-lg border text-sm font-medium transition-colors ${setupUploadType === type ? 'bg-purple-600/40 border-purple-400 text-white' : 'bg-white/5 border-white/20 text-white/70 hover:bg-white/10'}`}
                  >
                    {type === 'image' ? '🖼 Image Upload' : '📄 PDF Upload'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => setLocation("/school-dashboard?tab=years")}
                variant="outline"
                className="flex-1 bg-white/10 border-white/20 text-white"
                data-testid="button-back-to-dashboard"
              >
                <Home className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={handleCreateYearbook}
                disabled={!isSetupComplete}
                className="flex-1 bg-purple-600/60 border border-purple-400/50 text-white hover:bg-purple-600/80 disabled:opacity-50"
                data-testid="button-complete-setup"
              >
                <Settings className="h-4 w-4 mr-2" />
                Complete Setup
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

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
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 sm:py-0 sm:h-16 gap-4 sm:gap-0">
            <div className="flex items-center w-full sm:w-auto">
              <div className="hidden sm:flex items-center">
                <Button
                  variant="ghost"
                  onClick={handleBackNavigation}
                  disabled={!hasNavigationHistory}
                  className="mr-2 text-white hover:bg-white/20"
                  data-testid="button-back"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </div>
              
              {/* Mobile back button */}
              <Button
                variant="ghost"
                onClick={handleBackNavigation}
                disabled={!hasNavigationHistory}
                className="sm:hidden mr-2 text-white hover:bg-white/20"
                size="sm"
                data-testid="button-mobile-back"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <BookOpen className="text-white text-sm" />
              </div>
              <div className="ml-3">
                <h1 className="text-lg sm:text-xl font-semibold text-white">
                  <span className="hidden sm:inline">Yearbook Manager - </span>
                  <span className="sm:hidden">Yearbook - </span>
                  <span className="hidden sm:inline">{school?.name}</span>
                  <span className="sm:hidden">{school?.name?.split(" ")[0]}</span>
                  <span className="ml-1">{year}</span>
                </h1>
                <p className="text-sm text-white/80">
                  {yearbook?.isPublished ? "Published" : "Draft"} • {yearbook?.pages?.length || 0} pages
                  {hasUnsavedChanges && (
                    <span className="ml-2 text-orange-300">• Unsaved changes</span>
                  )}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
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
              
              {/* Hamburger Menu */}
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
        <div className="notification-dropdown fixed top-16 right-16 w-72 sm:w-80 max-w-[calc(100vw-2rem)] bg-blue-700/70 backdrop-blur-lg rounded-lg shadow-xl border border-white/20 z-[999999]">
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
        <div className="hamburger-dropdown fixed top-16 right-4 w-48 bg-blue-600/60 backdrop-blur-lg border border-white/20 rounded-lg shadow-xl z-[999999]">
          <div className="py-1">
            <button
              className="flex items-center w-full px-4 py-2 text-sm text-white hover:bg-white/10 transition-colors"
              onClick={() => {
                setShowHamburgerMenu(false);
                setLocation("/school-dashboard");
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Top Operations Panel - Horizontal */}
        <div className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl rounded-lg p-4 mb-6">
          <div className="flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            {/* Publishing Checklist - Horizontal */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:flex-1 gap-4">
              <h3 className="font-semibold text-white lg:w-40 flex-shrink-0">Publishing Checklist</h3>
              
              <div className="flex flex-col sm:flex-row gap-3 lg:flex-1">
                <div className="flex items-center space-x-2">
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                    yearbook?.pages?.some(p => p.pageType === "front_cover") ? "bg-green-500" : "bg-gray-300"
                  }`}>
                    {yearbook?.pages?.some(p => p.pageType === "front_cover") && (
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    )}
                  </div>
                  <span className={`text-sm ${
                    yearbook?.pages?.some(p => p.pageType === "front_cover") ? "text-green-400" : "text-white/60"
                  }`}>
                    Front cover
                  </span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                    yearbook?.pages?.some(p => p.pageType === "back_cover") ? "bg-green-500" : "bg-gray-300"
                  }`}>
                    {yearbook?.pages?.some(p => p.pageType === "back_cover") && (
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    )}
                  </div>
                  <span className={`text-sm ${
                    yearbook?.pages?.some(p => p.pageType === "back_cover") ? "text-green-400" : "text-white/60"
                  }`}>
                    Back cover
                  </span>
                </div>

                {!BETA_VERSION && (
                  <div className="flex items-center space-x-2">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                      yearbook?.price && parseFloat(yearbook.price) >= 1.99 && parseFloat(yearbook.price) <= 49.99 ? "bg-green-500" : "bg-gray-300"
                    }`}>
                      {yearbook?.price && parseFloat(yearbook.price) >= 1.99 && parseFloat(yearbook.price) <= 49.99 && (
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </div>
                    <span className={`text-sm ${
                      yearbook?.price && parseFloat(yearbook.price) >= 1.99 && parseFloat(yearbook.price) <= 49.99 ? "text-green-400" : "text-white/60"
                    }`}>
                      Price set
                    </span>
                  </div>
                )}
                
                <div className="text-xs text-white/60">
                  {canPublish 
                    ? "✓ Ready to publish!" 
                    : "Complete all items to enable publishing."
                  }
                </div>
              </div>
            </div>
            
            {/* Action Buttons - Horizontal */}
            <div className="flex flex-wrap gap-2 lg:flex-shrink-0">
              <Button
                size="sm"
                className="bg-blue-500/40 backdrop-blur-lg border border-blue-500 shadow-2xl cursor-pointer transition-all hover:bg-blue-410 hover:scale-105 hover:border-blue-700"
                onClick={() => {
                  if (yearbook?.isPublished) {
                    saveChangesMutation.mutate();
                  } else {
                    publishMutation.mutate();
                  }
                }}
                disabled={yearbook?.isPublished ? 
                  (!hasUnsavedChanges || saveChangesMutation.isPending) : 
                  (!canPublish || publishMutation.isPending)
                }
                data-testid="button-publish-yearbook"
              >
                <Publish className="h-4 w-4 mr-1" />
                {yearbook?.isPublished ? 
                  (hasUnsavedChanges ? "Save" : "Saved") : 
                  "Publish"
                }
              </Button>

              {yearbook?.isPublished && hasUnsavedChanges && (
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-red-500/40 backdrop-blur-lg border border-red-500 shadow-2xl cursor-pointer transition-all hover:bg-red-600 hover:scale-105 hover:border-red-700 text-white"
                  onClick={() => setShowDiscardDialog(true)}
                  disabled={discardChangesMutation.isPending}
                  data-testid="button-discard-changes"
                >
                  <Undo2 className="h-4 w-4 mr-1" />
                  {discardChangesMutation.isPending ? "Discarding..." : "Discard"}
                </Button>
              )}

              <Button
                size="sm"
                variant="outline"
                className="bg-white-500/40 backdrop-blur-lg border border-whhite shadow-2xl cursor-pointer transition-all hover:bg-white hover:scale-105 hover:border-black text-white hover:text-black"
                onClick={handleUpdatePageNumbering}
                disabled={(!yearbook?.pages?.some(p => p.pageType === "content") && pendingPageUploads.filter(p => p.pageType === "content").length === 0) || updateNumberingMutation.isPending}
                data-testid="button-update-page-numbering"
              >
                <Layers className="h-4 w-4 mr-1" />
                {updateNumberingMutation.isPending ? "Updating..." : "Update Pages"}
              </Button>

              <Button
                size="sm"
                variant="outline"
                className="bg-white-500/40 backdrop-blur-lg border border-whhite shadow-2xl cursor-pointer transition-all hover:bg-white hover:scale-105 hover:border-black text-white hover:text-black"
                onClick={() => setShowSettingsDialog(true)}
                data-testid="button-open-settings"
              >
                <Settings className="h-4 w-4 mr-1" />
                Settings
              </Button>
            </div>
          </div>
            
            {/* Statistics - Horizontal */}
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm border-t border-white/20 pt-3">
              <div className="flex items-center gap-2">
                <span className="text-white/80">Pages:</span>
                <span className="text-white font-medium">{yearbook?.pages?.length || 0}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white/80">TOC:</span>
                <span className="text-white font-medium">{yearbook?.tableOfContents?.length || 0}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white/80">Status:</span>
                <span className={yearbook?.isPublished ? "text-green-400 font-medium" : "text-orange-400 font-medium"}>
                  {yearbook?.isPublished ? "Published" : "Draft"}
                </span>
              </div>
              {yearbook?.isPublished && (
                <div className="flex items-center gap-2">
                  {isAutoSaving ? (
                    <>
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                      <span className="text-blue-400 text-xs">Auto-saving...</span>
                    </>
                  ) : hasUnsavedChanges ? (
                    <>
                      <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
                      <span className="text-orange-400 text-xs">Unsaved changes</span>
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                      <span className="text-green-400 text-xs">All changes saved</span>
                    </>
                  )}
                </div>
              )}
              {lastAutoSaved && (
                <div className="flex items-center gap-1 text-xs text-white/60">
                  <span>Auto-saved:</span>
                  <span>{new Date(lastAutoSaved).toLocaleTimeString()}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Sidebar - Price Management & Table of Contents */}
          <div className="w-full lg:w-56 flex-shrink-0 space-y-6">
            {/* Price Management Card */}
            <div className={`relative bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl rounded-lg p-4 lg:p-6 ${BETA_VERSION ? "pointer-events-none" : ""}`}>
              {BETA_VERSION && (
                <div className="absolute inset-0 rounded-lg bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center z-10 gap-1">
            
                  <p className="text-xs text-white/60 text-center px-2"></p>
                </div>
              )}
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Pricing
                </h3>
              </div>
              
              <div className="space-y-3">
                {isEditingPrice ? (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="price-input" className="text-white/80 text-xs">
                        Price (USD)
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60">$</span>
                        <Input
                          id="price-input"
                          type="number"
                          step="0.01"
                          min="1.99"
                          max="49.99"
                          value={priceInput}
                          onChange={(e) => setPriceInput(e.target.value)}
                          className="pl-7 bg-white/10 border-white/30 text-white"
                          data-testid="input-yearbook-price"
                        />
                      </div>
                      <p className="text-xs text-white/60 mt-1">
                        Range: $1.99 - $49.99
                      </p>
                    </div>

                    {canIncreasePrice && !canIncreasePrice.canIncrease && (
                      <div className="bg-orange-500/20 border border-orange-500/30 rounded p-2">
                        <p className="text-xs text-orange-200 flex items-start gap-1">
                          <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                          <span>{canIncreasePrice.message}</span>
                        </p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          const price = parseFloat(priceInput);
                          if (isNaN(price) || price < 1.99 || price > 49.99) {
                            toast({
                              className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
                              title: "Invalid price",
                              description: "Price must be between $1.99 and $49.99",
                              variant: "destructive",
                            });
                            return;
                          }
                          
                          const currentPrice = yearbook?.price ? parseFloat(yearbook.price) : 0;
                          const isIncrease = price > currentPrice;
                          
                          // Check if trying to increase within cooldown period
                          if (isIncrease && canIncreasePrice && !canIncreasePrice.canIncrease) {
                            toast({
                              className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
                              title: "Price increase not allowed",
                              description: canIncreasePrice.message,
                              variant: "destructive",
                            });
                            return;
                          }
                          
                          // Show confirmation dialog for any price change
                          setShowPriceConfirmDialog(true);
                        }}
                        disabled={updatePriceMutation.isPending}
                        className="flex-1"
                        data-testid="button-save-price"
                      >
                        <Check className="h-3 w-3 mr-1" />
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setPriceInput(yearbook?.price || "");
                          setIsEditingPrice(false);
                        }}
                        className="flex-1"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-baseline justify-between mb-3">
                      <span className="text-2xl font-bold text-white">
                        {yearbook?.price ? `$${yearbook.price}` : "Not Set"}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setIsEditingPrice(true)}
                        className="h-7 px-2 text-white/80 hover:text-white"
                        data-testid="button-edit-price"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                    </div>
                    
                    {priceHistory && priceHistory.length > 0 && (
                      <div className="border-t border-white/20 pt-3">
                        <p className="text-xs text-white/60 mb-2">Price History</p>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {priceHistory.slice(0, 3).map((history: any, index: number) => (
                            <div key={index} className="text-xs text-white/70">
                              <div className="flex justify-between">
                                <span>${history.oldPrice} → ${history.newPrice}</span>
                              </div>
                              <div className="text-white/50">
                                {new Date(history.changedAt).toLocaleDateString()}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Table of Contents Card */}
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl rounded-lg p-4 lg:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white">Table of Contents</h3>
                <Button
                  
                  className="bg-blue-500/40 backdrop-blur-lg border border-blue-500 shadow-2xl cursor-pointer transition-all hover:bg-blue-410 hover:scale-105 hover:border-blue-700 hover"
                  size="sm"
                  onClick={() => setShowTOCDialog(true)}
                  data-testid="button-add-toc-item"
                >
                  <Plus className="h-4 w-4 text-white" />
                </Button>
              </div>
            
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {/* Existing TOC items */}
              {yearbook?.tableOfContents?.map((item) => (
                <div key={item.id} className="p-3 border rounded-lg">
                  {editingTOCId === item.id ? (
                    // Edit mode
                    <div className="space-y-2">
                      <Input
                        value={editingTOCData.title}
                        onChange={(e) => setEditingTOCData({ ...editingTOCData, title: e.target.value })}
                        placeholder="Title"
                        className="text-sm"
                      />
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          min="1"
                          value={editingTOCData.pageNumber}
                          onChange={(e) => setEditingTOCData({ ...editingTOCData, pageNumber: parseInt(e.target.value) || 1 })}
                          className="text-xs w-20"
                        />
                        <Input
                          value={editingTOCData.description}
                          onChange={(e) => setEditingTOCData({ ...editingTOCData, description: e.target.value })}
                          placeholder="Description (optional)"
                          className="text-xs flex-1"
                        />
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          onClick={() => {
                            updateTOCMutation.mutate({ tocId: item.id, updates: editingTOCData });
                          }}
                          disabled={!editingTOCData.title || updateTOCMutation.isPending}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingTOCId(null);
                            setEditingTOCData({ title: "", pageNumber: 1, description: "" });
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // View mode
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium text-sm text-white">{item.title}</p>
                        <p className="text-xs text-blue-50">Content Page {item.pageNumber}</p>
                        {item.description && (
                          <p className="text-xs text-blue-50 mt-1">{item.description}</p>
                        )}
                      </div>
                      <div className="flex gap-1 ml-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingTOCId(item.id);
                            setEditingTOCData({
                              title: item.title,
                              pageNumber: item.pageNumber,
                              description: item.description || ""
                            });
                          }}
                          className="p-1 h-6 w-6"
                          title="Edit item"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteTOCMutation.mutate(item.id)}
                          disabled={deleteTOCMutation.isPending}
                          className="p-1 h-6 w-6"
                          title="Delete item"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Pending TOC items (for published yearbooks) */}
              {pendingTOCItems.map((item) => (
                <div key={item.tempId} className="p-3 border-2 bg-orange-600/60 backdrop-blur-lg border border-white/20 shadow-2xl
 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium text-sm text-white">{item.title}</p>
                      <p className="text-xs text-gray-50">Content Page {item.pageNumber} (Pending)</p>
                      {item.description && (
                        <p className="text-xs text-orange-500 mt-1">{item.description}</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        setPendingTOCItems(prev => prev.filter(p => p.tempId !== item.tempId));
                        if (pendingTOCItems.length === 1 && pendingPageUploads.length === 0) {
                          setHasUnsavedChanges(false);
                        }
                      }}
                      className="p-1 h-6 w-6 ml-2"
                      title="Remove pending item"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}

              {(!yearbook?.tableOfContents || yearbook.tableOfContents.length === 0) && pendingTOCItems.length === 0 && (
                <p className="text-white/60 text-sm text-center py-4">No items added yet</p>
              )}
            </div>
          </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col gap-6">

            {/* Live Preview Card */}
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl rounded-lg">
              <div className="p-4 border-b border-white/20">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-white" />
                    <h2 className="text-base font-semibold text-white">Live Preview</h2>
                    {hasUnsavedChanges && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/30 border border-yellow-400/40 text-yellow-300">
                        Includes unsaved changes
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-white/60">How viewers will see this yearbook</span>
                </div>
              </div>
              <div className="p-4">
                {(() => {
                  const savedFrontCover = yearbook?.pages?.find(p => p.pageType === "front_cover");
                  const pendingFrontCover = pendingPageUploads.find(p => p.pageType === "front_cover");
                  const savedBackCover = yearbook?.pages?.find(p => p.pageType === "back_cover");
                  const pendingBackCover = pendingPageUploads.find(p => p.pageType === "back_cover");

                  const savedContent = (yearbook?.pages?.filter(p => p.pageType === "content") || []).map(p => ({
                    id: p.id,
                    imageUrl: getSecureImageUrl(p.imageUrl) || '',
                    pageType: p.pageType as string,
                    pageNumber: p.pageNumber,
                    isDraft: false,
                    label: `Page ${p.pageNumber}`,
                  }));
                  // In PDF mode, pending content is a raw PDF blob — can't be shown in <img>.
                  // Only include image-mode pending uploads in the preview.
                  const pendingContent = yearbook?.uploadType === "pdf"
                    ? []
                    : pendingPageUploads.filter(p => p.pageType === "content").map(p => ({
                        id: p.tempId,
                        imageUrl: p.tempUrl as string,
                        pageType: p.pageType as string,
                        pageNumber: p.pageNumber as number,
                        isDraft: true,
                        label: `Page ${p.pageNumber} (Draft)`,
                      }));

                  const previewPages: Array<{ id: any; imageUrl: string; pageType: string; pageNumber: number; isDraft: boolean; label: string }> = [];

                  if (pendingFrontCover) {
                    previewPages.push({ id: pendingFrontCover.tempId, imageUrl: pendingFrontCover.tempUrl as string, pageType: "front_cover", pageNumber: 0, isDraft: true, label: "Front Cover (Draft)" });
                  } else if (savedFrontCover) {
                    previewPages.push({ id: savedFrontCover.id, imageUrl: getSecureImageUrl(savedFrontCover.imageUrl) || '', pageType: "front_cover", pageNumber: 0, isDraft: false, label: "Front Cover" });
                  }

                  const allContent = [...savedContent, ...pendingContent].sort((a, b) => a.pageNumber - b.pageNumber);
                  previewPages.push(...allContent);

                  if (pendingBackCover) {
                    previewPages.push({ id: pendingBackCover.tempId, imageUrl: pendingBackCover.tempUrl as string, pageType: "back_cover", pageNumber: 9999, isDraft: true, label: "Back Cover (Draft)" });
                  } else if (savedBackCover) {
                    previewPages.push({ id: savedBackCover.id, imageUrl: getSecureImageUrl(savedBackCover.imageUrl) || '', pageType: "back_cover", pageNumber: 9999, isDraft: false, label: "Back Cover" });
                  }

                  const aspectRatio = yearbook?.detectedAspectRatio || "3/4";

                  if (previewPages.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <BookOpen className="h-12 w-12 text-white/30 mb-4" />
                        <p className="text-white/60 text-sm">No pages yet</p>
                        <p className="text-white/40 text-xs mt-1">Upload pages below to see the preview here</p>
                      </div>
                    );
                  }

                  const safeIndex = Math.min(previewCurrentIndex, previewPages.length - 1);
                  const currentPreviewPage = previewPages[safeIndex];

                  return (
                    <div className="flex flex-col items-center gap-4">
                      <div className="flex items-center justify-center w-full gap-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPreviewCurrentIndex(Math.max(0, safeIndex - 1))}
                          disabled={safeIndex === 0}
                          className="flex-shrink-0 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-full p-2"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </Button>

                        <div className="flex flex-col items-center gap-2">
                          {currentPreviewPage.isDraft && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/30 border border-yellow-400/40 text-yellow-300">
                              Draft — Not yet saved
                            </span>
                          )}
                          <div
                            className="relative border border-white/20 rounded shadow-2xl overflow-hidden bg-black/20"
                            style={{ aspectRatio, width: "min(200px, 30vw)" }}
                          >
                            <img
                              src={currentPreviewPage.imageUrl}
                              alt={currentPreviewPage.label}
                              className="w-full h-full object-contain"
                              draggable={false}
                            />
                          </div>
                          <p className="text-sm text-white/70">{currentPreviewPage.label}</p>
                          <p className="text-xs text-white/40">{safeIndex + 1} / {previewPages.length}</p>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPreviewCurrentIndex(Math.min(previewPages.length - 1, safeIndex + 1))}
                          disabled={safeIndex === previewPages.length - 1}
                          className="flex-shrink-0 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-full p-2"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </Button>
                      </div>

                      {previewPages.length > 1 && (
                        <div
                          ref={previewThumbsRef}
                          className="flex gap-2 overflow-x-auto pb-1 max-w-full [&::-webkit-scrollbar]:hidden"
                          style={{
                            scrollbarWidth: 'none',
                            msOverflowStyle: 'none',
                            scrollSnapType: 'x mandatory',
                            WebkitOverflowScrolling: 'touch',
                          }}
                        >
                          {previewPages.map((page, idx) => (
                            <button
                              key={page.id}
                              onClick={() => setPreviewCurrentIndex(idx)}
                              title={page.label}
                              className={`flex-shrink-0 border-2 rounded overflow-hidden transition-all duration-150 ${idx === safeIndex ? 'border-blue-400 scale-110 shadow-lg' : 'border-white/20 hover:border-white/50 opacity-70 hover:opacity-100'}`}
                              style={{ width: 44, aspectRatio, scrollSnapAlign: 'center' }}
                            >
                              <img src={page.imageUrl} alt={page.label} className="w-full h-full object-cover" draggable={false} />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl rounded-lg flex flex-col" style={{ maxHeight: 'calc(100vh - 220px)' }}>
              <div className="p-4 border-b border-white/20 flex-shrink-0">
                <div className="flex justify-between items-center">
                  <h2 className="text-base font-semibold text-white">Yearbook Pages</h2>
                  
                </div>
              </div>
              <div className="overflow-y-auto flex-1">

              {/* Cover Pages - Only show in image upload mode */}
              {yearbook?.uploadType !== "pdf" && (
              <div className="p-4">
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {/* Front Cover */}
                  <div className="border-2 border-dashed border-white/30 rounded-lg p-3 text-center">
                    <div className="mb-2">
                      <FileText className="h-5 w-5 text-white/60 mx-auto mb-1" />
                      <h3 className="text-sm font-medium text-white">Front Cover</h3>
                      <p className="text-xs text-white/80">Required</p>
                    </div>
                    
                    {yearbook?.pages?.find(p => p.pageType === "front_cover") ? (
                      <div>
                        <img
                          src={getSecureImageUrl(yearbook.pages.find(p => p.pageType === "front_cover")?.imageUrl) || ''}
                          alt="Front Cover"
                          className="w-full h-20 object-cover rounded mb-2 pointer-events-none"
                        />
                        <div className="flex justify-center">
                          <Button
                            className="text-red-500 bg-white-700 backdrop-blur-lg border border-red-500 shadow-2xl cursor-pointer transition-all hover:bg-red-410 hover:scale-105"
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              const frontCover = yearbook.pages.find(p => p.pageType === "front_cover");
                              if (frontCover) {
                                deletePageMutation.mutate(frontCover.id);
                              }
                            }}
                            data-testid="button-delete-front-cover"
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                          
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        
                       className="text-blue-50 bg-blue-500/40 backdrop-blur-lg border border-blue-500 shadow-2xl cursor-pointer transition-all hover:bg-blue-410 hover:scale-105 hover:border-blue-700 hover:scale-105 transition-all duration-200"
                        onClick={() => {
                          setSelectedPageType("front_cover");
                          setShowUploadDialog(true);
                        }}
                        data-testid="button-upload-front-cover"
                      >
                        <Upload className="h-4 w-4 mr-2 text-blue-50" />
                        Upload Front Cover
                      </Button>
                    )}
                  </div>

                  {/* Back Cover */}
                  <div className="border-2 border-dashed border-white/30 rounded-lg p-3 text-center">
                    <div className="mb-2">
                      <FileText className="h-5 w-5 text-white/60 mx-auto mb-1" />
                      <h3 className="text-sm font-medium text-white">Back Cover</h3>
                      <p className="text-xs text-white/80">Required</p>
                    </div>
                    
                    {yearbook?.pages?.find(p => p.pageType === "back_cover") ? (
                      <div>
                        <img
                          src={getSecureImageUrl(yearbook.pages.find(p => p.pageType === "back_cover")?.imageUrl) || ''}
                          alt="Back Cover"
                          className="w-full h-20 object-cover rounded mb-2"
                        />
                        <div className="flex justify-center">
                          <Button
                            className="text-red-500 bg-white-700 backdrop-blur-lg border border-red-500 shadow-2xl cursor-pointer transition-all hover:bg-red-410 hover:scale-105"
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              const backCover = yearbook.pages.find(p => p.pageType === "back_cover");
                              if (backCover) {
                                deletePageMutation.mutate(backCover.id);
                              }
                            }}
                            data-testid="button-delete-back-cover"
                          > <Trash2 className="h-3 w-3 mr-1 text-center" /> 
 </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        className="text-blue-50 bg-blue-500/40 backdrop-blur-lg border border-blue-500 shadow-2xl cursor-pointer transition-all hover:bg-blue-410 hover:scale-105 hover:border-blue-700 hover:scale-105 transition-all duration-200"
                        onClick={() => {
                          setSelectedPageType("back_cover");
                          setShowUploadDialog(true);
                        }}
                        data-testid="button-upload-back-cover"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Back Cover
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              )}

                {/* Content Pages */}
                <div className="p-4 sm:p-6">
                  <h3 className="font-medium text-white mb-4">Content Pages</h3>
                  
                  {/* Image Upload Mode: Drag-and-drop multi-image management */}
                  {yearbook?.uploadType !== "pdf" && (
                  <>
                  {/* Page Management Instructions */}
                  <div className="bg-blue-500/20 border border-blue-400/30 rounded-lg p-3 mb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm text-blue-200 mb-1 font-medium">Page Organization</p>
                        <p className="text-xs text-blue-300">
                          Drag and drop pages to reorder them, or click preview to view a page and delete to remove it.
                        </p>
                      </div>
                      {(yearbook?.pages?.filter(p => p.pageType === "content").length || 0) > 0 && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setShowDeleteAllPagesDialog(true)}
                          className="bg-red-500/80 hover:bg-red-600 border border-red-400 ml-4"
                          data-testid="button-delete-all-pages"
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Delete All
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {/* Drag and Drop Grid Layout */}
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragEnd={handleDragEnd}
                    measuring={measuringConfig}
                    autoScroll={{
                      enabled: true,
                      threshold: {
                        x: 0.2,
                        y: 0.2,
                      },
                      acceleration: 10,
                    }}
                  >
                    <SortableContext
                      items={(() => {
                        const publishedPages = (yearbook?.pages?.filter(p => p.pageType === "content") || []).map(p => ({ 
                          id: p.id, 
                          pageNumber: p.pageNumber
                        }));
                        const pendingPages = pendingPageUploads.filter(p => p.pageType === "content").map(p => ({ 
                          id: p.tempId, 
                          pageNumber: p.pageNumber
                        }));
                        const allPages = [...publishedPages, ...pendingPages].sort((a, b) => a.pageNumber - b.pageNumber);
                        return allPages.map(p => p.id);
                      })()}
                      strategy={rectSortingStrategy}
                    >
                      <div 
                        ref={scrollContainerRef}
                        className="grid gap-4 p-4 justify-items-center"
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, 200px)',
                          gap: '16px',
                          justifyContent: 'start',
                          touchAction: 'pan-y',
                          maxHeight: '520px',
                          overflowY: 'auto',
                        }}
                        data-testid="pages-grid"
                      >
                        {/* Render pages and pending uploads in sorted order by page number */}
                        {(() => {
                          const publishedPages = (yearbook?.pages?.filter(p => p.pageType === "content") || []).map(p => ({ 
                            type: 'published' as const, 
                            data: p, 
                            pageNumber: p.pageNumber,
                            id: p.id
                          }));
                          
                          const pendingPages = pendingPageUploads.filter(p => p.pageType === "content").map(p => ({ 
                            type: 'pending' as const, 
                            data: p, 
                            pageNumber: p.pageNumber,
                            id: p.tempId
                          }));
                          
                          const allPages = [...publishedPages, ...pendingPages].sort((a, b) => a.pageNumber - b.pageNumber);
                          
                          return allPages.map((item, index) => {
                            const visualPageNumber = index + 1; // Sequential visual numbering
                            
                            if (item.type === 'published') {
                              const page = item.data;
                              return (
                                <SortablePage 
                                  key={page.id}
                                  page={{...page, pageNumber: visualPageNumber}}
                                  index={index}
                                  onPreview={(pageId: string) => {
                                    setPreviewPageId(pageId);
                                    setShowPreviewDialog(true);
                                  }}
                                  onDelete={(pageId: string) => deletePageMutation.mutate(pageId)}
                                  reorderPending={reorderPageMutation.isPending}
                                  totalPages={allPages.length}
                                  isDragging={activePageId === page.id}
                                  editingPageId={editingPageId}
                                  tempPageNumber={tempPageNumber}
                                  onStartEditingPageNumber={startEditingPageNumber}
                                  onCancelEditingPageNumber={cancelEditingPageNumber}
                                  onManualPageChange={handleManualPageChange}
                                  onMoveLeft={handleMovePageLeft}
                                  onMoveRight={handleMovePageRight}
                                  aspectRatio={yearbook?.detectedAspectRatio || null}
                                />
                              );
                            } else {
                              const pendingPage = item.data;
                              return (
                                <SortablePendingPage
                                  key={pendingPage.tempId}
                                  pendingPage={{...pendingPage, pageNumber: visualPageNumber}}
                                  totalPages={allPages.length}
                                  editingPageId={editingPageId}
                                  tempPageNumber={tempPageNumber}
                                  onStartEditingPageNumber={startEditingPageNumber}
                                  onCancelEditingPageNumber={cancelEditingPageNumber}
                                  onManualPageChange={handleManualPageChange}
                                  onPreview={() => {
                                    setPreviewPendingUrl(pendingPage.tempUrl);
                                    setPreviewPageId(null);
                                    setShowPreviewDialog(true);
                                  }}
                                  onMoveLeft={() => {
                                    // Find current position in allPages
                                    const currentIndex = allPages.findIndex(p => p.id === pendingPage.tempId);
                                    if (currentIndex > 0) {
                                      // Swap with previous item
                                      const targetItem = allPages[currentIndex - 1];
                                      const currentPageNumber = pendingPage.pageNumber;
                                      const targetPageNumber = targetItem.pageNumber;
                                      
                                      // If swapping with another pending page
                                      if (targetItem.type === 'pending') {
                                        const updatedPending = pendingPageUploads.map(p => {
                                          if (p.tempId === pendingPage.tempId) {
                                            return { ...p, pageNumber: targetPageNumber };
                                          } else if (p.tempId === targetItem.id) {
                                            return { ...p, pageNumber: currentPageNumber };
                                          }
                                          return p;
                                        });
                                        setPendingPageUploads(updatedPending);
                                      } 
                                      // If swapping with a published page
                                      else if (targetItem.type === 'published') {
                                        // Update pending page
                                        const updatedPending = pendingPageUploads.map(p => {
                                          if (p.tempId === pendingPage.tempId) {
                                            return { ...p, pageNumber: targetPageNumber };
                                          }
                                          return p;
                                        });
                                        setPendingPageUploads(updatedPending);
                                        
                                        // Update published page to swap positions
                                        apiRequest("PATCH", `/api/yearbooks/pages/${targetItem.id}/reorder`, {
                                          pageNumber: currentPageNumber
                                        }).then(() => {
                                          queryClient.invalidateQueries({ queryKey: ["/api/yearbooks", schoolId, year] });
                                        });
                                      }
                                    }
                                  }}
                                  onMoveRight={() => {
                                    // Find current position in allPages
                                    const currentIndex = allPages.findIndex(p => p.id === pendingPage.tempId);
                                    if (currentIndex < allPages.length - 1) {
                                      // Swap with next item
                                      const targetItem = allPages[currentIndex + 1];
                                      const currentPageNumber = pendingPage.pageNumber;
                                      const targetPageNumber = targetItem.pageNumber;
                                      
                                      // If swapping with another pending page
                                      if (targetItem.type === 'pending') {
                                        const updatedPending = pendingPageUploads.map(p => {
                                          if (p.tempId === pendingPage.tempId) {
                                            return { ...p, pageNumber: targetPageNumber };
                                          } else if (p.tempId === targetItem.id) {
                                            return { ...p, pageNumber: currentPageNumber };
                                          }
                                          return p;
                                        });
                                        setPendingPageUploads(updatedPending);
                                      }
                                      // If swapping with a published page
                                      else if (targetItem.type === 'published') {
                                        // Update pending page
                                        const updatedPending = pendingPageUploads.map(p => {
                                          if (p.tempId === pendingPage.tempId) {
                                            return { ...p, pageNumber: targetPageNumber };
                                          }
                                          return p;
                                        });
                                        setPendingPageUploads(updatedPending);
                                        
                                        // Update published page to swap positions
                                        apiRequest("PATCH", `/api/yearbooks/pages/${targetItem.id}/reorder`, {
                                          pageNumber: currentPageNumber
                                        }).then(() => {
                                          queryClient.invalidateQueries({ queryKey: ["/api/yearbooks", schoolId, year] });
                                        });
                                      }
                                    }
                                  }}
                                  onDelete={() => {
                                    setPendingPageUploads(prev => prev.filter(p => p.tempId !== pendingPage.tempId));
                                    URL.revokeObjectURL(pendingPage.tempUrl);
                                    if (pendingPageUploads.length === 1) setHasUnsavedChanges(false);
                                  }}
                                  aspectRatio={yearbook?.detectedAspectRatio || null}
                                />
                              );
                            }
                          });
                        })()}
                        
                        {/* Add Page Button */}
                        <div
                          className="border-2 border-dashed border-white/30 rounded-lg p-4 flex items-center justify-center w-[200px]"
                          style={{ aspectRatio: yearbook?.detectedAspectRatio || '3/4' }}
                        >
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setSelectedPageType("content");
                              setShowUploadDialog(true);
                            }}
                            className="flex flex-col items-center h-full w-full hover:bg-white/10 transition-all duration-200"
                            data-testid="button-add-page"
                          >
                            <Plus className="h-8 w-8 text-white/60 mb-2" />
                            <span className="text-sm text-white/80">Add Page</span>
                          </Button>
                        </div>
                      </div>
                    </SortableContext>
                  </DndContext>
                  </>
                  )}
                  
                  {/* PDF Upload Mode: Single PDF upload with auto-extraction */}
                  {yearbook?.uploadType === "pdf" && (
                  <>
                  <div className="bg-blue-500/20 border border-blue-400/30 rounded-lg p-3 mb-4">
                    <p className="text-sm text-blue-200 mb-1 font-medium">PDF Upload Mode</p>
                    <p className="text-xs text-blue-300">
                      Upload your complete yearbook as a single PDF file. All pages will be automatically extracted and cannot be reordered.
                    </p>
                  </div>
                  
                  {/* PDF Upload Button */}
                  <div className="border-2 border-dashed border-white/30 rounded-lg p-8 text-center">
                    <FileText className="h-12 w-12 text-white/60 mx-auto mb-4" />
                    <h4 className="font-medium text-white mb-2">Upload Complete Yearbook PDF</h4>
                    <p className="text-sm text-white/60 mb-4">Select a PDF file containing all yearbook pages (including covers)</p>
                    <Button
                      className="text-blue-50 bg-blue-500/40 backdrop-blur-lg border border-blue-500 shadow-2xl cursor-pointer transition-all hover:bg-blue-410 hover:scale-105"
                      onClick={() => {
                        setSelectedPageType("content");
                        setShowUploadDialog(true);
                      }}
                      data-testid="button-upload-pdf"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload PDF File
                    </Button>
                  </div>
                  
                  {/* Display extracted pages (read-only grid) */}
                  {yearbook?.pages && yearbook.pages.length > 0 && (
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium text-white">Extracted Pages ({yearbook.pages.length})</h4>
                      {/* Delete entire PDF upload button */}
                      {yearbook.pages.some(p => p.pdfUploadBatchId) && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            const pdfBatchId = yearbook.pages.find(p => p.pdfUploadBatchId)?.pdfUploadBatchId;
                            if (pdfBatchId) {
                              setPdfBatchIdToDelete(pdfBatchId);
                              setShowDeletePdfDialog(true);
                            }
                          }}
                          disabled={deletePdfBatchMutation.isPending}
                          className="bg-red-500/80 hover:bg-red-600 border border-red-400"
                          data-testid="button-delete-pdf-batch"
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          {deletePdfBatchMutation.isPending ? "Deleting..." : "Delete Entire PDF"}
                        </Button>
                      )}
                    </div>
                    <div 
                      className="grid gap-4 p-4"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, 200px)',
                        gap: '16px',
                        justifyContent: 'start'
                      }}
                    >
                      {yearbook.pages
                        .sort((a, b) => a.pageNumber - b.pageNumber)
                        .map((page, index) => (
                          <div 
                            key={page.id}
                            className="border-2 border-white/20 rounded-lg p-2 bg-white/5"
                          >
                            <img
                              src={getSecureImageUrl(page.imageUrl) || ''}
                              alt={`Page ${page.pageNumber}`}
                              className="w-full h-auto object-cover rounded mb-2"
                            />
                            <div className="text-center">
                              <p className="text-xs text-white/80">
                                {page.pageType === "front_cover" ? "Front Cover" : page.pageType === "back_cover" ? "Back Cover" : `Page ${page.pageNumber}`}
                              </p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                  )}
                  </>
                  )}
                </div>
              </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={(open) => {
        setShowUploadDialog(open);
        if (!open) {
          // Reset file input and uploading files when dialog closes
          const fileInput = document.getElementById('file-upload') as HTMLInputElement;
          if (fileInput) {
            fileInput.value = '';
          }
          setUploadingFiles([]);
        }
      }}>
        <DialogContent
          className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl
">
          <DialogHeader>
            <DialogTitle className="text-white">
              Upload {selectedPageType === "front_cover" ? "Front Cover" : 
                      selectedPageType === "back_cover" ? "Back Cover" : "Content Page"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="file-upload" className="text-blue-50">
                Select {selectedPageType === "content" ? "Image or PDF File" : "Image File"}{selectedPageType === "content" ? "s (multiple allowed)" : ""}
              </Label>
              <Input
                className="bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20"
                id="file-upload"
                type="file"
                accept={selectedPageType === "content" ? "image/*,.pdf" : "image/*"}
                multiple={selectedPageType === "content"}
                onChange={handleFileUpload}
              />
              <p className="text-xs text-white/50 mt-1">
                {selectedPageType === "content" 
                  ? "You can select multiple images or PDFs for content pages. They will be uploaded in sequence."
                  : yearbook?.detectedAspectRatio
                    ? `Upload images for this yearbook (page ratio: ${yearbook.detectedAspectRatio}). Change ratio in Settings.`
                    : "Upload images for this yearbook. Set a page ratio in Settings for consistent sizing."
                }
              </p>
            </div>
            
            {/* Batch Progress Overview */}
            {isUploading && fileUploadProgress.size > 0 && (
              <div className="p-3 rounded bg-blue-500/20 border border-blue-500/30">
                <p className="text-sm font-medium text-white mb-2">
                  Uploading {Array.from(fileUploadProgress.values()).filter(f => f.status === 'completed').length} of {uploadingFiles.length} files 
                  ({Math.round(Array.from(fileUploadProgress.values()).reduce((sum, f) => sum + f.progress, 0) / uploadingFiles.length)}%)
                </p>
              </div>
            )}
            
            {/* All uploads complete message */}
            {!isUploading && fileUploadProgress.size > 0 && Array.from(fileUploadProgress.values()).every(f => f.status === 'completed') && (
              <div className="p-3 rounded bg-green-500/20 border border-green-500/30 flex items-center gap-2">
                <Check className="h-5 w-5 text-green-400" />
                <p className="text-sm font-medium text-green-200">
                  All files uploaded successfully!
                </p>
              </div>
            )}
            
            {uploadingFiles.length > 0 && (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {uploadingFiles.map((file, index) => {
                  const fileId = Array.from(fileUploadProgress.entries()).find(([_, info]) => info.file === file)?.[0];
                  const progress = fileId ? fileUploadProgress.get(fileId) : null;
                  
                  return (
                    <div key={index} className="p-3 rounded bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-blue-50 truncate">{file.name}</p>
                          <p className="text-xs text-blue-50">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        
                        {/* Status indicator */}
                        {progress && progress.status === 'completed' && (
                          <div className="flex items-center gap-1 text-green-400 ml-2">
                            <Check className="h-4 w-4" />
                            <span className="text-xs">Complete</span>
                          </div>
                        )}
                        {progress && progress.status === 'failed' && (
                          <div className="flex items-center gap-1 ml-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => retryUpload(fileId!)}
                              className="h-6 px-2 text-xs text-red-400 hover:text-red-300 border-red-400/50"
                            >
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Retry
                            </Button>
                          </div>
                        )}
                        {!progress && !isUploading && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => removeUploadingFile(index)}
                            className="text-red-500 hover:text-red-700 h-6 px-2"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      
                      {/* Progress bar */}
                      {progress && (progress.status === 'uploading' || progress.status === 'completed') && (
                        <div className="space-y-1">
                          <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden">
                            <div 
                              className="h-full bg-blue-500 transition-all duration-300 ease-out"
                              style={{ width: `${progress.progress}%` }}
                            />
                          </div>
                          <p className="text-xs text-blue-100">
                            {Math.round(progress.progress)}%
                          </p>
                        </div>
                      )}
                      
                      {/* Error message */}
                      {progress && progress.status === 'failed' && (
                        <div className="mt-2 p-2 rounded bg-red-500/20 border border-red-500/30">
                          <p className="text-xs text-red-200 flex items-start gap-1">
                            <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                            <span>{progress.error || 'Upload failed'}</span>
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            
            <div className="flex justify-end space-x-2">
              <Button className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl
 text-red-500" variant="outline" onClick={() => setShowUploadDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleUploadSubmit}
                disabled={uploadingFiles.length === 0 || uploadPageMutation.isPending}
                data-testid="button-upload-files"
              >
                {uploadPageMutation.isPending ? (
                  uploadProgress.isProcessingPDF ? (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Processing PDF...</span>
                    </div>
                  ) : (
                    "Uploading..."
                  )
                ) : (
                  `Upload ${uploadingFiles.length > 1 ? `${uploadingFiles.length} Files` : "File"}`
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Table of Contents Dialog */}
      <Dialog open={showTOCDialog} onOpenChange={setShowTOCDialog}>
        <DialogContent className="bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20"
          >
          <DialogHeader >
            <DialogTitle>Add Table of Contents Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 ">
            <div>
              <Label htmlFor="toc-title">Title</Label>
              <Input
                id="toc-title"
                value={newTOCItem.title}
                onChange={(e) => setNewTOCItem({ ...newTOCItem, title: e.target.value })}
                placeholder=""
                className="bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20"
              />
            </div>
            
            <div>
              <Label htmlFor="toc-page">Content Page Number</Label>
              <Input
                
                id="toc-page"
                type="number"
                min="1"
                max={yearbook?.pages?.filter(p => p.pageType === "content")?.length || 1}
                value={newTOCItem.pageNumber || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setNewTOCItem({ 
                    ...newTOCItem, 
                    pageNumber: value === "" ? null : parseInt(value) || null 
                  });
                }}
                placeholder=""
                className="bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20"
              />
              {!newTOCItem.pageNumber && (
                <p className="text-xs text-gray-500 mt-1">Content page number is required</p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                Page numbers refer to content pages only (covers are not counted)
              </p>
            </div>
            
            <div>
              <Label htmlFor="toc-description">Description (Optional)</Label>
              <Input
                id="toc-description"
                value={newTOCItem.description}
                onChange={(e) => setNewTOCItem({ ...newTOCItem, description: e.target.value })}
                placeholder=""
                className="bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20"
              />
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button 
                className="bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20"
                variant="outline" 
                onClick={() => setShowTOCDialog(false)}>
                Cancel
              </Button>
              <Button
                className="bg-blue-500/40 backdrop-blur-lg border border-blue-500 shadow-2xl cursor-pointer transition-all hover:bg-blue-410 hover:scale-105 hover:border-blue-7"
                onClick={handleAddTOC}
                disabled={!newTOCItem.title || !newTOCItem.pageNumber || addTOCMutation.isPending}
              >
                Add Item
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Page Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={(open) => {
        setShowPreviewDialog(open);
        if (!open) {
          setPreviewPageId(null);
          setPreviewPendingUrl(null);
        }
      }}>
        <DialogContent className="max-w-2xl bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl
">
          <DialogHeader>
            <DialogTitle className="text-blue-50">Page Preview</DialogTitle>
          </DialogHeader>
          {previewPendingUrl ? (
            <div className="flex justify-center">
              <div className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl
">
                <img
                  src={previewPendingUrl}
                  alt="Pending page preview"
                  className="max-w-full max-h-96 object-contain"
                />
                <div className="p-3 bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl
">
                  <p className="text-sm font-medium text-blue-50">Pending Page (Unsaved)</p>
                </div>
              </div>
            </div>
          ) : previewPageId && (() => {
            const previewPage = yearbook?.pages?.find(p => p.id === previewPageId);
            return previewPage ? (
              <div className="flex justify-center">
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl
">
                  <img
                    src={getSecureImageUrl(previewPage.imageUrl) || ''}
                    alt={previewPage.title ?? ''}
                    className="max-w-full max-h-96 object-contain"
                  />
                  <div className="p-3 bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl
">
                    
                    {previewPage.pageType === "content" && (
                      <p className="text-sm font-medium text-blue-50">Page {previewPage.pageNumber}</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-center text-gray-500">Page not found</p>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Price Change Confirmation Dialog */}
      <Dialog open={showPriceConfirmDialog} onOpenChange={setShowPriceConfirmDialog}>
        <DialogContent className="bg-slate-900 border-white/20 text-white">
          <DialogHeader>
            <DialogTitle>Confirm Price Change</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-white/80">
              Are you sure you want to change this yearbook's price? This change cannot be modified again for the next 30 days.
            </p>
            <div className="flex items-center justify-between p-3 bg-white/10 rounded">
              <span className="text-white/80">Current Price:</span>
              <span className="font-semibold text-lg">{yearbook?.price ? `$${yearbook.price}` : "Not Set"}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-blue-500/20 rounded">
              <span className="text-white/80">New Price:</span>
              <span className="font-semibold text-lg">${priceInput}</span>
            </div>
            <div className="flex gap-3 mt-6">
              <Button
                onClick={() => {
                  if (yearbook?.id) {
                    updatePriceMutation.mutate({
                      yearbookId: yearbook.id,
                      price: parseFloat(priceInput).toFixed(2),
                    });
                  }
                  setShowPriceConfirmDialog(false);
                }}
                disabled={updatePriceMutation.isPending}
                className="flex-1"
                data-testid="button-confirm-price-change"
              >
                Confirm Change
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowPriceConfirmDialog(false)}
                data-testid="button-cancel-price-change"
                className="flex-1 text-red-500 bg-white-700 backdrop-blur-lg border border-red-500 shadow-2xl cursor-pointer transition-all hover:bg-red-410 hover:scale-105 hover:text-red-600"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Discard Changes Confirmation Dialog */}
      <Dialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <DialogContent className="bg-slate-900 border-white/20 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle>Discard Unsaved Changes?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-white/80 text-sm">
              All unsaved changes will be permanently removed. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setShowDiscardDialog(false);
                  discardChangesMutation.mutate();
                }}
                disabled={discardChangesMutation.isPending}
                className="flex-1 bg-red-500 hover:bg-red-600 border-0"
              >
                {discardChangesMutation.isPending ? "Discarding..." : "Discard Changes"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowDiscardDialog(false)}
                className="flex-1 text-white bg-white/10 backdrop-blur-lg border border-white/20 hover:bg-white/20"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteAllPagesDialog} onOpenChange={setShowDeleteAllPagesDialog}>
        <DialogContent className="bg-slate-900 border-white/20 text-white">
          <DialogHeader>
            <DialogTitle>Delete All Content Pages?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-white/80">
              Are you sure you want to delete all {yearbook?.pages?.filter(p => p.pageType === "content").length || 0} content pages? This action cannot be undone.
            </p>
            <div className="p-3 bg-red-500/20 border border-red-500/30 rounded">
              <p className="text-sm text-red-200">
                ⚠️ Warning: This will permanently delete all content pages. Covers will not be affected.
              </p>
            </div>
            <div className="flex gap-3 mt-6">
              <Button
                onClick={() => {
                  deleteAllPagesMutation.mutate();
                }}
                disabled={deleteAllPagesMutation.isPending}
                className="flex-1 bg-red-500 hover:bg-red-600"
                data-testid="button-confirm-delete-all-pages"
              >
                {deleteAllPagesMutation.isPending ? "Deleting..." : "Delete All Pages"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowDeleteAllPagesDialog(false)}
                data-testid="button-cancel-delete-all-pages"
                className="flex-1 text-white bg-white/10 backdrop-blur-lg border border-white/20 hover:bg-white/20"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete PDF Confirmation Dialog (with Password) */}
      <Dialog open={showDeletePdfDialog} onOpenChange={(open) => {
        setShowDeletePdfDialog(open);
        if (!open) {
          setDeletePassword("");
          setPdfBatchIdToDelete(null);
        }
      }}>
        <DialogContent className="bg-slate-900 border-white/20 text-white">
          <DialogHeader>
            <DialogTitle>Delete Entire PDF?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-white/80">
              Are you sure you want to delete all pages from this PDF upload? This action cannot be undone.
            </p>
            <div className="p-3 bg-red-500/20 border border-red-500/30 rounded">
              <p className="text-sm text-red-200 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>⚠️ Warning: This will permanently delete the PDF and all {yearbook?.pages?.length || 0} extracted pages.</span>
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="delete-password" className="text-white">
                Enter your password to confirm
              </Label>
              <Input
                id="delete-password"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Your password"
                className="bg-white/10 border-white/30 text-white placeholder:text-white/50"
                data-testid="input-delete-password"
              />
            </div>
            
            <div className="flex gap-3 mt-6">
              <Button
                onClick={async () => {
                  if (!deletePassword) {
                    toast({
                      className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
                      title: "Password required",
                      description: "Please enter your password to confirm deletion.",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  try {
                    await verifyPasswordMutation.mutateAsync(deletePassword);
                    // Password verified, proceed with deletion
                    if (pdfBatchIdToDelete) {
                      deletePdfBatchMutation.mutate(pdfBatchIdToDelete);
                    }
                  } catch (error: any) {
                    toast({
                      className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
                      title: "Incorrect password",
                      description: "The password you entered is incorrect.",
                      variant: "destructive",
                    });
                  }
                }}
                disabled={deletePdfBatchMutation.isPending || verifyPasswordMutation.isPending || !deletePassword}
                className="flex-1 bg-red-500 hover:bg-red-600"
                data-testid="button-confirm-delete-pdf"
              >
                {deletePdfBatchMutation.isPending || verifyPasswordMutation.isPending ? "Verifying..." : "Delete PDF"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeletePdfDialog(false);
                  setDeletePassword("");
                  setPdfBatchIdToDelete(null);
                }}
                data-testid="button-cancel-delete-pdf"
                className="flex-1 text-white bg-white/10 backdrop-blur-lg border border-white/20 hover:bg-white/20"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={(open) => {
        if (!open) {
          setShowUploadTypeConfirm(false);
          setPendingUploadType(null);
        }
        setShowSettingsDialog(open);
      }}>
        <DialogContent className="bg-slate-900 border-white/20 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Yearbook Settings
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5">

            {/* Upload Type */}
            {yearbook?.uploadType && (
              <div className="space-y-2">
                <Label className="text-white/80 text-sm font-semibold">Upload Type</Label>
                {!showUploadTypeConfirm ? (
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {yearbook.uploadType === 'pdf' ? 'PDF Upload' : 'Image Upload'}
                      </p>
                      <p className="text-xs text-white/50 mt-1">
                        {yearbook.uploadType === 'pdf'
                          ? 'Pages are sourced from an uploaded PDF file'
                          : 'Pages are uploaded as individual images'}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-white bg-white/10 border-white/20 hover:bg-white/20 shrink-0 ml-4"
                      onClick={() => {
                        const next = yearbook.uploadType === 'pdf' ? 'image' : 'pdf';
                        setPendingUploadType(next);
                        setShowUploadTypeConfirm(true);
                      }}
                    >
                      Switch to {yearbook.uploadType === 'pdf' ? 'Image' : 'PDF'}
                    </Button>
                  </div>
                ) : (
                  <div className="p-4 bg-red-500/10 border border-red-500/40 rounded-lg space-y-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-red-300">This will delete all existing content</p>
                        <p className="text-xs text-white/60 mt-1">
                          {yearbook.uploadType === 'pdf'
                            ? 'Switching to Image upload will permanently delete the uploaded PDF and all its pages.'
                            : 'Switching to PDF upload will permanently delete all uploaded images and pages.'}
                          {' '}This cannot be undone.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white border-0"
                        disabled={resetUploadTypeMutation.isPending}
                        onClick={() => {
                          if (pendingUploadType) resetUploadTypeMutation.mutate(pendingUploadType);
                        }}
                      >
                        {resetUploadTypeMutation.isPending ? "Deleting..." : `Yes, switch to ${pendingUploadType === 'pdf' ? 'PDF' : 'Image'}`}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-white bg-white/10 border-white/20 hover:bg-white/20"
                        disabled={resetUploadTypeMutation.isPending}
                        onClick={() => { setShowUploadTypeConfirm(false); setPendingUploadType(null); }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Pricing Toggle */}
            <div className="space-y-2">
              <Label className="text-white/80 text-sm font-semibold">Pricing</Label>
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">
                    {BETA_VERSION ? "Free Access" : isFreeYearbook ? "Free Access" : "Payment Required"}
                  </p>
                  <p className="text-xs text-white/50 mt-1">
                    {BETA_VERSION ? "Payment is disabled during beta — all yearbooks are free" : isFreeYearbook ? "Anyone can view this yearbook for free" : "Viewers must pay to access this yearbook"}
                  </p>
                </div>
                <Switch
                  id="setting-free-yearbook"
                  checked={BETA_VERSION ? false : !isFreeYearbook}
                  onCheckedChange={(checked) => { if (!BETA_VERSION) setIsFreeYearbook(!checked); }}
                  disabled={BETA_VERSION}
                  data-testid="switch-requires-payment"
                />
              </div>
            </div>

            {/* Page Aspect Ratio Picker */}
            <div className="space-y-3">
              <div>
                <Label className="text-white/80 text-sm font-semibold">Page Aspect Ratio</Label>
                <p className="text-xs text-white/50 mt-0.5">Choose the ratio that matches your page images — like selecting a canvas size in Canva.</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { label: '3:4', ratio: '3/4', w: 3, h: 4, desc: 'Portrait' },
                  { label: '9:16', ratio: '9/16', w: 9, h: 16, desc: 'Tall' },
                  { label: '1:1', ratio: '1/1', w: 1, h: 1, desc: 'Square' },
                  { label: '4:3', ratio: '4/3', w: 4, h: 3, desc: 'Landscape' },
                  { label: '16:9', ratio: '16/9', w: 16, h: 9, desc: 'Wide' },
                ] as const).map(({ label, ratio, w, h, desc }) => {
                  const isSelected = settingsAspectRatio === ratio;
                  const previewW = w >= h ? 40 : Math.round(40 * w / h);
                  const previewH = h >= w ? 40 : Math.round(40 * h / w);
                  return (
                    <button
                      key={ratio}
                      type="button"
                      onClick={() => { setSettingsAspectRatio(ratio); setCustomModeActive(false); }}
                      className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-all ${
                        isSelected
                          ? 'border-blue-400 bg-blue-500/20 ring-2 ring-blue-400/50'
                          : 'border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/40'
                      }`}
                    >
                      <div className="flex items-center justify-center" style={{ width: 44, height: 44 }}>
                        <div
                          className={`rounded-sm border-2 ${isSelected ? 'border-blue-400 bg-blue-400/20' : 'border-white/50 bg-white/10'}`}
                          style={{ width: previewW, height: previewH }}
                        />
                      </div>
                      <span className={`text-xs font-semibold ${isSelected ? 'text-blue-300' : 'text-white/70'}`}>{label}</span>
                      <span className={`text-[10px] ${isSelected ? 'text-blue-200/70' : 'text-white/40'}`}>{desc}</span>
                    </button>
                  );
                })}

                {/* Custom ratio button */}
                {(() => {
                  const isSelected = customModeActive || isCustomRatio(settingsAspectRatio);
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        if (!isSelected) {
                          setCustomModeActive(true);
                          setCustomWidth('');
                          setCustomHeight('');
                          setSettingsAspectRatio(null);
                        }
                      }}
                      className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-all ${
                        isSelected
                          ? 'border-purple-400 bg-purple-500/20 ring-2 ring-purple-400/50'
                          : 'border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/40'
                      }`}
                    >
                      <div className="flex items-center justify-center" style={{ width: 44, height: 44 }}>
                        <span className={`text-lg font-bold ${isSelected ? 'text-purple-300' : 'text-white/40'}`}>?:?</span>
                      </div>
                      <span className={`text-xs font-semibold ${isSelected ? 'text-purple-300' : 'text-white/70'}`}>Custom</span>
                      <span className={`text-[10px] ${isSelected ? 'text-purple-200/70' : 'text-white/40'}`}>Any size</span>
                    </button>
                  );
                })()}
              </div>

              {/* Custom resolution inputs — shown when Custom is active */}
              {(customModeActive || isCustomRatio(settingsAspectRatio)) && (
                <div className="bg-white/5 rounded-lg p-3 space-y-2 border border-purple-400/30">
                  <p className="text-xs text-white/60">Enter your image resolution and the ratio is calculated automatically.</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] text-white/50 uppercase tracking-wide">Width (px)</label>
                      <input
                        type="number"
                        min="1"
                        placeholder="e.g. 1080"
                        value={customWidth}
                        onChange={(e) => {
                          const w = e.target.value;
                          setCustomWidth(w);
                          const h = customHeight;
                          if (w && h && parseInt(w) > 0 && parseInt(h) > 0) {
                            setSettingsAspectRatio(`${parseInt(w)}/${parseInt(h)}`);
                          }
                        }}
                        className="w-full mt-0.5 bg-white/10 border border-white/20 rounded px-2 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-purple-400"
                      />
                    </div>
                    <div className="text-white/40 mt-5 text-lg font-light">×</div>
                    <div className="flex-1">
                      <label className="text-[10px] text-white/50 uppercase tracking-wide">Height (px)</label>
                      <input
                        type="number"
                        min="1"
                        placeholder="e.g. 1920"
                        value={customHeight}
                        onChange={(e) => {
                          const h = e.target.value;
                          setCustomHeight(h);
                          const w = customWidth;
                          if (w && h && parseInt(w) > 0 && parseInt(h) > 0) {
                            setSettingsAspectRatio(`${parseInt(w)}/${parseInt(h)}`);
                          }
                        }}
                        className="w-full mt-0.5 bg-white/10 border border-white/20 rounded px-2 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-purple-400"
                      />
                    </div>
                  </div>
                  {settingsAspectRatio && isCustomRatio(settingsAspectRatio) && (
                    <p className="text-xs text-purple-300">
                      Calculated ratio: <span className="font-semibold">{settingsAspectRatio}</span>
                      {customWidth && customHeight && (
                        <span className="text-white/40 ml-2">
                          ({parseInt(customWidth) > parseInt(customHeight) ? 'Landscape' : parseInt(customWidth) < parseInt(customHeight) ? 'Portrait' : 'Square'})
                        </span>
                      )}
                    </p>
                  )}
                </div>
              )}

              {settingsAspectRatio && (
                <div className="flex items-center justify-between text-xs text-white/50 bg-white/5 rounded px-3 py-1.5">
                  <span>Current ratio: <span className="text-white font-medium">{settingsAspectRatio}</span></span>
                  <button
                    type="button"
                    onClick={() => { setSettingsAspectRatio(null); setCustomWidth(''); setCustomHeight(''); setCustomModeActive(false); }}
                    className="text-white/40 hover:text-white/70 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-1">
              <Button
                onClick={async () => {
                  if (yearbook?.id) {
                    const ratioChanged = settingsAspectRatio !== (yearbook.detectedAspectRatio || null);
                    const freeChanged = yearbook.isFree !== isFreeYearbook;
                    if (ratioChanged) {
                      await fetch(`/api/yearbooks/${yearbook.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ detectedAspectRatio: settingsAspectRatio })
                      });
                      queryClient.invalidateQueries({ queryKey: ["/api/yearbooks", schoolId, year] });
                    }
                    if (freeChanged) {
                      updateFreeStatusMutation.mutate({ yearbookId: yearbook.id, isFree: isFreeYearbook });
                    }
                  }
                  setShowSettingsDialog(false);
                }}
                className="flex-1"
                disabled={updateFreeStatusMutation.isPending}
                data-testid="button-save-settings"
              >
                {updateFreeStatusMutation.isPending ? "Saving..." : "Save Settings"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsFreeYearbook(yearbook?.isFree || false);
                  const r = yearbook?.detectedAspectRatio || null;
                  setSettingsAspectRatio(r);
                  if (r && isCustomRatio(r)) {
                    const parts = r.split('/');
                    if (parts.length === 2) { setCustomWidth(parts[0]); setCustomHeight(parts[1]); }
                    setCustomModeActive(true);
                  } else {
                    setCustomWidth(''); setCustomHeight(''); setCustomModeActive(false);
                  }
                  setShowSettingsDialog(false);
                }}
                data-testid="button-cancel-settings"
                className="flex-1 text-white bg-white/10 backdrop-blur-lg border border-white/20 hover:bg-white/20"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}