import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, ArrowRight, Upload, FolderOpen, HardDrive, Images, X, FileImage, Menu, Home, Settings, ShoppingCart, LogOut, Share2, Copy, Calendar, Clock, Check, XCircle, AlertTriangle, Eye, Edit2, Trash2, Search, Filter, Bell } from "lucide-react";
import EnhancedImageViewer from "@/components/ui/enhanced-image-viewer";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { School, Notification } from "@shared/schema";

// Form schema for memory upload
const memoryUploadSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  category: z.enum(['graduation', 'sports', 'arts', 'field_trips', 'academic']),
  file: z.instanceof(File).refine((file) => file.size <= 20 * 1024 * 1024, "File must be less than 20MB")
});

// Multiple upload file interface
interface MultipleUploadFile {
  file: File;
  title: string;
  description: string;
  id: string;
}

// Multiple upload form schema
const multipleUploadFormSchema = z.object({
  files: z.array(z.object({
    file: z.instanceof(File),
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    id: z.string()
  })).min(1, "At least one file is required")
    .refine((files) => {
      const totalSize = files.reduce((sum, item) => sum + item.file.size, 0);
      return totalSize <= 50 * 1024 * 1024;
    }, "Total file size must not exceed 50MB"),
  category: z.enum(['graduation', 'sports', 'arts', 'field_trips', 'academic'])
});

// Form schema for public upload link generation
const publicLinkSchema = z.object({
  category: z.enum(['graduation', 'sports', 'arts', 'field_trips', 'academic']),
  validFor: z.enum(['1', '6', '12', '24', '48']).transform(Number) // hours
});

type MemoryUploadForm = z.infer<typeof memoryUploadSchema>;
type MultipleUploadForm = z.infer<typeof multipleUploadFormSchema>;
type PublicLinkForm = z.infer<typeof publicLinkSchema>;

export default function PhotosMemoriesManage() {
  const [, setLocation] = useLocation();
  const [year, setYear] = useState<string>("");
  const [schoolId, setSchoolId] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [showHamburgerMenu, setShowHamburgerMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showPublicLinkDialog, setShowPublicLinkDialog] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<{ code: string; expiresAt: string } | null>(null);
  const [previewMemory, setPreviewMemory] = useState<any>(null);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  
  // State for edit dialog
  const [editMemory, setEditMemory] = useState<any>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editTitle, setEditTitle] = useState<string>("");
  const [editCategory, setEditCategory] = useState<string>("");
  
  // State for delete confirmation dialog
  const [memoryToDelete, setMemoryToDelete] = useState<any>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  // State for see all memories dialog
  const [showAllMemoriesDialog, setShowAllMemoriesDialog] = useState(false);
  
  // State for filtering and search
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  
  // State for upload mode (single vs multiple)
  const [uploadMode, setUploadMode] = useState<string>("single");
  
  // Multiple upload state
  const [multipleFiles, setMultipleFiles] = useState<MultipleUploadFile[]>([]);
  
  const { toast } = useToast();

  const form = useForm<MemoryUploadForm>({
    resolver: zodResolver(memoryUploadSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "graduation"
    }
  });

  const publicLinkForm = useForm<PublicLinkForm>({
    resolver: zodResolver(publicLinkSchema),
    defaultValues: {
      category: "graduation",
      validFor: "24"
    }
  });

  const multipleUploadForm = useForm<MultipleUploadForm>({
    resolver: zodResolver(multipleUploadFormSchema),
    defaultValues: {
      files: [],
      category: "graduation"
    }
  });

  useEffect(() => {
    // Extract year and schoolId from URL params
    const urlParams = new URLSearchParams(window.location.search);
    const yearParam = urlParams.get('year');
    const schoolParam = urlParams.get('school');
    
    if (yearParam) setYear(yearParam);
    if (schoolParam) setSchoolId(schoolParam);
  }, []);

  // Fetch school data
  const { data: school } = useQuery<School>({
    queryKey: ['/api/schools', schoolId],
    enabled: !!schoolId,
  });

  // Get user data
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  // Fetch notifications
  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['/api/notifications', user?.id],
    enabled: !!user,
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

  const handleBackToSchool = () => {
    // Navigate to school dashboard with photos/memories tab active
    setLocation("/school-dashboard?tab=memories");
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    setLocation("/");
  };

  // File selection handler
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      
      // Create preview URL
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      
      // Update form with file
      form.setValue('file', file);
    }
  };

  // Remove selected file
  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl("");
    }
    form.setValue('file', undefined as any);
  };

  // Multiple file handlers
  const handleMultipleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    
    const newFiles: MultipleUploadFile[] = files.map(file => ({
      file,
      title: `Memory - ${year}`,
      description: '',
      id: Math.random().toString(36).substr(2, 9)
    }));
    
    setMultipleFiles(prev => [...prev, ...newFiles]);
    
    // Update form
    const updatedFiles = [...multipleFiles, ...newFiles];
    multipleUploadForm.setValue('files', updatedFiles);
    
    // Clear file input
    event.target.value = '';
  };

  const removeMultipleFile = (id: string) => {
    setMultipleFiles(prev => {
      const updated = prev.filter(item => item.id !== id);
      multipleUploadForm.setValue('files', updated);
      return updated;
    });
  };

  const updateMultipleFileDetails = (id: string, field: 'title' | 'description', value: string) => {
    setMultipleFiles(prev => {
      const updated = prev.map(item => 
        item.id === id ? { ...item, [field]: value } : item
      );
      multipleUploadForm.setValue('files', updated);
      return updated;
    });
  };

  // Get total size of multiple files
  const getTotalSize = () => {
    return multipleFiles.reduce((sum, item) => sum + item.file.size, 0);
  };

  // Get formatted size
  const formatSize = (bytes: number) => {
    return (bytes / (1024 * 1024)).toFixed(2);
  };

  // Fetch existing memories for the year
  const { data: memoriesData = [], isLoading } = useQuery({
    queryKey: ['/api/memories/school', schoolId, year],
    enabled: !!schoolId && !!year,
    queryFn: async () => {
      const response = await fetch(`/api/memories/school/${schoolId}/${year}`);
      if (!response.ok) throw new Error('Failed to fetch memories');
      return response.json();
    },
    refetchInterval: 15000,
  });

  // Filter memories based on category and search term
  const filteredMemories = memoriesData.filter((memory: any) => {
    const matchesCategory = selectedCategory === "all" || memory.category === selectedCategory;
    const matchesSearch = searchTerm === "" || memory.title.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Get unique categories from memories for the tabs
  const availableCategories = ["all", ...Array.from(new Set(memoriesData.map((memory: any) => memory.category)))] as string[];

  // Category display names
  const categoryDisplayNames: Record<string, string> = {
    all: "All",
    graduation: "Graduation",
    sports: "Sports", 
    arts: "Arts",
    field_trips: "Field Trips",
    academic: "Academic"
  };

  // Fetch pending memories (only for school admins)
  const { data: pendingMemories = [], isLoading: pendingLoading } = useQuery({
    queryKey: ['/api/memories/school', schoolId, 'pending'],
    enabled: !!schoolId,
    queryFn: async () => {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (!user.id) throw new Error('Authentication required');
      
      const response = await fetch(`/api/memories/school/${schoolId}/pending`, {
        headers: {
          'Authorization': `Bearer ${user.id}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch pending memories');
      return response.json();
    },
    refetchInterval: 15000,
  });

  // Optimistic memory upload mutation
  const uploadMemoryMutation = useMutation({
    mutationFn: async (data: MemoryUploadForm) => {
      if (!schoolId || !year) throw new Error('Missing school ID or year');
      
      const formData = new FormData();
      formData.append('memoryFile', data.file);
      formData.append('title', data.title);
      formData.append('description', data.description || '');
      formData.append('eventDate', year);
      formData.append('year', year);
      formData.append('category', data.category);
      formData.append('schoolId', schoolId);

      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (!user.id) throw new Error('Authentication required');

      const response = await fetch('/api/memories', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.id}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to upload memory');
      }
      
      return response.json();
    },
    onMutate: async (data) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ['/api/memories/school', schoolId, year] });

      // Snapshot the previous memories
      const previousMemories = queryClient.getQueryData(['/api/memories/school', schoolId, year]);

      // Create optimistic memory with temporary preview
      const optimisticMemory = {
        id: `temp-${Date.now()}`,
        schoolId,
        title: data.title,
        description: data.description || '',
        imageUrl: previewUrl || '', // Use the preview URL we already have
        mediaType: 'image',
        eventDate: year,
        year: parseInt(year),
        category: data.category,
        createdAt: new Date(),
        uploading: true // Mark as uploading for UI feedback
      };

      // Optimistically add the memory to the beginning of the list
      queryClient.setQueryData(['/api/memories/school', schoolId, year], (old: any = []) => [
        optimisticMemory,
        ...old
      ]);

      // Show immediate success feedback
      toast({
        className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Uploading memory...",
        description: "Your photo is being added to the memories...",
      });

      // Reset form immediately for better UX
      form.reset();
      handleRemoveFile();

      // Return a context object with the snapshotted value
      return { previousMemories, optimisticMemory };
    },
    onError: (error, data, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      queryClient.setQueryData(['/api/memories/school', schoolId, year], context?.previousMemories || []);
      
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload memory. Please try again.",
        variant: "destructive"
      });
    },
    onSuccess: () => {
      // Show final success message
      toast({
        className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Memory uploaded successfully",
        description: "Your photo has been added to the memories."
      });
      
      // Refresh the memories to get the real server data with correct URLs
      queryClient.invalidateQueries({ queryKey: ['/api/memories/school', schoolId, year] });
    }
  });

  // Multiple upload mutation
  const multipleUploadMutation = useMutation({
    mutationFn: async (data: MultipleUploadForm) => {
      if (!schoolId || !year) throw new Error('Missing school ID or year');
      if (data.files.length === 0) throw new Error('No files selected');
      
      // Validate all files have titles
      const missingTitles = data.files.filter(item => !item.title.trim());
      if (missingTitles.length > 0) {
        throw new Error('All files must have titles');
      }
      
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (!user.id) throw new Error('Authentication required');
      
      const results: any[] = [];
      
      // Upload each file individually
      for (const fileItem of data.files) {
        const formData = new FormData();
        formData.append('memoryFile', fileItem.file);
        formData.append('title', fileItem.title);
        formData.append('description', fileItem.description || '');
        formData.append('eventDate', year);
        formData.append('year', year);
        formData.append('category', data.category);
        formData.append('schoolId', schoolId);

        const response = await fetch('/api/memories', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${user.id}`
          },
          body: formData
        });

        if (!response.ok) {
          throw new Error(`Failed to upload ${fileItem.title}`);
        }
        
        const result = await response.json();
        results.push(result);
      }
      
      return results;
    },
    onSuccess: (results) => {
      // Refresh memories list
      queryClient.invalidateQueries({ queryKey: ['/api/memories/school', schoolId, year] });
      
      toast({
        className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Upload successful",
        description: `${results.length} memories uploaded successfully.`
      });
      
      // Reset multiple upload state
      setMultipleFiles([]);
      multipleUploadForm.reset();
    },
    onError: (error) => {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive"
      });
    }
  });

  // Generate public upload link mutation
  const generatePublicLinkMutation = useMutation({
    mutationFn: async (data: PublicLinkForm) => {
      if (!schoolId || !year) throw new Error('Missing school ID or year');
      
      // Get user for authentication
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (!user.id) throw new Error('Authentication required');
      
      const response = await fetch('/api/public-upload-links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.id}`
        },
        body: JSON.stringify({
          schoolId,
          year: parseInt(year),
          category: data.category,
          validForHours: data.validFor
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create upload link');
      }

      return response.json();
    },
    onSuccess: (data) => {
      setGeneratedLink({
        code: data.linkCode,
        expiresAt: new Date(data.expiresAt).toLocaleString()
      });
      
      // Refresh the upload links list to show the new link
      queryClient.invalidateQueries({ queryKey: ['/api/public-upload-links/school', schoolId, year] });
      
      toast({
        className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Public upload link generated",
        description: "Share this link with external contributors to collect photos."
      });
    },
    onError: (error: any) => {
      if (error.message && error.message.includes("active upload link")) {
        toast({
          className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
          title: "Duplicate Link Exists",
          description: error.message,
          variant: "destructive"
        });
      } else {
        toast({
          className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
          title: "Failed to generate link",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "destructive"
        });
      }
    }
  });

  const onSubmit = (data: MemoryUploadForm) => {
    uploadMemoryMutation.mutate(data);
  };

  const onMultipleSubmit = (data: MultipleUploadForm) => {
    multipleUploadMutation.mutate(data);
  };

  const onGeneratePublicLink = (data: PublicLinkForm) => {
    generatePublicLinkMutation.mutate(data);
  };

  // Approve pending memory mutation
  const approveMemoryMutation = useMutation({
    mutationFn: async (memoryId: string) => {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (!user.id) throw new Error('Authentication required');
      
      const response = await fetch(`/api/memories/${memoryId}/approve`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.id}`
        },
        body: JSON.stringify({ approvedBy: user.id })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to approve memory');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Memory approved",
        description: "The memory has been approved and is now visible to all users."
      });
      
      // Refresh both pending and approved memories, and the nav badge count
      queryClient.invalidateQueries({ queryKey: ['/api/memories/school', schoolId, 'pending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/memories/school', schoolId, year] });
      queryClient.invalidateQueries({ queryKey: ['/api/memories/school/pending-count', schoolId] });
    },
    onError: (error) => {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Failed to approve memory",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive"
      });
    }
  });

  // Deny (delete) pending memory mutation
  const denyMemoryMutation = useMutation({
    mutationFn: async (memoryId: string) => {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (!user.id) throw new Error('Authentication required');
      
      const response = await fetch(`/api/memories/${memoryId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${user.id}`
        }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to deny memory');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Memory denied",
        description: "The memory has been denied and removed."
      });
      
      // Refresh pending memories and the nav badge count
      queryClient.invalidateQueries({ queryKey: ['/api/memories/school', schoolId, 'pending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/memories/school/pending-count', schoolId] });
    },
    onError: (error) => {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Failed to deny memory",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive"
      });
    }
  });

  // Update memory title and category mutation
  const updateMemoryTitleMutation = useMutation({
    mutationFn: async ({ memoryId, title, category }: { memoryId: string; title: string; category?: string }) => {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (!user.id) throw new Error('Authentication required');
      
      const response = await fetch(`/api/memories/${memoryId}/title`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.id}`
        },
        body: JSON.stringify({ title, category })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update memory');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Memory updated",
        description: "Memory has been updated successfully."
      });
      
      // Refresh memories to show updated title
      queryClient.invalidateQueries({ queryKey: ['/api/memories/school', schoolId, year] });
      queryClient.invalidateQueries({ queryKey: ['/api/memories/school', schoolId, 'pending'] });
    },
    onError: (error) => {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Failed to update title",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive"
      });
    }
  });

  // Delete uploaded memory mutation  
  const deleteMemoryMutation = useMutation({
    mutationFn: async (memoryId: string) => {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (!user.id) throw new Error('Authentication required');
      
      const response = await fetch(`/api/memories/${memoryId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${user.id}`
        }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete memory');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Memory deleted",
        description: "The memory has been permanently deleted."
      });
      
      // Refresh memories to remove deleted memory
      queryClient.invalidateQueries({ queryKey: ['/api/memories/school', schoolId, year] });
    },
    onError: (error) => {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Failed to delete memory",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive"
      });
    }
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Copied to clipboard",
        description: "The upload code has been copied to your clipboard."
      });
    });
  };

  const copyLinkToClipboard = (code: string) => {
    // Only copy the code for security - not the full URL
    navigator.clipboard.writeText(code).then(() => {
      toast({
        className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Code copied to clipboard",
        description: "Share this upload code with people to upload photos."
      });
    });
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
                variant="outline" 
                onClick={handleBackToSchool}
                className="text-white border-white/50 hover:bg-white/10 hover:text-white bg-white/10 mr-2 sm:mr-4 flex-shrink-0"
                data-testid="button-back-to-school"
              >
                <ArrowLeft className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Back</span>
              </Button>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-2xl font-bold text-white truncate">
                  Photos & Memories Management
                </h1>
                <p className="text-xs sm:text-sm text-white/80 truncate">
                  {year ? `Managing Year ${year}` : "Manage photos and memories"}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0">
              <span className="text-xs sm:text-sm font-medium text-white">
                <span className="sm:hidden truncate max-w-20">{school?.name?.split(" ")[0]}</span>
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
        <div className="hamburger-dropdown fixed top-16 right-2 sm:right-4 w-48 bg-blue-600/60 backdrop-blur-lg border border-white/20 rounded-lg shadow-xl z-[999999]">
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
            <div className="border-t border-white/20"></div>
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

      <div className="max-w-screen-2xl mx-auto px-2 sm:px-4 lg:px-8 xl:px-12 py-4 sm:py-8">
        <div className="space-y-4 sm:space-y-6">
          {/* Constant Memory Upload Link */}
          <Card className="bg-blue-500/20 backdrop-blur-lg border border-blue-400/40 shadow-2xl">
            <CardContent className="p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                <div className="flex items-center space-x-3">
                  <Upload className="h-5 w-5 text-blue-300 flex-shrink-0" />
                  <div className="min-w-0">
                    <h3 className="text-white font-semibold truncate">Memory Upload Portal</h3>
                    <p className="text-blue-100 text-xs sm:text-sm truncate">Share this link for external memory uploads</p>
                  </div>
                </div>
                <Button
                  onClick={() => {
                    const uploadUrl = `${window.location.origin}/guest-upload`;
                    navigator.clipboard.writeText(uploadUrl).then(() => {
                      toast({
                        className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
                        title: "Link copied!",
                        description: "Memory upload link has been copied to clipboard."
                      });
                    });
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto flex-shrink-0"
                  data-testid="button-copy-memory-upload-link"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Link
                </Button>
              </div>
              <div className="mt-3 p-2 bg-white/10 rounded-lg">
                <code className="text-xs text-blue-200 break-all">
                  {window.location.origin}/guest-upload
                </code>
              </div>
              <p className="text-xs text-blue-200 mt-2">
                Non-registered users will be prompted to enter codes. Logged-in viewers/alumni will go directly to upload.
              </p>
            </CardContent>
          </Card>
          {/* Pending Memories Section */}
          {pendingMemories.length > 0 && (
            <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
              <CardHeader>
                <CardTitle className="flex items-center text-white">
                  <Clock className="h-5 w-5 mr-2" />
                  Pending Memories Sent by Others ({pendingMemories.length})
                  <span className="ml-2 px-2 py-1 bg-orange-500/20 text-orange-300 text-xs rounded-full">
                    Awaiting Review
                  </span>
                </CardTitle>
                <p className="text-blue-100 text-sm">
                  These photos were submitted by external users and require your approval before they become visible.
                </p>
              </CardHeader>
              <CardContent>
                {pendingLoading ? (
                  <div className="text-center py-8">
                    <Clock className="h-12 w-12 text-blue-400 mx-auto mb-4 animate-spin" />
                    <p className="text-white">Loading pending memories...</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-6">
                      {pendingMemories.slice(0, 5).map((memory: any) => (
                      <div key={memory.id} className="relative group">
                        <Card className="bg-white/5 backdrop-blur-lg border border-white/10 hover:bg-white/10 transition-all duration-200">
                          <CardContent className="p-3 sm:p-4">
                            {/* Media Preview */}
                            <div 
                              className="aspect-square mb-3 rounded-lg overflow-hidden bg-black/20 border border-white/10 cursor-pointer hover:bg-black/30 transition-colors"
                              onClick={() => {
                                setPreviewMemory(memory);
                                setShowPreviewDialog(true);
                              }}
                              data-testid={`media-preview-${memory.id}`}
                            >
                              {memory.mediaType === 'video' ? (
                                <div className="w-full h-full flex items-center justify-center relative">
                                  <Video className="h-12 w-12 text-white/60" />
                                  {memory.videoUrl && (
                                    <EnhancedVideoPlayer
                                      src={memory.videoUrl} 
                                      className="absolute inset-0 w-full h-full"
                                      muted={true}
                                      title={memory.title}
                                    />
                                  )}
                                </div>
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  {memory.imageUrl ? (
                                    <img 
                                      src={memory.imageUrl} 
                                      alt={memory.title} 
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <Images className="h-12 w-12 text-white/60" />
                                  )}
                                </div>
                              )}
                            </div>
                            
                            {/* Memory Info */}
                            <div className="space-y-2 mb-4">
                              <h3 className="font-medium text-white text-sm" data-testid={`text-pending-title-${memory.id}`}>
                                {memory.title}
                              </h3>
                              
                              {memory.description && (
                                <p className="text-blue-100 text-xs line-clamp-2" data-testid={`text-pending-description-${memory.id}`}>
                                  {memory.description}
                                </p>
                              )}
                              
                              <div className="flex items-center justify-between text-xs text-blue-200">
                                <span data-testid={`text-pending-uploader-${memory.id}`}>By: {memory.uploadedBy}</span>
                                <span className="flex items-center">
                                  <Calendar className="h-3 w-3 mr-1" />
                                  {memory.year}
                                </span>
                              </div>
                              
                              {memory.category && (
                                <span className="inline-block px-2 py-1 bg-white/10 text-white text-xs rounded-full capitalize">
                                  {memory.category.replace('_', ' ')}
                                </span>
                              )}
                            </div>
                            
                            {/* Approval Actions */}
                            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                                onClick={() => {
                                  setPreviewMemory(memory);
                                  setShowPreviewDialog(true);
                                }}
                                data-testid={`button-preview-${memory.id}`}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Preview
                              </Button>
                              
                              <Button
                                size="sm"
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white border-green-700"
                                onClick={() => approveMemoryMutation.mutate(memory.id)}
                                disabled={approveMemoryMutation.isPending || denyMemoryMutation.isPending}
                                data-testid={`button-approve-${memory.id}`}
                              >
                                {approveMemoryMutation.isPending ? (
                                  <Clock className="h-4 w-4 mr-1 animate-spin" />
                                ) : (
                                  <Check className="h-4 w-4 mr-1" />
                                )}
                               
                              </Button>
                              
                              <Button
                                size="sm"
                                variant="destructive"
                                className="flex-1"
                                onClick={() => denyMemoryMutation.mutate(memory.id)}
                                disabled={approveMemoryMutation.isPending || denyMemoryMutation.isPending}
                                data-testid={`button-deny-${memory.id}`}
                              >
                                {denyMemoryMutation.isPending ? (
                                  <Clock className="h-4 w-4 mr-1 animate-spin" />
                                ) : (
                                  <XCircle className="h-4 w-4 mr-1" />
                                )}
                                
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                      ))}
                    </div>
                    
                    {/* See All Button */}
                    {pendingMemories.length > 5 && (
                      <div className="flex justify-center mt-6">
                        <Button
                          onClick={() => setShowAllMemoriesDialog(true)}
                          variant="outline"
                          className="bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white"
                          data-testid="button-see-all-memories"
                        >
                          See all {pendingMemories.length} memories
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}
          {/* Public Upload Link Section */}
          <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-white">
                <div className="flex items-center">
                  <Share2 className="h-5 w-5 mr-2" />
                  Public Upload Links
                </div>
                <Dialog open={showPublicLinkDialog} onOpenChange={setShowPublicLinkDialog}>
                  <DialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm"
                      disabled={!schoolId || !year}
                      className="text-white border-white/50 hover:bg-white/10 hover:text-white bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                      data-testid="button-generate-public-link"
                    >
                      <Share2 className="h-4 w-4 mr-2" />
                      Generate Link
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl max-w-lg w-[95vw] sm:w-[90vw] mx-auto">
                    <DialogHeader>
                      <DialogTitle className="text-white">Generate Public Upload Link</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <p className="text-sm text-blue-50">
                        Create a time-limited link for external users to upload photos to your memories.
                      </p>
                      
                      {!generatedLink ? (
                        <Form {...publicLinkForm}>
                          <form onSubmit={publicLinkForm.handleSubmit(onGeneratePublicLink)} className="space-y-4">
                            <FormField
                              control={publicLinkForm.control}
                              name="category"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-blue-50">Memory Category</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                      <SelectTrigger className="placeholder:text-white bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl text-white" data-testid="select-public-category">
                                        <SelectValue placeholder="Select category" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent className="bg-blue-600/60 backdrop-blur-lg border border-white/20 text-white">
                                      <SelectItem value="graduation">Graduation</SelectItem>
                                      <SelectItem value="sports">Sports</SelectItem>
                                      <SelectItem value="arts">Arts</SelectItem>
                                      <SelectItem value="field_trips">Field Trips</SelectItem>
                                      <SelectItem value="academic">Academic</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={publicLinkForm.control}
                              name="validFor"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-white">Link Valid For</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value || "24"}>
                                    <FormControl>
                                      <SelectTrigger className="placeholder:text-white bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl text-white" data-testid="select-validity-period">
                                        <SelectValue placeholder="Select validity period" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent className="bg-blue-600/60 backdrop-blur-lg border border-white/20 text-white">
                                      <SelectItem value="1">1 hour</SelectItem>
                                      <SelectItem value="6">6 hours</SelectItem>
                                      <SelectItem value="12">12 hours</SelectItem>
                                      <SelectItem value="24">24 hours</SelectItem>
                                      <SelectItem value="48">48 hours (Max)</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <Button 
                              type="submit" 
                              className="w-full bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl cursor-pointer transition-all hover:bg-white/15 hover:scale-105  hover:shadow-blue-500/50 hover:shadow-lg hover:scale-105 transition-all duration-200"
                              disabled={generatePublicLinkMutation.isPending}
                              data-testid="button-create-link"
                            >
                              {generatePublicLinkMutation.isPending ? "Generating..." : "Generate Upload Link"}
                            </Button>
                          </form>
                        </Form>
                      ) : (
                        <div className="space-y-4">
                          <div className="p-4 bg-green-600/50 backdrop-blur-lg border border-white/20 shadow-2xl rounded-lg">
                            <h3 className="font-medium text-green-50 mb-2">Upload Link Generated!</h3>
                            
                            <div className="space-y-3">
                              <div>
                                <label className="text-sm font-medium text-green-50">Upload Code:</label>
                                <div className="flex items-center space-x-2 mt-1">
                                  <code className="px-3 py-2 bg-white border rounded text-lg font-mono font-bold tracking-wider flex-1" data-testid="text-upload-code">
                                    {generatedLink.code}
                                  </code>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => copyToClipboard(generatedLink.code)}
                                    data-testid="button-copy-code"
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>

                              <p className="text-sm text-green-50 flex items-center">
                                <Calendar className="h-4 w-4 mr-1" />
                                Expires: {generatedLink.expiresAt}
                              </p>
                            </div>
                          </div>

                          <div className="flex justify-between">
                            <Button
                              className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl cursor-pointer transition-all hover:bg-white/15 hover:scale-105  hover:shadow-blue-500/5 text-white"
                              variant="outline"
                              onClick={() => {
                                setGeneratedLink(null);
                                publicLinkForm.reset();
                              }}
                              data-testid="button-generate-another"
                            >
                              Generate Another
                            </Button>
                            <Button
                              className="bg-blue-600/50 backdrop-blur-lg border border-white/20 shadow-2xl cursor-pointer transition-all hover:bg-white/15 hover:scale-105  hover:shadow-blue-500/5"
                              onClick={() => setShowPublicLinkDialog(false)}
                              data-testid="button-close-dialog"
                            >
                              Close
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!schoolId || !year ? (
                <p className="text-yellow-200 text-sm">
                  Please ensure you have a school and year selected to generate upload links.
                </p>
              ) : (
                <p className="text-blue-100 text-sm">
                  Generate time-limited upload codes for external contributors. Anyone with the code can upload photos that will be pending your approval.
                </p>
              )}
            </CardContent>
            
            {/* Existing Links Management - moved from separate card */}
            <div className="mt-6 border-t border-white/20 pt-6">
              <div className="flex items-center space-x-2 mb-4">
                <Share2 className="h-4 w-4 text-white" />
                <h3 className="text-white font-medium">Existing Upload Links</h3>
              </div>
              <PublicUploadLinksManager schoolId={schoolId} year={year} />
            </div>
          </Card>

          {/* Memory Types Info */}
          <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
            <CardHeader>
              <CardTitle className="flex items-center text-white">
                <Images className="h-5 w-5 mr-2" />
                Memory Categories
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3 sm:gap-4 text-center">
                <div className="p-3 bg-green-500/20 backdrop-blur-lg border border-green-400/20 rounded-lg">
                  <p className="text-sm font-medium text-green-200">Graduation</p>
                </div>
                <div className="p-3 bg-orange-500/20 backdrop-blur-lg border border-orange-400/20 rounded-lg">
                  <p className="text-sm font-medium text-orange-200">Sports</p>
                </div>
                <div className="p-3 bg-purple-500/20 backdrop-blur-lg border border-purple-400/20 rounded-lg">
                  <p className="text-sm font-medium text-purple-200">Arts</p>
                </div>
                <div className="p-3 bg-pink-500/20 backdrop-blur-lg border border-pink-400/20 rounded-lg">
                  <p className="text-sm font-medium text-pink-200">Field Trips</p>
                </div>
                <div className="p-3 bg-blue-500/20 backdrop-blur-lg border border-blue-400/20 rounded-lg">
                  <p className="text-sm font-medium text-blue-200">Academic</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Upload Form with Tabs */}
          <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
            <CardHeader>
              <CardTitle className="flex items-center text-white">
                <Upload className="h-5 w-5 mr-2" />
                Upload Memories
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={uploadMode} onValueChange={setUploadMode} className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-white/5 backdrop-blur-lg border border-white/20">
                  <TabsTrigger
                    value="single"
                    className="text-white/70 data-[state=active]:text-white data-[state=active]:bg-white/20"
                    data-testid="tab-single-upload"
                  >
                    Single Upload
                  </TabsTrigger>
                  <TabsTrigger
                    value="multiple"
                    className="text-white/70 data-[state=active]:text-white data-[state=active]:bg-white/20"
                    data-testid="tab-multiple-upload"
                  >
                    Multiple Upload
                  </TabsTrigger>
                </TabsList>

                {/* Single Upload Tab */}
                <TabsContent value="single" className="mt-6">
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      {/* File Upload Section */}
                      <div className="border-2 border-dashed border-white/30 bg-white/5 backdrop-blur-lg rounded-lg p-6">
                        {!selectedFile ? (
                          <div className="text-center">
                            <Upload className="h-12 w-12 text-blue-200 mx-auto mb-4" />
                            <div className="mb-4">
                              <label htmlFor="file-upload" className="cursor-pointer">
                                <span className="text-lg font-medium text-white">Upload photo</span>
                                <br />
                                <span className="text-sm text-blue-100">
                                  Drag and drop or click to select (Max 20MB)
                                </span>
                              </label>
                              <input
                                id="file-upload"
                                type="file"
                                accept="image/*"
                                onChange={handleFileSelect}
                                className="hidden"
                                data-testid="input-file"
                              />
                            </div>
                            <p className="text-xs text-blue-100">
                              Supported formats: JPG, PNG, MP4, MOV, etc.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                {selectedFile.type.startsWith('image/') ? (
                                  <FileImage className="h-8 w-8 text-blue-600" />
                                ) : (
                                  <FileVideo className="h-8 w-8 text-purple-600" />
                                )}
                                <div>
                                  <p className="font-medium text-white">{selectedFile.name}</p>
                                  <p className="text-sm text-blue-100">
                                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                                  </p>
                                </div>
                              </div>
                              <Button 
                                type="button" 
                                variant="outline" 
                                size="sm" 
                                onClick={handleRemoveFile}
                                data-testid="button-remove-file"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            
                            {selectedFile.type.startsWith('image/') && (
                              <img 
                                src={previewUrl} 
                                alt="Preview" 
                                className="max-h-48 rounded-lg mx-auto" 
                              />
                            )}
                            
                            {selectedFile.type.startsWith('video/') && (
                              <EnhancedVideoPlayer
                                src={previewUrl} 
                                className="max-h-48 rounded-lg mx-auto w-full"
                                title="Upload preview"
                                controls={true}
                              />
                            )}
                          </div>
                        )}
                      </div>

                      {/* Title Field */}
                      <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white">Title</FormLabel><FormLabel className="text-red-500"> *</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="" 
                                className="bg-white/10 backdrop-blur-lg text-white placeholder-white/60 border-white/20 focus-visible:ring-white/30 focus-visible:ring-offset-0"
                                {...field} 
                                data-testid="input-title"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Category Field */}
                      <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white">Category</FormLabel><FormLabel className="text-red-500"> *</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="bg-white/10 backdrop-blur-lg text-white border-white/20 focus:ring-white/30" data-testid="select-category">
                                  <SelectValue placeholder="Select memory category" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="bg-white/50 backdrop-blur-lg border border-white/20">
                                <SelectItem value="graduation">Graduation</SelectItem>
                                <SelectItem value="sports">Sports</SelectItem>
                                <SelectItem value="arts">Arts</SelectItem>
                                <SelectItem value="field_trips">Field Trips</SelectItem>
                                <SelectItem value="academic">Academic</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Description Field */}
                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white">Description</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Add details about this memory..." 
                                className="resize-none bg-white/10 backdrop-blur-lg text-white placeholder-white/60 border-white/20 focus-visible:ring-white/30 focus-visible:ring-offset-0 placeholder:text-white/90" 
                                rows={3} 
                                {...field} 
                                data-testid="textarea-description"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Submit Button */}
                      <div className="flex justify-end">
                        <Button 
                          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700  backdrop-blur-lg border border-blue-200 shadow-2xl cursor-pointer transition-all hover:bg-white/15 hover:scale-105  hover:shadow-blue-500/50 hover:shadow-lg hover:scale-105 transition-all duration-200"
                          type="submit" 
                          disabled={!selectedFile || uploadMemoryMutation.isPending}
                          data-testid="button-upload-memory"
                        >
                          {uploadMemoryMutation.isPending ? (
                            <>
                              <Upload className="h-4 w-4 mr-2 animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Upload className="h-4 w-4 mr-2" />
                              Upload Memory
                            </>
                          )}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </TabsContent>

                {/* Multiple Upload Tab */}
                <TabsContent value="multiple" className="mt-6">
                  <Form {...multipleUploadForm}>
                    <form onSubmit={multipleUploadForm.handleSubmit(onMultipleSubmit)} className="space-y-6">
                      {/* Category Field for Multiple Upload */}
                      <FormField
                        control={multipleUploadForm.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white">Category for All Files</FormLabel><FormLabel className="text-red-500"> *</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="bg-white/10 backdrop-blur-lg text-white border-white/20 focus:ring-white/30" data-testid="select-multiple-category">
                                  <SelectValue placeholder="Select memory category" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="bg-white/50 backdrop-blur-lg border border-white/20">
                                <SelectItem value="graduation">Graduation</SelectItem>
                                <SelectItem value="sports">Sports</SelectItem>
                                <SelectItem value="arts">Arts</SelectItem>
                                <SelectItem value="field_trips">Field Trips</SelectItem>
                                <SelectItem value="academic">Academic</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Multiple File Upload Section */}
                      <div className="border-2 border-dashed border-white/30 bg-white/5 backdrop-blur-lg rounded-lg p-6">
                        <div className="text-center">
                          <Upload className="h-12 w-12 text-blue-200 mx-auto mb-4" />
                          <div className="mb-4">
                            <label htmlFor="multiple-file-upload" className="cursor-pointer">
                              <span className="text-lg font-medium text-white">Select multiple files</span>
                              <br />
                              <span className="text-sm text-blue-100">
                                Choose multiple photos/videos (Max 50MB total)
                              </span>
                            </label>
                            <input
                              id="multiple-file-upload"
                              type="file"
                              accept="image/*,video/*"
                              multiple
                              onChange={handleMultipleFileSelect}
                              className="hidden"
                              data-testid="input-multiple-files"
                            />
                          </div>
                          <p className="text-xs text-blue-100">
                            Supported formats: JPG, PNG, MP4, MOV, etc.
                          </p>
                          {multipleFiles.length > 0 && (
                            <div className="mt-4 text-sm text-white">
                              <p>Total size: {formatSize(getTotalSize())} MB / 50 MB</p>
                              <p>{multipleFiles.length} files selected</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Selected Files List */}
                      {multipleFiles.length > 0 && (
                        <div className="space-y-4">
                          <h4 className="text-white font-medium">Selected Files:</h4>
                          {multipleFiles.map((fileItem) => (
                            <div key={fileItem.id} className="bg-white/5 backdrop-blur-lg rounded-lg p-4 border border-white/20">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center space-x-3">
                                  {fileItem.file.type.startsWith('image/') ? (
                                    <FileImage className="h-6 w-6 text-blue-600 flex-shrink-0" />
                                  ) : (
                                    <FileVideo className="h-6 w-6 text-purple-600 flex-shrink-0" />
                                  )}
                                  <div>
                                    <p className="font-medium text-white text-sm">{fileItem.file.name}</p>
                                    <p className="text-xs text-blue-100">
                                      {formatSize(fileItem.file.size)} MB
                                    </p>
                                  </div>
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => removeMultipleFile(fileItem.id)}
                                  data-testid={`button-remove-multiple-${fileItem.id}`}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                              
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <Label htmlFor={`title-${fileItem.id}`} className="text-white text-sm">Title *</Label>
                                  <Input
                                    id={`title-${fileItem.id}`}
                                    value={fileItem.title}
                                    onChange={(e) => updateMultipleFileDetails(fileItem.id, 'title', e.target.value)}
                                    className="bg-white/10 backdrop-blur-lg text-white placeholder-white/60 border-white/20 focus-visible:ring-white/30 focus-visible:ring-offset-0 mt-1"
                                    placeholder="Enter title"
                                    data-testid={`input-title-${fileItem.id}`}
                                  />
                                </div>
                                <div>
                                  <Label htmlFor={`description-${fileItem.id}`} className="text-white text-sm">Description</Label>
                                  <Input
                                    id={`description-${fileItem.id}`}
                                    value={fileItem.description}
                                    onChange={(e) => updateMultipleFileDetails(fileItem.id, 'description', e.target.value)}
                                    className="bg-white/10 backdrop-blur-lg text-white placeholder-white/60 border-white/20 focus-visible:ring-white/30 focus-visible:ring-offset-0 mt-1"
                                    placeholder=""
                                    data-testid={`input-description-${fileItem.id}`}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Submit Button */}
                      {multipleFiles.length > 0 && (
                        <div className="flex justify-end">
                          <Button 
                            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700  backdrop-blur-lg border border-green-200 shadow-2xl cursor-pointer transition-all hover:bg-white/15 hover:scale-105  hover:shadow-green-500/50 hover:shadow-lg hover:scale-105 transition-all duration-200"
                            type="submit" 
                            disabled={multipleFiles.length === 0 || multipleUploadMutation.isPending || getTotalSize() > 50 * 1024 * 1024}
                            data-testid="button-upload-multiple"
                          >
                            {multipleUploadMutation.isPending ? (
                              <>
                                <Upload className="h-4 w-4 mr-2 animate-spin" />
                                Uploading {multipleFiles.length} files...
                              </>
                            ) : (
                              <>
                                <Upload className="h-4 w-4 mr-2" />
                                Upload {multipleFiles.length} memories
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </form>
                  </Form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Existing Memories */}
          {memoriesData.length > 0 && (
            <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
              <CardHeader className="space-y-4">
                <CardTitle className="flex items-center text-white">
                  <FolderOpen className="h-5 w-5 mr-2" />
                  Uploaded Memories ({memoriesData.length})
                </CardTitle>
                
                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60" />
                  <Input
                    placeholder="Search memories..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-white/10 backdrop-blur-lg text-white placeholder-white/60 border-white/20 focus-visible:ring-white/30 focus-visible:ring-offset-0 placeholder:text-white/90"
                    data-testid="input-search-memories"
                  />
                </div>
                
                {/* Category Filter Tabs */}
                <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full">
                  <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 bg-white/5 backdrop-blur-lg border border-white/20">
                    {availableCategories.map((category) => (
                      <TabsTrigger
                        key={category}
                        value={category}
                        className="text-white/70 data-[state=active]:text-white data-[state=active]:bg-white/20 text-xs px-2 py-1"
                        data-testid={`tab-category-${category}`}
                      >
                        {categoryDisplayNames[category] || category}
                        {category !== "all" && (
                          <span className="ml-1 text-xs opacity-70">
                            ({memoriesData.filter((m: any) => m.category === category).length})
                          </span>
                        )}
                        {category === "all" && (
                          <span className="ml-1 text-xs opacity-70">
                            ({memoriesData.length})
                          </span>
                        )}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </CardHeader>
              <CardContent>
                {/* Show filtered results count */}
                {filteredMemories.length !== memoriesData.length && (
                  <div className="mb-4 text-center">
                    <p className="text-white/70 text-sm">
                      Showing {filteredMemories.length} of {memoriesData.length} memories
                      {searchTerm && (
                        <span className="ml-1">matching "{searchTerm}"</span>
                      )}
                    </p>
                  </div>
                )}
                
                {filteredMemories.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-white/70">
                      {searchTerm || selectedCategory !== "all" ? 
                        "No memories match your current filters." : 
                        "No memories uploaded yet."
                      }
                    </p>
                    {(searchTerm || selectedCategory !== "all") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSearchTerm("");
                          setSelectedCategory("all");
                        }}
                        className="mt-2 text-white/70 hover:text-white"
                        data-testid="button-clear-filters"
                      >
                        Clear filters
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-4 sm:gap-6">
                    {filteredMemories.map((memory: any) => (
                    <div key={memory.id} className="w-full relative">
                      {memory.mediaType === 'image' ? (
                        <div className="group relative">
                          <EnhancedImageViewer
                            src={memory.imageUrl}
                            alt={memory.title}
                        
                            onImageClick={() => {
                              setPreviewMemory(memory);
                              setShowPreviewDialog(true);
                            }}
                            className="border bg-white/5 hover:bg-white/10 transition-colors"
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-80 transition-opacity flex flex-col justify-between p-2 rounded-lg pointer-events-none">
                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-8 w-8 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewMemory(memory);
                                  setShowPreviewDialog(true);
                                }}
                                data-testid={`button-preview-${memory.id}`}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary" 
                                className="h-8 w-8 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditMemory(memory);
                                  setEditTitle(memory.title);
                                  setEditCategory(memory.category || 'graduation');
                                  setShowEditDialog(true);
                                }}
                                data-testid={`button-rename-${memory.id}`}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-8 w-8 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMemoryToDelete(memory);
                                  setShowDeleteDialog(true);
                                }}
                                data-testid={`button-delete-${memory.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          {/* Footer showing Title and Category */}
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent p-3 text-white">
                            <div className="font-medium text-sm truncate drop-shadow-sm">{memory.title}</div>
                            <div className="text-xs text-white/70 capitalize mt-0.5">{memory.category?.replace('_', ' ')}</div>
                          </div>
                        </div>
                      ) : (
                        <div className="group relative bg-white/5 hover:bg-white/10 transition-colors rounded-lg border cursor-pointer"
                             onClick={() => {
                               setPreviewMemory(memory);
                               setShowPreviewDialog(true);
                             }}
                             data-testid={`memory-preview-${memory.id}`}
                        >
                          <EnhancedVideoPlayer
                            src={memory.videoUrl || ''}
                            title={memory.title}
                            className="w-full"
                            muted={true}
                            onVideoClick={() => {
                              setPreviewMemory(memory);
                              setShowPreviewDialog(true);
                            }}
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-80 transition-opacity flex flex-col justify-between p-2 rounded-lg pointer-events-none">
                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-8 w-8 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewMemory(memory);
                                  setShowPreviewDialog(true);
                                }}
                                data-testid={`button-preview-${memory.id}`}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary" 
                                className="h-8 w-8 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditMemory(memory);
                                  setEditTitle(memory.title);
                                  setEditCategory(memory.category || 'graduation');
                                  setShowEditDialog(true);
                                }}
                                data-testid={`button-rename-${memory.id}`}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-8 w-8 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMemoryToDelete(memory);
                                  setShowDeleteDialog(true);
                                }}
                                data-testid={`button-delete-${memory.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          {/* Footer showing Title and Category */}
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent p-3 text-white rounded-b-lg">
                            <div className="font-medium text-sm truncate drop-shadow-sm">{memory.title}</div>
                            <div className="text-xs text-white/70 capitalize mt-0.5">{memory.category?.replace('_', ' ')}</div>
                          </div>
                        </div>
                      )}
                    </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          
        </div>
      </div>
      </div>
      
      {/* Preview Memory Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-4xl bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">Preview Memory</DialogTitle>
          </DialogHeader>
          
          {previewMemory && (
            <div className="space-y-4">
              {/* Image/Video Preview */}
              <div className="flex justify-center">
                {previewMemory.mediaType === 'video' && previewMemory.videoUrl ? (
                  <EnhancedVideoPlayer
                    src={previewMemory.videoUrl.startsWith('/') ? previewMemory.videoUrl : `/${previewMemory.videoUrl}`} 
                    className="max-h-96 max-w-full rounded-lg"
                    title={previewMemory.title}
                    controls={true}
                  />
                ) : previewMemory.imageUrl ? (
                  <div style={{ maxHeight: '45rem', maxWidth: '100%' }}>
                    <EnhancedImageViewer
                      src={previewMemory.imageUrl}
                      alt={previewMemory.title}
                      enableZoomPan={true}
                      className="rounded-lg"
                      data-testid="preview-image"
                    />
                  </div>
                ) : (
                  <div className="w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Images className="h-16 w-16 text-gray-400" />
                  </div>
                )}
              </div>
              
              {/* Memory Details */}
              <div className="space-y-3 text-sm">
                <div>
                  <span className="font-semibold text-blue-50">Title:</span>
                  <p className="text-green-50 mt-1">{previewMemory.title}</p>
                </div>
                
                {previewMemory.description && (
                  <div>
                    <span className="font-semibold text-blue-50">Description:</span>
                    <p className="text-green-50 mt-1">{previewMemory.description}</p>
                  </div>
                )}
                
                <div className="flex gap-6">
                  <div>
                    <span className="font-semibold text-blue-50">Category:</span>
                    <span className="ml-2 capitalize text-green-50">{previewMemory.category?.replace('_', ' ')}</span>
                  </div>
                  
                  <div>
                    <span className="font-semibold text-blue-50">Year:</span>
                    <span className="ml-2 text-green-50">{previewMemory.year}</span>
                  </div>
                  
                  <div>
                    <span className="font-semibold text-blue-50">Uploaded by:</span>
                    <span className="ml-2 text-green-50">{previewMemory.uploadedBy}</span>
                  </div>
                </div>
              </div>
              
              {/* Quick Actions */}
              <div className="flex justify-end space-x-2 pt-4 border-t">
                <Button
                  className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl text-white"
                  variant="outline"
                  onClick={() => setShowPreviewDialog(false)}
                  data-testid="button-close-preview"
                >
                  Close
                </Button>
                
                {previewMemory.status === 'pending' ? (
                  // Buttons for pending memories
                  <>
                    <Button
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => {
                        approveMemoryMutation.mutate(previewMemory.id);
                        setShowPreviewDialog(false);
                      }}
                      disabled={approveMemoryMutation.isPending || denyMemoryMutation.isPending}
                      data-testid="button-approve-from-preview"
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    
                    <Button
                      variant="destructive"
                      onClick={() => {
                        denyMemoryMutation.mutate(previewMemory.id);
                        setShowPreviewDialog(false);
                      }}
                      disabled={approveMemoryMutation.isPending || denyMemoryMutation.isPending}
                      data-testid="button-deny-from-preview"
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Deny
                    </Button>
                  </>
                ) : (
                  // Buttons for approved/uploaded memories
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditMemory(previewMemory);
                        setEditTitle(previewMemory.title);
                        setEditCategory(previewMemory.category || 'graduation');
                        setShowPreviewDialog(false);
                        setShowEditDialog(true);
                      }}
                      data-testid="button-edit-from-preview"
                    >
                      <Edit2 className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    
                    <Button
                      variant="destructive"
                      onClick={() => {
                        setMemoryToDelete(previewMemory);
                        setShowPreviewDialog(false);
                        setShowDeleteDialog(true);
                      }}
                      disabled={deleteMemoryMutation.isPending}
                      data-testid="button-delete-from-preview"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Edit Memory Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Memory</DialogTitle>
          </DialogHeader>
          
          {editMemory && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-white" htmlFor="edit-title">Memory Title</Label>
                <Input
                  id="edit-title"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder=""
                  className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl text-white"
                  data-testid="input-edit-title"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-white" htmlFor="edit-category">Category</Label>
                <Select value={editCategory} onValueChange={setEditCategory}>
                  <SelectTrigger 
                    id="edit-category"
                    className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl text-white"
                    data-testid="select-edit-category"
                  >
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="graduation">Graduation</SelectItem>
                    <SelectItem value="sports">Sports</SelectItem>
                    <SelectItem value="arts">Arts</SelectItem>
                    <SelectItem value="field_trips">Field Trips</SelectItem>
                    <SelectItem value="academic">Academic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl text-white"
                  variant="outline"
                  onClick={() => {
                    setShowEditDialog(false);
                    setEditMemory(null);
                    setEditTitle("");
                    setEditCategory("");
                  }}
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
                
                <Button
                  className="bg-blue-600/50 backdrop-blur-lg border border-white/20 shadow-2xl text-white"
                  onClick={() => {
                    const hasChanges = editTitle.trim() !== editMemory.title || editCategory !== editMemory.category;
                    if (editTitle.trim() && hasChanges) {
                      updateMemoryTitleMutation.mutate({ 
                        memoryId: editMemory.id, 
                        title: editTitle.trim(),
                        category: editCategory
                      });
                    }
                    setShowEditDialog(false);
                    setEditMemory(null);
                    setEditTitle("");
                    setEditCategory("");
                  }}
                  disabled={!editTitle.trim() || (editTitle === editMemory.title && editCategory === editMemory.category)}
                  data-testid="button-save-edit"
                >
                  <Check className="h-4 w-4 mr-1" />
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center text-red-600">
              <AlertTriangle className="h-5 w-5 mr-2" />
              Delete Memory
            </DialogTitle>
          </DialogHeader>
          
          {memoryToDelete && (
            <div className="space-y-4">
              <div className="text-center space-y-3">
                <p className="text-red-600">
                  Are you sure you want to delete this memory?
                </p>
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl rounded-lg p-3">
                  <p className="text-sm font-medium text-white">
                    "{memoryToDelete.title}"
                  </p>
                </div>
                <p className="text-sm text-red-600 font-semibold">
                  This Cannot be Undone
                </p>
              </div>
              
              <div className="flex justify-end space-x-2 pt-4 border-t">
                <Button
                  className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl text-white"
                  variant="outline"
                  onClick={() => {
                    setShowDeleteDialog(false);
                    setMemoryToDelete(null);
                  }}
                  data-testid="button-cancel-delete"
                >
                  Cancel
                </Button>
                
                <Button
                  variant="destructive"
                  onClick={() => {
                    deleteMemoryMutation.mutate(memoryToDelete.id);
                    setShowDeleteDialog(false);
                    setMemoryToDelete(null);
                  }}
                  disabled={deleteMemoryMutation.isPending}
                  data-testid="button-confirm-delete"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  {deleteMemoryMutation.isPending ? "Deleting..." : "Delete Memory"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* See All Memories Dialog */}
      <Dialog open={showAllMemoriesDialog} onOpenChange={setShowAllMemoriesDialog}>
        <DialogContent className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl max-w-7xl w-[95vw] sm:w-[90vw] lg:max-w-6xl max-h-[85vh] sm:max-h-[80vh] overflow-hidden mx-auto">
          <DialogHeader>
            <DialogTitle className="text-white text-xl">
              All Pending Memories ({pendingMemories.length})
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[60vh] pr-2 sm:pr-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {pendingMemories.map((memory: any) => (
                <div key={memory.id} className="relative group">
                  <Card className="bg-white/5 backdrop-blur-lg border border-white/10 hover:bg-white/10 transition-all duration-200">
                    <CardContent className="p-3">
                      {/* Media Preview */}
                      <div className="relative mb-3 rounded-lg overflow-hidden bg-black/20">
                        {memory.mediaType === 'image' ? (
                          memory.imageUrl ? (
                            <EnhancedImageViewer
                              src={memory.imageUrl}
                              alt={memory.title || 'Memory image'}
                              title={memory.title}
                              category={memory.category}
                              onImageClick={() => {
                                setPreviewMemory(memory);
                                setShowPreviewDialog(true);
                              }}
                              className="w-full aspect-video object-cover cursor-pointer hover:opacity-90 transition-opacity"
                            />
                          ) : (
                            <div className="aspect-video flex items-center justify-center">
                              <FileImage className="h-8 w-8 text-blue-400" />
                            </div>
                          )
                        ) : (
                          memory.videoUrl ? (
                            <video 
                              className="w-full aspect-video object-cover cursor-pointer"
                              preload="metadata"
                              onClick={() => {
                                setPreviewMemory(memory);
                                setShowPreviewDialog(true);
                              }}
                            >
                              <source src={memory.videoUrl} type="video/mp4" />
                              <source src={memory.videoUrl} type="video/webm" />
                              <source src={memory.videoUrl} type="video/ogg" />
                            </video>
                          ) : (
                            <div className="aspect-video flex items-center justify-center">
                              <FileVideo className="h-8 w-8 text-purple-400" />
                            </div>
                          )
                        )}
                      </div>
                      
                      {/* Memory Details */}
                      <div className="space-y-2">
                        <h4 className="text-white font-medium text-sm truncate">
                          {memory.title || 'Untitled Memory'}
                        </h4>
                        
                        <div className="flex items-center text-gray-300 text-xs">
                          <Calendar className="h-3 w-3 mr-1" />
                          <span>
                            {new Date(memory.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        
                        {memory.submittedBy && (
                          <div className="text-gray-400 text-xs">
                            Submitted by: {memory.submittedBy}
                          </div>
                        )}
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          variant="default"
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs"
                          onClick={() => approveMemoryMutation.mutate(memory.id)}
                          disabled={approveMemoryMutation.isPending || denyMemoryMutation.isPending}
                          data-testid={`button-quick-approve-${memory.id}`}
                        >
                          {approveMemoryMutation.isPending ? (
                            <Clock className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <Check className="h-3 w-3 mr-1" />
                          )}
                          Approve
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="destructive"
                          className="flex-1 text-xs"
                          onClick={() => denyMemoryMutation.mutate(memory.id)}
                          disabled={approveMemoryMutation.isPending || denyMemoryMutation.isPending}
                          data-testid={`button-quick-deny-${memory.id}`}
                        >
                          {denyMemoryMutation.isPending ? (
                            <Clock className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <XCircle className="h-3 w-3 mr-1" />
                          )}
                          Deny
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Component for managing existing public upload links
function PublicUploadLinksManager({ schoolId, year }: { schoolId: string; year: string }) {
  const { toast } = useToast();
  
  // State for delete link confirmation dialog
  const [linkToDelete, setLinkToDelete] = useState<string | null>(null);
  const [showDeleteLinkDialog, setShowDeleteLinkDialog] = useState(false);
  
  // Fetch existing public upload links
  const { data: publicLinks = [], isLoading } = useQuery({
    queryKey: ['/api/public-upload-links/school', schoolId, year],
    enabled: !!schoolId && !!year,
    queryFn: async () => {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const response = await fetch(`/api/public-upload-links/school/${schoolId}/${year}`, {
        headers: {
          'Authorization': `Bearer ${user.id}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch upload links');
      return response.json();
    }
  });

  // Delete link
  const deleteLinkMutation = useMutation({
    mutationFn: async (linkId: string) => {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const response = await fetch(`/api/public-upload-links/${linkId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${user.id}`
        }
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete link');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/public-upload-links/school', schoolId, year] });
      toast({
        className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Link deleted",
        description: "Upload link has been deleted successfully."
      });
    },
    onError: (error: any) => {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Delete failed",
        description: error.message || "Failed to delete the upload link.",
        variant: "destructive"
      });
    }
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Copied!",
        description: "Link has been copied to clipboard."
      });
    });
  };

  if (!schoolId || !year) {
    return (
      <p className="text-yellow-200 text-sm">
        Please ensure you have a school and year selected to manage upload links.
      </p>
    );
  }

  if (isLoading) {
    return <p className="text-blue-100 text-sm">Loading existing upload links...</p>;
  }

  if (publicLinks.length === 0) {
    return (
      <p className="text-blue-100 text-sm">
        No public upload links created yet. Generate your first link above to see it here.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-blue-100 text-sm mb-4">
        Manage your existing public upload links. You can view details, copy links, and activate/deactivate them.
      </p>
      
      {publicLinks.map((link: any) => {
        const isExpired = new Date() > new Date(link.expiresAt);
        // Only show the code, not the full URL for security
        const secureShareText = `Upload Code: ${link.linkCode}`;
        
        return (
          <div key={link.id} className="bg-white/5 border border-white/20 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-white font-medium">Code: {link.linkCode}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-blue-300 hover:text-white"
                    onClick={() => copyToClipboard(link.linkCode)}
                    data-testid={`button-copy-code-${link.id}`}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                
                <div className="space-y-1 text-sm">
                  <p className="text-blue-100">
                    <Calendar className="h-3 w-3 inline mr-1" />
                    Category: <span className="capitalize">{link.category}</span>
                  </p>
                  <p className="text-blue-100">
                    <Clock className="h-3 w-3 inline mr-1" />
                    Expires: {new Date(link.expiresAt).toLocaleString()}
                  </p>
                  <p className="text-blue-100">
                    Uploads: {link.currentUploads}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                      isExpired ? 'bg-red-500/20 text-red-200' :
                      link.isActive ? 'bg-green-500/20 text-green-200' : 'bg-gray-500/20 text-gray-200'
                    }`}>
                      {isExpired ? 'Expired' : link.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                
                <div className="mt-3 flex items-center gap-2">
                  <Input
                    value={secureShareText}
                    readOnly
                    className="bg-white/10 text-white text-xs border-white/20 flex-1"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(link.linkCode)}
                    data-testid={`button-copy-code-${link.id}`}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy Code
                  </Button>
                </div>
              </div>
              
              <div className="flex flex-col gap-2 ml-4">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    setLinkToDelete(link.id);
                    setShowDeleteLinkDialog(true);
                  }}
                  disabled={deleteLinkMutation.isPending}
                  data-testid={`button-delete-${link.id}`}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        );
      })}
      
      {/* Delete Link Confirmation Dialog */}
      <AlertDialog open={showDeleteLinkDialog} onOpenChange={setShowDeleteLinkDialog}>
        <AlertDialogContent data-testid="dialog-delete-link-confirm" className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
          <AlertDialogHeader className="text-white">
            <AlertDialogTitle>Delete Upload Link</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-100/80">
              Are you sure you want to delete this upload code? This action cannot be undone.
              Any users with this code will no longer be able to upload photos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete" className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl text-white">Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-delete"
              onClick={() => {
                if (linkToDelete) {
                  deleteLinkMutation.mutate(linkToDelete);
                  setShowDeleteLinkDialog(false);
                  setLinkToDelete(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}