import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, User, CreditCard, Bell, Shield, Menu, Eye, EyeOff, Edit, Check, X, Settings, ShoppingCart, LogOut, MenuIcon, Home, Key, RefreshCw, Receipt, Camera, BookOpen, Crop, Phone, AlertTriangle, Trash2, UserX } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useCurrency, Currency } from "@/contexts/CurrencyContext";
import type { User as UserType, AlumniBadge, Notification } from "@shared/schema";
import { BETA_VERSION } from "@shared/constants";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import YearbookPhotoSelectionDialog from "@/components/YearbookPhotoSelectionDialog";

export default function ViewerSettings() {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<UserType | null>(null);
  const [activeTab, setActiveTab] = useState("profile");
  const [showHamburgerMenu, setShowHamburgerMenu] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const { toast } = useToast();
  const { userCurrency, setUserCurrency, formatPrice } = useCurrency();

  // Set custom page title
  useEffect(() => {
    document.title = "Settings - Yearbuk";
  }, []);

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    email: "",
    username: "",
    fullName: "",
    phoneNumber: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Account deletion state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteStep, setDeleteStep] = useState<"warning" | "confirm">("warning");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteAcknowledged, setDeleteAcknowledged] = useState(false);
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState("");

  // Unlock year state
  const [codeInput, setCodeInput] = useState("");
  const [isRedeemingCode, setIsRedeemingCode] = useState(false);

  // Profile photo states
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [showYearbookPhotoDialog, setShowYearbookPhotoDialog] = useState(false);
  const [selectedYearbook, setSelectedYearbook] = useState<any>(null);
  const [selectedPage, setSelectedPage] = useState<any>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const profileColors = [
    { name: "Cobalt", value: "#2563eb" },
    { name: "Violet", value: "#7c3aed" },
    { name: "Emerald", value: "#059669" },
    { name: "Amber", value: "#d97706" },
    { name: "Rose", value: "#e11d48" },
    { name: "Teal", value: "#0d9488" },
    { name: "Slate", value: "#334155" },
    { name: "Plum", value: "#9333ea" },
  ].map((color) => ({
    ...color,
    imageUrl: `data:image/svg+xml,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1" fill="${color.value}"/></svg>`,
    )}`,
  }));

  // Individual field editing states
  const [editingField, setEditingField] = useState<string | null>(null);
  const [tempValues, setTempValues] = useState({
    email: "",
    username: "",
    fullName: "",
    phoneNumber: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [showPhoneToAlumni, setShowPhoneToAlumni] = useState(true);
  const [isTwoFactorEnabled, setIsTwoFactorEnabled] = useState(false);

  const requestPasswordResetMutation = useMutation({
    mutationFn: async () => {
      if (!user?.email) throw new Error("No account email found");

      const response = await apiRequest("POST", "/api/auth/request-password-reset", {
        email: user.email,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        className: "bg-green-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Password reset email sent",
        description: "Check your mailbox for a secure link to reset your password.",
      });
    },
    onError: (error: any) => {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Unable to send password reset email",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    },
  });
  // Fetch alumni badges for account status
  const { data: alumniBadges = [] } = useQuery<AlumniBadge[]>({
    queryKey: ['/api/alumni-badges', user?.id],
    enabled: !!user
  });

  // Fetch notifications
  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['/api/notifications', user?.id],
    enabled: !!user
  });

  const unreadNotificationCount = notifications.filter(n => !n.isRead).length;

  // Fetch payment history
  const { data: paymentHistory = [], isLoading: isLoadingPayments } = useQuery<Array<{
    id: string;
    userId: string;
    schoolId: string;
    year: number;
    purchased: boolean;
    purchaseDate: Date | null;
    price: string | null;
    paymentReference: string | null;
    createdAt: Date | null;
    schoolName: string;
  }>>({
    queryKey: ['/api/payment-history', user?.id],
    enabled: !!user
  });

  // Mark notification as read mutation
  const markNotificationReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      await apiRequest("PATCH", `/api/notifications/${notificationId}`, { isRead: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications', user?.id] });
    }
  });

  const resendVerificationMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("No user found");
      const response = await apiRequest("POST", "/api/resend-verification", { userId: user.id });
      return response.json();
    },
    onSuccess: () => {
      toast({
        className: "bg-green-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Verification email sent",
        description: "Check your inbox for the verification link.",
      });
    },
    onError: (error: any) => {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Unable to send verification email",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const handleMarkNotificationRead = (notificationId: string) => {
    markNotificationReadMutation.mutate(notificationId);
  };

  // Determine account status from the existing viewer and alumni verification data.
  const verifiedAlumniBadges = alumniBadges.filter((badge: any) => badge.status === "verified");

  const getAccountStatus = () => {
    if (!user || !user.userType) return "Unknown";

    switch (user.userType.toLowerCase()) {
      case "student":
        return "Student";
      case "viewer":
        return verifiedAlumniBadges.length > 0 ? "Verified Alumni" : "Viewer";
      case "school":
        return "School Admin";
      case "super_admin":
        return "Super Admin";
      default:
        return "Unknown";
    }
  };

  const accountStatus = getAccountStatus();
  const verifiedAlumniSchool = verifiedAlumniBadges[0]?.school;

  const formatDateOfBirth = (value: unknown) => {
    if (!value) return "Not provided";

    const dateOnly = String(value).slice(0, 10);
    const [year, month, day] = dateOnly.split("-").map(Number);
    if (!year || !month || !day) return String(value);

    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(year, month - 1, day)));
  };

    useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) {
      setLocation("/");
      return;
    }
    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);
    
    // Initialize profile form with current user data
    setProfileForm(prev => ({
      ...prev,
      email: parsedUser.email || "",
      username: parsedUser.username || "",
      fullName: parsedUser.fullName || "",
      phoneNumber: parsedUser.phoneNumber || ""
    }));
    setShowPhoneToAlumni(parsedUser.showPhoneToAlumni !== false);
  }, [setLocation]);

  const handleBackClick = () => {
    setLocation("/");
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    window.dispatchEvent(new Event('userChanged'));
    setLocation("/home");
  };

  const resetDeleteDialog = () => {
    setShowDeleteDialog(false);
    setDeleteStep("warning");
    setDeletePassword("");
    setDeleteAcknowledged(false);
    setShowDeletePassword(false);
    setDeleteAccountError("");
  };

  const handleDeleteAccount = async () => {
    if (!user || !deletePassword || !deleteAcknowledged || isDeletingAccount) return;

    setIsDeletingAccount(true);
    setDeleteAccountError("");
    try {
      await apiRequest("POST", "/api/auth/delete-account", { currentPassword: deletePassword });
      localStorage.removeItem("user");
      queryClient.clear();
      window.dispatchEvent(new Event('userChanged'));
      toast({
        className: "bg-green-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Account deleted",
        description: "Your Yearbuk account and personal data have been deleted.",
      });
      resetDeleteDialog();
      setLocation("/home");
    } catch (error: any) {
      const message = error?.message || "Unable to delete your account. Please try again.";
      setDeleteAccountError(message.toLowerCase().includes("password")
        ? "The current password is incorrect."
        : "Unable to delete your account right now. Please try again.");
    } finally {
      setIsDeletingAccount(false);
    }
  };

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!user) throw new Error("No user found");
      
      const response = await apiRequest("PATCH", `/api/users/${user.id}`, data);
      return response.json();
    },
    onSuccess: (updatedUser) => {
      // Update localStorage
      localStorage.setItem("user", JSON.stringify(updatedUser));
      window.dispatchEvent(new Event('userChanged'));
      setUser(updatedUser);
      
      // Update form state
      setProfileForm(prev => ({
        ...prev,
        email: updatedUser.email || "",
        username: updatedUser.username || "",
        fullName: updatedUser.fullName || "",
        phoneNumber: updatedUser.phoneNumber || ""
      }));
      setShowPhoneToAlumni(updatedUser.showPhoneToAlumni !== false);
      
      toast({
        className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Profile updated",
        description: "Your profile has been successfully updated.",
      });
      
      // Reset editing state
      setEditingField(null);
      setIsUpdatingProfile(false);
    },
    onError: (error: any) => {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Update failed",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
      setIsUpdatingProfile(false);
    }
  });

  const handleSaveField = (field: string) => {
    if (!user) return;

    const rawValue = tempValues[field as keyof typeof tempValues];
    const value = typeof rawValue === "string" ? rawValue.trim() : "";

    if ((field === "fullName" || field === "username") && !value) {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Invalid input",
        description: field === "fullName" ? "Full name cannot be empty" : "Username cannot be empty",
        variant: "destructive",
      });
      return;
    }

    if (field === "phoneNumber" && value && !/^\([1-9]\d{0,3}\)\d{4,15}$/.test(value)) {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Invalid phone number",
        description: "Use the format (country code)(number), for example (234)8012345678.",
        variant: "destructive",
      });
      return;
    }

    setIsUpdatingProfile(true);
    updateProfileMutation.mutate({ [field]: value });
  };
  const handleCancelEdit = (field: string) => {
    setEditingField(null);
    setTempValues(prev => ({
      ...prev,
      [field]: profileForm[field as keyof typeof profileForm]
    }));
  };

  const startEditing = (field: string) => {
    if (field === "username" && user?.lastUsernameChange) {
      const daysSinceLastChange =
        (Date.now() - new Date(user.lastUsernameChange).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceLastChange < 14) {
        const daysRemaining = Math.ceil(14 - daysSinceLastChange);
        toast({
          className: "bg-amber-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
          title: "Username change unavailable",
          description: `You can change your username again in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}.`,
        });
        return;
      }
    }

    setEditingField(field);
    setTempValues(prev => ({
      ...prev,
      [field]: profileForm[field as keyof typeof profileForm]
    }));
  };

  const privacyMutation = useMutation({
    mutationFn: async (showPhone: boolean) => {
      if (!user) throw new Error("No user found");
      const response = await apiRequest("PATCH", `/api/users/${user.id}`, {
        showPhoneToAlumni: showPhone,
      });
      return response.json();
    },
    onSuccess: (updatedUser) => {
      localStorage.setItem("user", JSON.stringify(updatedUser));
      window.dispatchEvent(new Event("userChanged"));
      setUser(updatedUser);
      setShowPhoneToAlumni(updatedUser.showPhoneToAlumni !== false);
      toast({
        className: "bg-green-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Privacy setting updated",
        description: updatedUser.showPhoneToAlumni === false ? "Your phone number is hidden from verified alumni." : "Your phone number is visible to verified alumni.",
      });
    },
    onError: (error: any, showPhone: boolean) => {
      setShowPhoneToAlumni(!showPhone);
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Privacy setting failed",
        description: error.message || "Unable to update your privacy setting.",
        variant: "destructive",
      });
    },
  });
  // Profile photo mutations
  const selectPresetAvatarMutation = useMutation({
    mutationFn: async (imageUrl: string) => {
      if (!user) throw new Error("No user found");
      const response = await apiRequest("PATCH", `/api/users/${user.id}/profile-image`, {
        imageUrl,
        imageType: 'color'
      });
      return response.json();
    },
    onSuccess: (updatedUser) => {
      localStorage.setItem("user", JSON.stringify(updatedUser));
      window.dispatchEvent(new Event('userChanged'));
      setUser(updatedUser);
      toast({
        className: "bg-green-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Profile photo updated",
        description: "Your profile photo has been successfully updated.",
      });
    },
    onError: (error: any) => {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Update failed",
        description: error.message || "Failed to update profile photo",
        variant: "destructive",
      });
    }
  });

  const cropYearbookPhotoMutation = useMutation({
    mutationFn: async (cropData: { yearbookId: string; pageId: string; cropData: Area }) => {
      if (!user) throw new Error("No user found");
      const response = await apiRequest("POST", `/api/users/${user.id}/crop-yearbook-photo`, cropData);
      return response.json();
    },
    onSuccess: (data) => {
      localStorage.setItem("user", JSON.stringify(data.user));
      window.dispatchEvent(new Event('userChanged'));
      setUser(data.user);
      setShowCropDialog(false);
      setSelectedYearbook(null);
      setSelectedPage(null);
      toast({
        className: "bg-green-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Profile photo updated",
        description: "Your cropped yearbook photo has been set as your profile picture.",
      });
    },
    onError: (error: any) => {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Cropping failed",
        description: error.message || "Failed to crop yearbook photo",
        variant: "destructive",
      });
    }
  });

  const uploadYearbookPhoto = async (blob: Blob) => {
    if (!user) throw new Error("No user found");
    
    const formData = new FormData();
    formData.append('profileImage', blob, 'yearbook-photo.png');
    
    const response = await fetch(`/api/users/${user.id}/profile-image`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${user.id}`
      },
      body: formData
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to upload photo');
    }
    
    const updatedUser = await response.json();
    
    // Update user in state and localStorage
    localStorage.setItem("user", JSON.stringify(updatedUser));
    window.dispatchEvent(new Event('userChanged'));
    setUser(updatedUser);
    setShowYearbookPhotoDialog(false);
    
    toast({
      className: "bg-green-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
      title: "Profile photo updated",
      description: "Your yearbook photo has been set as your profile picture.",
    });
  };

  const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSaveCrop = () => {
    if (!croppedAreaPixels || !selectedYearbook || !selectedPage) {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Error",
        description: "Please select an area to crop",
        variant: "destructive",
      });
      return;
    }

    cropYearbookPhotoMutation.mutate({
      yearbookId: selectedYearbook.id,
      pageId: selectedPage.id,
      cropData: croppedAreaPixels
    });
  };

  // Fetch user's purchased yearbooks
  const { data: purchasedYearbooks = [] } = useQuery<any[]>({
    queryKey: ['/api/viewer-year-purchases', user?.id],
    enabled: !!user && showCropDialog
  });

  const renderProfileTab = () => (
    <div className="space-y-4 sm:space-y-6 max-w-4xl">
      <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-lg sm:text-xl text-white">Account Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6 pt-0">
          {/* Full Name Field */}
          <div className="grid gap-2">
            <Label htmlFor="fullName" data-testid="label-full-name" className="text-sm font-medium text-white">Full Name</Label>
            <div className="flex items-center gap-2">
              {editingField === "fullName" ? (
                <>
                  <Input
                    id="fullName"
                    value={tempValues.fullName}
                    onChange={(e) => setTempValues(prev => ({ ...prev, fullName: e.target.value }))}
                    className="flex-1 h-10 sm:h-11 bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/60"
                    data-testid="input-full-name-edit"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleSaveField("fullName")}
                    disabled={isUpdatingProfile}
                    data-testid="button-save-full-name"
                    className="h-10 w-10 sm:h-11 sm:w-11 flex-shrink-0"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleCancelEdit("fullName")}
                    disabled={isUpdatingProfile}
                    data-testid="button-cancel-full-name"
                    className="h-10 w-10 sm:h-11 sm:w-11 flex-shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <Input
                    id="fullName"
                    value={profileForm.fullName}
                    readOnly
                    className="flex-1 bg-white/5 backdrop-blur-lg border border-white/20 text-white/70 h-10 sm:h-11"
                    data-testid="input-full-name"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => startEditing("fullName")}
                    data-testid="button-edit-full-name"
                    className="h-10 w-10 sm:h-11 sm:w-11 flex-shrink-0 touch-manipulation"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Username Field */}
          <div className="grid gap-2">
            <Label htmlFor="username" data-testid="label-username" className="text-sm font-medium text-white">Username</Label>
            <div className="flex items-center gap-2">
              {editingField === "username" ? (
                <>
                  <Input
                    id="username"
                    value={tempValues.username}
                    onChange={(e) => setTempValues(prev => ({ ...prev, username: e.target.value }))}
                    className="flex-1 h-10 sm:h-11 bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/60"
                    data-testid="input-username-edit"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleSaveField("username")}
                    disabled={isUpdatingProfile}
                    data-testid="button-save-username"
                    className="h-10 w-10 sm:h-11 sm:w-11 flex-shrink-0"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleCancelEdit("username")}
                    disabled={isUpdatingProfile}
                    data-testid="button-cancel-username"
                    className="h-10 w-10 sm:h-11 sm:w-11 flex-shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <Input
                    id="username"
                    value={profileForm.username}
                    readOnly
                    className="flex-1 bg-white/5 backdrop-blur-lg border border-white/20 text-white/70 h-10 sm:h-11"
                    data-testid="input-username"
                  />
                   {user?.lastUsernameChange && (
                     <p className="text-xs text-blue-200/70">
                       Username changes are limited to once every 14 days.
                     </p>
                   )}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => startEditing("username")}
                    data-testid="button-edit-username"
                    className="h-10 w-10 sm:h-11 sm:w-11 flex-shrink-0 touch-manipulation"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Email Field */}
          <div className="grid gap-2">
            <Label htmlFor="email" data-testid="label-email" className="text-sm font-medium text-white">Email</Label>
            <Input
              id="email"
              type="email"
              value={profileForm.email}
              readOnly
              disabled
              className="bg-white/5 backdrop-blur-lg border border-white/20 text-white/70 h-10 sm:h-11 cursor-not-allowed"
              data-testid="input-email"
            />
          </div>

          {/* Phone Number Field */}
          <div className="grid gap-2">
            <Label htmlFor="phoneNumber" data-testid="label-phone-number" className="text-sm font-medium text-white">Phone Number</Label>
            <div className="flex items-center gap-2">
              {editingField === "phoneNumber" ? (
                <>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    value={tempValues.phoneNumber}
                    onChange={(e) => setTempValues(prev => ({ ...prev, phoneNumber: e.target.value }))}
                    className="flex-1 h-10 sm:h-11 bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/60"
                    placeholder="(234)8012345678"
                    data-testid="input-phone-number-edit"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleSaveField("phoneNumber")}
                    disabled={isUpdatingProfile}
                    data-testid="button-save-phone-number"
                    className="h-10 w-10 sm:h-11 sm:w-11 flex-shrink-0"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleCancelEdit("phoneNumber")}
                    disabled={isUpdatingProfile}
                    data-testid="button-cancel-phone-number"
                    className="h-10 w-10 sm:h-11 sm:w-11 flex-shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    value={profileForm.phoneNumber}
                    readOnly
                    placeholder="Not provided"
                    className="flex-1 bg-white/5 backdrop-blur-lg border border-white/20 text-white/70 h-10 sm:h-11"
                    data-testid="input-phone-number"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => startEditing("phoneNumber")}
                    data-testid="button-edit-phone-number"
                    className="h-10 w-10 sm:h-11 sm:w-11 flex-shrink-0 touch-manipulation"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
            <p className="text-xs text-white/60">Use the format (country code)(number).</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Date of Birth */}
            <div className="grid gap-2">
              <Label htmlFor="dateOfBirth" data-testid="label-date-of-birth" className="text-sm font-medium text-white">Date of Birth</Label>
              <Input
                id="dateOfBirth"
                value={formatDateOfBirth(user.dateOfBirth)}
                readOnly
                disabled
                className="bg-white/5 backdrop-blur-lg border border-white/20 text-white/70 h-10 sm:h-11 cursor-not-allowed"
                data-testid="input-date-of-birth"
              />
              <p className="text-xs text-white/60">Private account information.</p>
            </div>

            {/* Account Type / Status */}
            <div className="grid gap-2">
              <Label data-testid="label-account-status" className="text-sm font-medium text-white">Account Type / Status</Label>
              <div className="min-h-10 sm:min-h-11 flex flex-col justify-center rounded-md border border-white/20 bg-white/5 px-3 py-2">
                <span className={`inline-flex w-fit items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${accountStatus === "Verified Alumni" ? "border-green-400/30 bg-green-500/20 text-green-200" : "border-blue-400/30 bg-blue-500/20 text-blue-200"}`}>{accountStatus}</span>
                {accountStatus === "Verified Alumni" && verifiedAlumniSchool && (
                  <span className="mt-1 text-xs text-white/60">School: {verifiedAlumniSchool}</span>
                )}
              </div>
              <p className="text-xs text-white/60">Managed by Yearbuk verification.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-lg sm:text-xl text-white">Currency Preference</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          <div className="grid gap-3">
            <Label htmlFor="currency" className="text-sm font-medium text-white">Preferred Currency</Label>
            <Select value={userCurrency} onValueChange={(value: Currency) => setUserCurrency(value)}>
              <SelectTrigger className="h-10 sm:h-11 bg-white/10 backdrop-blur-lg border border-white/20 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-blue-600/60 backdrop-blur-lg border border-white/20 text-white">
                <SelectItem value="USD">USD ($)</SelectItem>
                <SelectItem value="NGN">NGN (₦)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs sm:text-sm text-white/70">
              Prices will be displayed in your preferred currency.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-lg sm:text-xl text-white flex items-center">
            <Camera className="h-5 w-5 mr-2" />
            Profile Photo
          </CardTitle>
          <p className="text-sm text-white/70 mt-1">
            Choose from preset avatars or use your yearbook photo (verified alumni only)
          </p>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          <div className="space-y-4">
            {/* Current Profile Photo */}
            <div className="flex items-center gap-4 p-4 bg-white/5 rounded-lg">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-white/10 flex items-center justify-center">
                {user?.profileImage ? (
                  <img src={user.profileImage} alt="Profile" className="w-full h-full object-cover" data-testid="img-current-profile" />
                ) : (
                  <User className="w-8 h-8 text-white/50" />
                )}
              </div>
              <div>
                <p className="text-white font-medium">Current Photo</p>
                <p className="text-xs text-white/60">Click a preset below to change</p>
              </div>
            </div>

             {/* Solid Color Profiles */}
            <div>
               <Label className="text-sm font-medium text-white mb-3 block">Choose Profile Color</Label>
              <div className="grid grid-cols-4 gap-3">
                 {profileColors.map((color, index) => (
                  <button
                     key={color.value}
                     onClick={() => selectPresetAvatarMutation.mutate(color.imageUrl)}
                    disabled={selectPresetAvatarMutation.isPending}
                    className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all hover:scale-105 ${
                       user?.profileImage === color.imageUrl
                        ? 'border-blue-400 ring-2 ring-blue-400/50'
                        : 'border-white/20 hover:border-white/40'
                    }`}
                     aria-label={`${color.name} profile color`}
                     data-testid={`button-profile-color-${index}`}
                  >
                     <span
                       className="block w-full h-full"
                       style={{ backgroundColor: color.value }}
                       aria-hidden="true"
                     />
                     {user?.profileImage === color.imageUrl && (
                      <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                        <Check className="w-6 h-6 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Use Yearbook Photo Button */}
            <div className="pt-2">
              <Button
                onClick={() => {
                  // Check if user is verified alumni
                  const verifiedBadges = alumniBadges.filter((badge: any) => badge.status === 'verified');
                  if (verifiedBadges.length === 0) {
                    toast({
                      className: "bg-amber-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
                      title: "Verification Required",
                      description: "Only verified alumni can use yearbook photos as profile pictures.",
                    });
                    return;
                  }
                  setShowYearbookPhotoDialog(true);
                }}
                variant="outline"
                className="w-full h-12 bg-white/5 border-white/30 hover:bg-white/10 text-white"
                data-testid="button-use-yearbook-photo"
              >
                <BookOpen className="h-4 w-4 mr-2" />
                Use Yearbook Photo
              </Button>
              <p className="text-xs text-white/60 mt-2 text-center">
                Verified alumni can crop their own yearbook photo!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Redeem yearbook code mutation
  const redeemCode = async () => {
    if (!codeInput.trim() || !user) {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Invalid Input",
        description: "Please enter a valid code",
        variant: "destructive"
      });
      return;
    }

    setIsRedeemingCode(true);
    try {
      const response = await apiRequest("POST", "/api/yearbook-codes/redeem", {
        code: codeInput.trim().toUpperCase(),
        userId: user.id
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          className: "bg-green-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
          title: "Code Redeemed!",
          description: `Successfully unlocked ${data.year} yearbook access`,
        });
        setCodeInput("");
        // Invalidate any queries that might show yearbook access
        queryClient.invalidateQueries({ queryKey: ["/api/yearbook-access"] });
      } else {
        toast({
          className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
          title: "Redemption Failed",
          description: data.message || "Invalid or expired code",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Redemption Failed",
        description: error.message || "Failed to redeem code",
        variant: "destructive"
      });
    } finally {
      setIsRedeemingCode(false);
    }
  };

  const renderUnlockYearTab = () => {
    return (
      <div className="space-y-4 sm:space-y-6 max-w-2xl">
        <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-lg sm:text-xl text-white flex items-center">
              <Key className="h-5 w-5 mr-2" />
              Unlock Yearbook Access
            </CardTitle>
            <p className="text-sm text-white/70">
              Enter a 12-digit access code to unlock a specific yearbook year.
            </p>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="access-code" className="text-sm font-medium text-white">
                  Access Code
                </Label>
                <Input
                  id="access-code"
                  value={codeInput}
                  onChange={(e) => {
                    // Format input as XXXX-XXXX-XXXX (allow alphanumeric characters)
                    let value = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 12);
                    if (value.length > 4 && value.length <= 8) {
                      value = value.slice(0, 4) + '-' + value.slice(4);
                    } else if (value.length > 8) {
                      value = value.slice(0, 4) + '-' + value.slice(4, 8) + '-' + value.slice(8);
                    }
                    setCodeInput(value);
                  }}
                  placeholder="XXXX-XXXX-XXXX"
                  className="h-12 text-center font-mono text-lg bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20"
                  maxLength={14}
                  data-testid="input-access-code"
                />
                <p className="text-xs text-white/60">
                  Enter the 12-digit code provided by your school to unlock yearbook access.
                </p>
              </div>
              
              <Button
                onClick={redeemCode}
                disabled={isRedeemingCode || codeInput.length < 14}
                className="w-full h-12 text-base font-medium"
                data-testid="button-redeem-code"
              >
                {isRedeemingCode ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Redeeming Code...
                  </>
                ) : (
                  <>
                    <Key className="h-4 w-4 mr-2" />
                    Unlock Yearbook
                  </>
                )}
              </Button>
              
              <div className="bg-blue-50/10 border border-blue-200/20 rounded-lg p-4">
                <h3 className="font-medium text-white mb-2">How it works:</h3>
                <ul className="text-sm text-white/70 space-y-1">
                  <li>• Get a 12-digit access code from your school</li>
                  <li>• Enter the code above to unlock specific yearbook years</li>
                  <li>• Each code can only be used once</li>
                  <li>• You cannot redeem codes for years you already have access to</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderPaymentHistoryTab = () => {
    return (
      <div className="space-y-4 sm:space-y-6 max-w-4xl">
        <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-lg sm:text-xl text-white flex items-center">
              <Receipt className="h-5 w-5 mr-2" />
              Payment History
            </CardTitle>
            <p className="text-sm text-white/70">
              View all your yearbook purchases and payment records.
            </p>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            {isLoadingPayments ? (
              <div className="text-center py-8 text-white/70">Loading payment history...</div>
            ) : paymentHistory.length === 0 ? (
              <div className="text-center py-8 text-white/70">
                <Receipt className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No payment history found.</p>
                <p className="text-sm mt-1">Your paid yearbook purchases will appear here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {paymentHistory.map((payment) => (
                  <div 
                    key={payment.id} 
                    className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-colors"
                    data-testid={`payment-item-${payment.id}`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex-1">
                        <h3 className="text-white font-medium text-base" data-testid={`text-school-${payment.id}`}>
                          {payment.schoolName}
                        </h3>
                        <p className="text-white/60 text-sm" data-testid={`text-year-${payment.id}`}>
                          Year: {payment.year}
                        </p>
                        {payment.purchaseDate && (
                          <p className="text-white/50 text-xs mt-1" data-testid={`text-date-${payment.id}`}>
                            Purchased: {new Date(payment.purchaseDate).toLocaleDateString('en-US', { 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-start sm:items-end gap-1">
                        <span className="text-white font-semibold text-lg" data-testid={`text-price-${payment.id}`}>
                          {formatPrice(parseFloat(payment.price || '0'))}
                        </span>
                        {payment.paymentReference && (
                          <span className="text-white/40 text-xs font-mono" data-testid={`text-reference-${payment.id}`}>
                            Ref: {payment.paymentReference.slice(0, 12)}...
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderPrivacyTab = () => {
    return (
      <div className="space-y-4 sm:space-y-6 max-w-4xl">
        <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-lg sm:text-xl flex items-center text-white">
              <Eye className="h-5 w-5 mr-2 text-green-400" />
              Privacy
            </CardTitle>
            <p className="text-sm text-white/70 mt-2">Control how your personal information is shared across Yearbuk.</p>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <div className="rounded-lg border border-white/15 bg-white/5 p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <Phone className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-300" />
                  <div className="min-w-0">
                    <h3 className="font-medium text-white">Alumni Information</h3>
                    <p className="mt-1 text-sm font-medium text-white/90">Phone number visibility</p>
                    <p className="mt-1 text-sm text-white/60">Choose whether your phone number is shown to verified alumni in school alumni lists.</p>
                    <p className="mt-2 text-xs text-white/50">{showPhoneToAlumni ? "Visible to verified alumni" : "Hidden from verified alumni"}</p>
                  </div>
                </div>
                <Switch
                  checked={showPhoneToAlumni}
                  onCheckedChange={(checked) => privacyMutation.mutate(checked)}
                  disabled={privacyMutation.isPending || !user.phoneNumber}
                  aria-label="Show my phone number to verified alumni"
                  data-testid="switch-phone-visibility"
                  className="self-end sm:self-center data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-white/20"
                />
              </div>
              {!user.phoneNumber && (
                <p className="mt-4 border-t border-white/10 pt-3 text-xs text-white/50">Add a phone number in Account Information before changing its visibility.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl" data-testid="card-blocked-accounts">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-lg sm:text-xl flex items-center text-white">
              <UserX className="h-5 w-5 mr-2 text-orange-300" />
              Blocked accounts
            </CardTitle>
            <p className="text-sm text-white/70 mt-2">Manage the accounts you have blocked from interacting with you.</p>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <div className="rounded-lg border border-white/15 bg-white/5 p-4">
              <p className="font-medium text-white">No blocked accounts</p>
              <p className="mt-1 text-sm text-white/60">Accounts you block will appear here.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };
  const renderDeleteAccountTab = () => {
    return (
      <div className="space-y-4 sm:space-y-6 max-w-4xl">
        <Card className="border-red-300/25 bg-red-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-100">
              <AlertTriangle className="h-5 w-5" />
              Delete Account
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-white">Delete your account</p>
              <p className="mt-1 max-w-2xl text-sm text-white/65">
                Permanently remove your profile, memories, badges, and account activity. Completed payment records are retained when required for accounting.
              </p>
            </div>
            <Button
              variant="outline"
              className="w-full shrink-0 border-red-300/40 bg-red-950/30 text-red-100 hover:bg-red-900/40 hover:text-white sm:w-auto"
              onClick={() => {
                setDeleteStep("warning");
                setDeletePassword("");
                setDeleteAcknowledged(false);
                setDeleteAccountError("");
                setShowDeleteDialog(true);
              }}
              data-testid="button-delete-account"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete account
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  };
  const renderSecurityTab = () => {
    const emailIsVerified = user.isEmailVerified === true;

    return (
      <div className="space-y-4 sm:space-y-6 max-w-4xl">
        <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-lg sm:text-xl flex items-center text-white">
              <Shield className="h-5 w-5 mr-2 text-green-400" />
              Password &amp; Security
            </CardTitle>
            <p className="text-sm text-white/70 mt-2">Manage your password and review the security state of your viewer account.</p>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 space-y-4">
            {/* Security overview */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-white/15 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-wide text-white/50">Password</p>
                <p className="mt-1 text-sm text-white/80">Password changes require your current password.</p>
              </div>
              <div className="rounded-lg border border-white/15 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-wide text-white/50">Email</p>
                <p className="mt-1 break-words text-sm text-white">{user.email || "No email address"}</p>
                <div className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${emailIsVerified ? "border-green-400/30 bg-green-500/20 text-green-200" : "border-amber-400/30 bg-amber-500/20 text-amber-200"}`}>
                  {emailIsVerified ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                  {emailIsVerified ? "Email verified" : "Email not verified"}
                </div>
              </div>
            </div>

            {!emailIsVerified && user.email && (
              <div className="flex flex-col gap-3 rounded-lg border border-amber-400/20 bg-amber-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-white">Verify your email</p>
                  <p className="text-sm text-white/60">We will send a new verification link to your email address.</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => resendVerificationMutation.mutate()}
                  disabled={resendVerificationMutation.isPending}
                  className="w-full border-white/20 text-white sm:w-auto"
                  data-testid="button-verify-email"
                >
                  {resendVerificationMutation.isPending ? "Sending..." : "Verify Email"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Password reset */}
        <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-lg sm:text-xl flex items-center text-white">
              <Key className="h-5 w-5 mr-2 text-cyan-400" />
              Password Reset
            </CardTitle>
            <p className="text-sm text-white/70 mt-2">We’ll send a secure password reset link to the email address used to create your account.</p>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 space-y-4">
            <Button
              type="button"
              onClick={() => requestPasswordResetMutation.mutate()}
              disabled={requestPasswordResetMutation.isPending || !user.email}
              className="w-full sm:w-auto"
              data-testid="button-request-password-reset"
            >
              {requestPasswordResetMutation.isPending ? "Sending reset email..." : "Send Password Reset Email"}
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-lg sm:text-xl flex items-center text-white">
              <Shield className="h-5 w-5 mr-2 text-purple-400" />
              Two-factor authentication
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <div className="flex flex-col gap-3 rounded-lg border border-white/15 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-white">Require two-factor authentication</p>
                <p className="mt-1 text-sm text-white/60">When enabled, logins will require a verification code sent to the user’s email mailbox. Login enforcement will be connected in a future update.</p>
              </div>
              <Switch
                checked={isTwoFactorEnabled}
                onCheckedChange={setIsTwoFactorEnabled}
                aria-label="Require two-factor authentication"
                data-testid="switch-two-factor-authentication"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };
  const renderContent = () => {
    switch (activeTab) {
      case "profile":
        return renderProfileTab();
      case "unlock":
        return renderUnlockYearTab();
      case "payments":
        return renderPaymentHistoryTab();
      case "security":
        return renderSecurityTab();
      case "privacy":
        return renderPrivacyTab();
      case "delete-account":
        return renderDeleteAccountTab();
      default:
        return renderProfileTab();
    }
  };

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
                onClick={handleBackClick}
                className="text-white hover:bg-white/20 flex-shrink-0 mr-2"
                data-testid="button-back"
              >
                <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              
              {/* Mobile sidebar toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSidebar(!showSidebar)}
                className="text-white hover:bg-white/20 lg:hidden flex-shrink-0 mr-2"
                data-testid="button-sidebar-toggle"
              >
                <MenuIcon className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                <Settings className="text-white text-xs sm:text-sm" />
              </div>
              <h1 className="ml-2 sm:ml-3 text-sm sm:text-xl font-semibold text-white truncate">Settings</h1>
            </div>

            <div className="flex items-center space-x-1 sm:space-x-4 flex-shrink-0">
              {/* Mobile Circle Status Indicator - Show only on small screens */}
              <div className="sm:hidden relative">
                {accountStatus === "Verified Alumni" ? (
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    {alumniBadges.filter(b => b.status === "verified").length}
                  </div>
                ) : (
                  <div className="w-6 h-6 bg-blue-500 rounded-full"></div>
                )}
              </div>
              
              {/* Desktop Account Status Indicator - Hidden on small screens */}
              <div className={`hidden sm:block px-2 sm:px-3 py-1 rounded-full text-xs font-medium ${
                accountStatus === "Verified Alumni" 
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
                <span className="hidden sm:inline">{user.fullName || 'User'}</span>
                <span className="sm:hidden">{user.fullName?.split(" ")[0] || 'User'}</span>
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

      {/* Mobile Sidebar Overlay */}
      {showSidebar && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setShowSidebar(false)}
        />
      )}

      <div className="flex">
        {/* Left Sidebar - Desktop */}
        <div className="hidden lg:block w-64 min-h-screen bg-white/10 backdrop-blur-lg border-r border-white/20 overflow-y-auto">
          <div className="p-4 space-y-6">
            {/* Account Section */}
            <div>
              <nav className="space-y-1">
                <button
                  onClick={() => setActiveTab("profile")}
                  className={`flex items-center w-full px-3 py-2 text-sm rounded-md transition-colors ${
                    activeTab === "profile"
                      ? "bg-white/20 text-white font-medium"
                      : "text-white/70 hover:text-white hover:bg-white/10"
                  }`}
                  data-testid="tab-profile"
                >
                  <User className="h-4 w-4 mr-2 flex-shrink-0" />
                  Account Information
                </button>
              </nav>
            </div>

            {/* Billing Section */}
            <div className={BETA_VERSION ? 'pointer-events-none opacity-50 select-none' : ''}>
              <nav className="space-y-1">
                <button
                  onClick={() => setActiveTab("unlock")}
                  className={`flex items-center w-full px-3 py-2 text-sm rounded-md transition-colors ${
                    activeTab === "unlock"
                      ? "bg-white/20 text-white font-medium"
                      : "text-white/70 hover:text-white hover:bg-white/10"
                  }`}
                  data-testid="tab-unlock"
                >
                  <Key className="h-4 w-4 mr-2 flex-shrink-0" />
                  Unlock Year
                </button>
                <button
                  onClick={() => setActiveTab("payments")}
                  className={`flex items-center w-full px-3 py-2 text-sm rounded-md transition-colors ${
                    activeTab === "payments"
                      ? "bg-white/20 text-white font-medium"
                      : "text-white/70 hover:text-white hover:bg-white/10"
                  }`}
                  data-testid="tab-payments"
                >
                  <Receipt className="h-4 w-4 mr-2 flex-shrink-0" />
                  Payment History
                </button>
              </nav>
            </div>

            {/* Security Section */}
            <div>
              <nav className="space-y-1">
                <button
                  onClick={() => setActiveTab("security")}
                  className={`flex items-center w-full px-3 py-2 text-sm rounded-md transition-colors ${
                    activeTab === "security"
                      ? "bg-white/20 text-white font-medium"
                      : "text-white/70 hover:text-white hover:bg-white/10"
                  }`}
                  data-testid="tab-security"
                >
                  <Shield className="h-4 w-4 mr-2 flex-shrink-0" />
                  Password & Security
                </button>
              </nav>
            </div>

            {/* Privacy Section */}
            <div>
              <nav className="space-y-1">
                <button
                  onClick={() => setActiveTab("privacy")}
                  className={`flex items-center w-full px-3 py-2 text-sm rounded-md transition-colors ${activeTab === "privacy" ? "bg-white/20 text-white font-medium" : "text-white/70 hover:text-white hover:bg-white/10"}`}
                  data-testid="tab-privacy"
                >
                  <Eye className="h-4 w-4 mr-2 flex-shrink-0" />
                  Privacy
                </button>
                <button
                  onClick={() => setActiveTab("delete-account")}
                  className={`flex items-center w-full px-3 py-2 text-sm rounded-md transition-colors ${activeTab === "delete-account" ? "bg-white/20 text-white font-medium" : "text-white/70 hover:text-white hover:bg-white/10"}`}
                  data-testid="tab-delete-account"
                >
                  <Trash2 className="h-4 w-4 mr-2 flex-shrink-0 text-red-300" />
                  Delete Account
                </button>
              </nav>
            </div>
          </div>
        </div>

        {/* Mobile Sidebar */}
        <div className={`fixed top-0 left-0 h-full w-64 bg-white/10 backdrop-blur-lg border-r border-white/20 z-50 transform transition-transform duration-300 ease-in-out overflow-y-auto lg:hidden ${
          showSidebar ? 'translate-x-0' : '-translate-x-full'
        }`}>
          <div className="p-4 pt-20 space-y-6">
            {/* Account Section */}
            <div>
              <nav className="space-y-1">
                <button
                  onClick={() => {
                    setActiveTab("profile");
                    setShowSidebar(false);
                  }}
                  className={`flex items-center w-full px-3 py-3 text-sm rounded-md transition-colors touch-manipulation ${
                    activeTab === "profile"
                      ? "bg-white/20 text-white font-medium"
                      : "text-white/70 hover:text-white hover:bg-white/10"
                  }`}
                  data-testid="tab-profile-mobile"
                >
                  <User className="h-5 w-5 mr-3 flex-shrink-0" />
                  Account Information
                </button>
              </nav>
            </div>

            {/* Billing Section */}
            <div className={BETA_VERSION ? 'pointer-events-none opacity-50 select-none' : ''}>
              <nav className="space-y-1">
                <button
                  onClick={() => {
                    setActiveTab("unlock");
                    setShowSidebar(false);
                  }}
                  className={`flex items-center w-full px-3 py-3 text-sm rounded-md transition-colors touch-manipulation ${
                    activeTab === "unlock"
                      ? "bg-white/20 text-white font-medium"
                      : "text-white/70 hover:text-white hover:bg-white/10"
                  }`}
                  data-testid="tab-unlock-mobile"
                >
                  <Key className="h-5 w-5 mr-3 flex-shrink-0" />
                  Unlock Year
                </button>
                <button
                  onClick={() => {
                    setActiveTab("payments");
                    setShowSidebar(false);
                  }}
                  className={`flex items-center w-full px-3 py-3 text-sm rounded-md transition-colors touch-manipulation ${
                    activeTab === "payments"
                      ? "bg-white/20 text-white font-medium"
                      : "text-white/70 hover:text-white hover:bg-white/10"
                  }`}
                  data-testid="tab-payments-mobile"
                >
                  <Receipt className="h-5 w-5 mr-3 flex-shrink-0" />
                  Payment History
                </button>
              </nav>
            </div>

            {/* Security Section */}
            <div>
              <nav className="space-y-1">
                <button
                  onClick={() => {
                    setActiveTab("security");
                    setShowSidebar(false);
                  }}
                  className={`flex items-center w-full px-3 py-3 text-sm rounded-md transition-colors touch-manipulation ${
                    activeTab === "security"
                      ? "bg-white/20 text-white font-medium"
                      : "text-white/70 hover:text-white hover:bg-white/10"
                  }`}
                  data-testid="tab-security-mobile"
                >
                  <Shield className="h-5 w-5 mr-3 flex-shrink-0" />
                  Password & Security
                </button>
              </nav>
            </div>

            {/* Privacy Section */}
            <div>
              <nav className="space-y-1">
                <button
                  onClick={() => {
                    setActiveTab("privacy");
                    setShowSidebar(false);
                  }}
                  className={`flex items-center w-full px-3 py-3 text-sm rounded-md transition-colors touch-manipulation ${activeTab === "privacy" ? "bg-white/20 text-white font-medium" : "text-white/70 hover:text-white hover:bg-white/10"}`}
                  data-testid="tab-privacy-mobile"
                >
                  <Eye className="h-5 w-5 mr-3 flex-shrink-0" />
                  Privacy
                </button>
                <button
                  onClick={() => {
                    setActiveTab("delete-account");
                    setShowSidebar(false);
                  }}
                  className={`flex items-center w-full px-3 py-3 text-sm rounded-md transition-colors touch-manipulation ${activeTab === "delete-account" ? "bg-white/20 text-white font-medium" : "text-white/70 hover:text-white hover:bg-white/10"}`}
                  data-testid="tab-delete-account-mobile"
                >
                  <Trash2 className="h-5 w-5 mr-3 flex-shrink-0 text-red-300" />
                  Delete Account
                </button>
              </nav>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <div className="p-4 sm:p-6">
            {renderContent()}
          </div>
        </div>
      </div>
      </div>


      {/* Delete Account Dialog */}
      <Dialog
        open={showDeleteDialog}
        onOpenChange={(open) => {
          if (!open && !isDeletingAccount) resetDeleteDialog();
          else setShowDeleteDialog(open);
        }}
      >
        <DialogContent className="max-w-lg border-red-300/25 bg-slate-950/95 text-white backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl text-red-100">
              <AlertTriangle className="h-5 w-5" />
              {deleteStep === "warning" ? "Delete your account?" : "Confirm permanent deletion"}
            </DialogTitle>
            <DialogDescription className="text-white/70">
              {deleteStep === "warning"
                ? "This cannot be undone. Your profile, memories, badges, saved activity, and account access will be removed."
                : "Enter your current password to permanently delete this viewer account."}
            </DialogDescription>
          </DialogHeader>

          {deleteStep === "warning" ? (
            <div className="space-y-5">
              <div className="rounded-lg border border-red-300/20 bg-red-950/30 p-4 text-sm text-red-50/85">
                Completed payment records may be retained where required for accounting, but they will be anonymized. School-owned yearbooks and shared school content will not be deleted.
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10" onClick={resetDeleteDialog} data-testid="button-cancel-delete-account">
                  Cancel
                </Button>
                <Button className="bg-red-600 text-white hover:bg-red-700" onClick={() => { setDeleteStep("confirm"); setDeleteAccountError(""); }} data-testid="button-continue-delete-account">
                  Continue
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="delete-account-password" className="text-white">Current password</Label>
                <div className="relative">
                  <Input
                    id="delete-account-password"
                    type={showDeletePassword ? "text" : "password"}
                    value={deletePassword}
                    onChange={(event) => { setDeletePassword(event.target.value); setDeleteAccountError(""); }}
                    autoComplete="current-password"
                    className="border-white/20 bg-white/10 pr-11 text-white placeholder:text-white/40"
                    placeholder="Enter your current password"
                    aria-invalid={Boolean(deleteAccountError)}
                    data-testid="input-delete-account-password"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
                    onClick={() => setShowDeletePassword((visible) => !visible)}
                    aria-label={showDeletePassword ? "Hide password" : "Show password"}
                  >
                    {showDeletePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <label className="flex cursor-pointer items-start gap-3 text-sm text-white/80">
                <input
                  type="checkbox"
                  checked={deleteAcknowledged}
                  onChange={(event) => setDeleteAcknowledged(event.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-red-600"
                  data-testid="checkbox-confirm-delete-account"
                />
                <span>I understand that this action is permanent and cannot be undone.</span>
              </label>
              {deleteAccountError && <p role="alert" className="text-sm text-red-300">{deleteAccountError}</p>}
              <div className="flex justify-end gap-3">
                <Button variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10" onClick={resetDeleteDialog} disabled={isDeletingAccount} data-testid="button-cancel-final-delete">
                  Cancel
                </Button>
                <Button
                  className="bg-red-600 text-white hover:bg-red-700"
                  onClick={handleDeleteAccount}
                  disabled={!deletePassword || !deleteAcknowledged || isDeletingAccount}
                  data-testid="button-confirm-delete-account"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {isDeletingAccount ? "Deleting..." : "Permanently delete"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Crop Dialog */}
      <Dialog open={showCropDialog} onOpenChange={setShowCropDialog}>
        <DialogContent className="max-w-2xl bg-blue-600/80 backdrop-blur-lg border border-white/20 text-white">
          <DialogHeader>
            <DialogTitle className="text-xl">Crop Yearbook Photo</DialogTitle>
            <DialogDescription className="text-white/70">
              Select a yearbook and page, then crop the area you want for your profile photo
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {!selectedPage ? (
              <div className="space-y-4">
                <p className="text-sm text-white/80">
                  This feature allows verified alumni to crop a section from their purchased yearbook.
                  Select a yearbook to get started.
                </p>
                <p className="text-xs text-white/60">
                  Note: For demonstration, you'll need to implement the yearbook page selector.
                  This would show your purchased yearbooks and allow page selection.
                </p>
                <Button
                  onClick={() => setShowCropDialog(false)}
                  variant="outline"
                  className="w-full bg-white/5 border-white/30 text-white"
                  data-testid="button-close-crop-dialog"
                >
                  Close
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative h-96 bg-black/30 rounded-lg overflow-hidden">
                  <Cropper
                    image={selectedPage.imageUrl}
                    crop={crop}
                    zoom={zoom}
                    aspect={1}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={onCropComplete}
                  />
                </div>
                
                <div className="flex gap-2">
                  <Button
                    onClick={handleSaveCrop}
                    disabled={cropYearbookPhotoMutation.isPending}
                    className="flex-1"
                    data-testid="button-save-crop"
                  >
                    <Crop className="h-4 w-4 mr-2" />
                    {cropYearbookPhotoMutation.isPending ? 'Saving...' : 'Save Crop'}
                  </Button>
                  <Button
                    onClick={() => {
                      setShowCropDialog(false);
                      setSelectedPage(null);
                      setSelectedYearbook(null);
                    }}
                    variant="outline"
                    className="bg-white/5 border-white/30 text-white"
                    data-testid="button-cancel-crop"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Yearbook Photo Selection Dialog */}
      <YearbookPhotoSelectionDialog
        isOpen={showYearbookPhotoDialog}
        onClose={() => setShowYearbookPhotoDialog(false)}
        alumniBadges={alumniBadges}
        userId={user?.id || ''}
        onPhotoSelected={async (blob) => {
          try {
            await uploadYearbookPhoto(blob);
          } catch (error: any) {
            toast({
              className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
              title: "Upload failed",
              description: error.message || "Failed to upload yearbook photo",
              variant: "destructive",
            });
            throw error; // Re-throw to prevent dialog from closing
          }
        }}
      />
    </div>
  );
}