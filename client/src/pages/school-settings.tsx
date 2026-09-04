import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import ImageCropDialog from "@/components/ImageCropDialog";
import { PasswordChangeDialog } from "@/components/PasswordChangeDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, User, ShoppingCart, Bell, Settings, Menu, Eye, EyeOff, Edit, Check, X, LogOut, MenuIcon, Home, DollarSign, Building2, CheckCircle, AlertCircle, CreditCard, Monitor, Key, Copy, RefreshCw, Search, Upload, Receipt, Shield, Clock, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useCurrency, Currency } from "@/contexts/CurrencyContext";
import type { User as UserType, yearbookCodes, Notification } from "@shared/schema";
import { CURRENT_YEAR, BETA_VERSION } from "@shared/constants";

type YearbookCode = typeof yearbookCodes.$inferSelect;
import { navigateBack, navigateWithTracking } from "@/lib/navigation";

interface School {
  id: string;
  username?: string;
  name: string;
  yearFounded?: number;
  country?: string;
  city?: string;
  email?: string;
  phoneNumber?: string;
  website?: string;
  address?: string;
  state?: string;
  logo?: string;
  coverPhoto?: string;
  coverPhotoCloudinaryId?: string;
  paystackSubaccountCode?: string;
  bankAccountNumber?: string;
  bankCode?: string;
  subaccountStatus?: string;
  revenueSharePercentage?: number;
  lastBankAccountChange?: string;
  lastSchoolNameChange?: string;
}

interface Bank {
  name: string;
  code: string;
  slug: string;
}

export default function SchoolSettings() {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<UserType | null>(null);
  const [activeTab, setActiveTab] = useState("profile");
  const [showHamburgerMenu, setShowHamburgerMenu] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const { toast } = useToast();
  const { userCurrency, setUserCurrency, formatPrice, convertPrice } = useCurrency();

  // Set custom page title
  useEffect(() => {
    document.title = "Settings - Yearbuk";
  }, []);

  // Revenue sharing state
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [selectedBankCode, setSelectedBankCode] = useState("");
  const [bankSearchQuery, setBankSearchQuery] = useState("");
  const [selectedBankName, setSelectedBankName] = useState("");
  const [showBankDropdown, setShowBankDropdown] = useState(false);
  const [accountHolderName, setAccountHolderName] = useState("");
  const [isVerifyingAccount, setIsVerifyingAccount] = useState(false);
  const [verificationError, setVerificationError] = useState("");
  const [isChangingAccount, setIsChangingAccount] = useState(false);
  
  // 2FA state for bank account changes
  const [show2FADialog, setShow2FADialog] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [isSending2FA, setIsSending2FA] = useState(false);
  const [isVerifying2FA, setIsVerifying2FA] = useState(false);
  const [is2FAVerified, setIs2FAVerified] = useState(false);
  const [canResend2FA, setCanResend2FA] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Ref for bank dropdown
  const bankDropdownRef = useRef<HTMLDivElement>(null);

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    email: "",
    username: "",
    schoolName: "",
    yearFounded: "",
    country: "",
    city: "",
    phoneNumber: "",
    website: "",
    address: "",
    state: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Individual field editing states
  const [editingField, setEditingField] = useState<string | null>(null);
  const [tempValues, setTempValues] = useState({
    email: "",
    username: "",
    schoolName: "",
    yearFounded: "",
    country: "",
    city: "",
    phoneNumber: "",
    website: "",
    address: "",
    state: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  
  // Username availability checking state
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameMessage, setUsernameMessage] = useState("");
  
  // Confirmation dialog states
  const [showUsernameConfirm, setShowUsernameConfirm] = useState(false);
  const [showSchoolNameConfirm, setShowSchoolNameConfirm] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [pendingTwoFactorEnabled, setPendingTwoFactorEnabled] = useState(false);
  const [showSecurityTwoFactorConfirmDialog, setShowSecurityTwoFactorConfirmDialog] = useState(false);
  const [showSecurityTwoFactorDialog, setShowSecurityTwoFactorDialog] = useState(false);
  const [securityTwoFactorCode, setSecurityTwoFactorCode] = useState("");
  const [isRequestingTwoFactor, setIsRequestingTwoFactor] = useState(false);
  const [isVerifyingTwoFactor, setIsVerifyingTwoFactor] = useState(false);

  // Yearbook codes state
  const [selectedYear, setSelectedYear] = useState<number>(CURRENT_YEAR);
  const [codeCount, setCodeCount] = useState<number>(10);
  const [isCustomCodeCount, setIsCustomCodeCount] = useState<boolean>(false);
  const [customCodeCount, setCustomCodeCount] = useState<string>("");
  const [isGeneratingCodes, setIsGeneratingCodes] = useState(false);
  const [generatedCodes, setGeneratedCodes] = useState<YearbookCode[]>([]);
  const [yearSearchQuery, setYearSearchQuery] = useState<string>("");
  
  // Delete dialog state
  const [codeToDelete, setCodeToDelete] = useState<YearbookCode | null>(null);
  const [yearToDeleteAll, setYearToDeleteAll] = useState<number | null>(null);
  const [isDeletingCode, setIsDeletingCode] = useState(false);

  // Logo crop dialog state
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);

  // Banner crop dialog state
  const [showBannerCropDialog, setShowBannerCropDialog] = useState(false);
  const [selectedBannerFile, setSelectedBannerFile] = useState<File | null>(null);

  // Handle cropped logo upload
  const handleCroppedLogoSave = async (croppedBlob: Blob) => {
    if (!school?.id || !user?.id) return;

    try {
      const formData = new FormData();
      formData.append('schoolLogo', croppedBlob, 'logo.jpg');
      
      const response = await fetch(`/api/schools/${school.id}/logo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.id}`
        },
        body: formData
      });

      const data = await response.json();
      
      if (data.school) {
        // Refresh school data
        queryClient.invalidateQueries({ queryKey: ["/api/schools", user.id] });
        toast({
          className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
          title: "Logo updated successfully",
          description: "Your school logo has been saved."
        });
      } else {
        throw new Error(data.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Logo upload failed:', error);
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Upload failed",
        description: "Failed to save logo. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Handle cropped banner upload
  const handleCroppedBannerSave = async (croppedBlob: Blob) => {
    if (!school?.id || !user?.id) return;

    try {
      const formData = new FormData();
      formData.append('schoolBanner', croppedBlob, 'banner.jpg');
      
      const response = await fetch(`/api/schools/${school.id}/banner`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.id}`
        },
        body: formData
      });

      const data = await response.json();
      
      if (data.school) {
        // Refresh school data
        queryClient.invalidateQueries({ queryKey: ["/api/schools", user.schoolId] });
        toast({
          className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
          title: "Banner updated successfully",
          description: "Your school banner has been saved."
        });
      } else {
        throw new Error(data.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Banner upload failed:', error);
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Upload failed",
        description: "Failed to save banner. Please try again.",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) {
      setLocation("/");
      return;
    }
    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);
    setTwoFactorEnabled(Boolean(parsedUser.twoFactorEnabled));
    
    // Initialize profile form with current user data  
    setProfileForm(prev => ({
      ...prev,
      email: parsedUser.email || "",
      username: parsedUser.username || "",
      website: "",
      address: "", 
      state: ""
    }));

    // Check for tab parameter in URL to navigate directly to specific tab
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam === 'revenue') {
      setActiveTab('revenue');
    }
  }, [setLocation]);

  // Fetch school data
  const { data: school } = useQuery<School>({
    queryKey: ["/api/schools", user?.schoolId],
    enabled: !!user?.schoolId,
  });
  // Keep the form synced with the single school profile source of truth.
  useEffect(() => {
    if (!school) return;
    setProfileForm(prev => ({
      ...prev,
      username: school.username || "",
      email: school.email || "",
      schoolName: school.name || "",
      yearFounded: school.yearFounded ? String(school.yearFounded) : "",
      country: school.country || "",
      city: school.city || "",
      phoneNumber: school.phoneNumber || "",
      website: school.website || "",
      address: school.address || "",
      state: school.state || ""
    }));
  }, [school]);
  // Read the authenticated account from the backend for real security state.
  const { data: accountUser } = useQuery<UserType>({
    queryKey: ["/api/users", user?.id],
    enabled: !!user?.id && activeTab === "security",
  });

  useEffect(() => {
    const account = accountUser || user;
    if (!account) return;
    setTwoFactorEnabled(Boolean(account.twoFactorEnabled));
  }, [accountUser?.id]);




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

  // Update form when school data is loaded
  useEffect(() => {
    if (school) {
      setProfileForm(prev => ({
        ...prev,
        website: school.website || "",
        address: school.address || "",
        state: school.state || ""
      }));
    }
  }, [school]);

  // Fetch available banks
  const { data: banksData } = useQuery<{ status: boolean; data: Bank[] }>({
    queryKey: ["/api/banks"],
  });

  // Close bank dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (bankDropdownRef.current && !bankDropdownRef.current.contains(event.target as Node)) {
        setShowBankDropdown(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch existing yearbook codes
  const { data: existingCodes, isLoading: isLoadingCodes } = useQuery<YearbookCode[]>({
    queryKey: ["/api/yearbook-codes/school", user?.schoolId],
    enabled: !!user?.schoolId && activeTab === "codes",
  });

  // Fetch payment history (for payments tab)
  const { data: paymentHistory = [], isLoading: loadingPayments } = useQuery<any[]>({
    queryKey: ["/api/schools", school?.id, "payment-history"],
    enabled: !!school?.id && !!user?.id && activeTab === "revenue",
  });

  // Fetch sales history (for payments tab)
  const { data: salesHistory = [], isLoading: loadingSales } = useQuery<any[]>({
    queryKey: ["/api/schools", school?.id, "sales-history"],
    enabled: !!school?.id && !!user?.id && activeTab === "revenue",
  });


  type ProfileField = "email" | "username" | "schoolName" | "yearFounded" | "country" | "city" | "phoneNumber" | "website" | "address" | "state";

  const startEditing = (field: ProfileField) => {
    setTempValues(prev => ({ ...prev, [field]: profileForm[field] || "" }));
    setEditingField(field);
    if (field === "username") {
      setUsernameAvailable(true);
      setUsernameMessage("");
    }
  };

  const handleCancelEdit = (field: ProfileField) => {
    setEditingField(null);
    setTempValues(prev => ({ ...prev, [field]: profileForm[field] || "" }));
    if (field === "username") {
      setUsernameAvailable(null);
      setUsernameMessage("");
    }
  };

  const performSave = async (field: ProfileField) => {
    if (!school?.id) return;

    setIsUpdatingProfile(true);
    try {
      const value = tempValues[field].trim();
      const payload = { [field === "schoolName" ? "name" : field]: value };
      const response = await apiRequest("PATCH", "/api/schools/" + school.id, payload);
      const updatedSchool = await response.json();
      const updatedValue = field === "schoolName" ? updatedSchool.name : updatedSchool[field];

      setProfileForm(prev => ({
        ...prev,
        [field]: updatedValue == null ? value : String(updatedValue),
      }));
      queryClient.invalidateQueries({ queryKey: ["/api/schools", user?.schoolId] });
      setEditingField(null);
      setShowUsernameConfirm(false);
      setShowSchoolNameConfirm(false);
      setUsernameAvailable(null);
      setUsernameMessage("");
      toast({
        className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Profile updated",
        description: "Your school information has been saved.",
      });
    } catch (error: any) {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Update failed",
        description: error?.message || "Could not save your school information. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleConfirmSave = (field: ProfileField) => {
    const value = tempValues[field].trim();
    const optionalFields: ProfileField[] = ["website", "address", "state"];

    if (!value && !optionalFields.includes(field)) {
      toast({
        title: "Value required",
        description: "Please enter a value before saving.",
        variant: "destructive",
      });
      return;
    }

    if (field === "username") {
      if (!/^[a-z0-9_]{3,50}$/.test(value.toLowerCase())) {
        setUsernameAvailable(false);
        setUsernameMessage("Use 3–50 lowercase letters, numbers, or underscores.");
        toast({
          title: "Invalid username",
          description: "Use 3–50 letters, numbers, or underscores.",
          variant: "destructive",
        });
        return;
      }
      setShowUsernameConfirm(true);
      return;
    }

    if (field === "schoolName") {
      setShowSchoolNameConfirm(true);
      return;
    }

    performSave(field);
  };

  const renderEditableSchoolField = (
    field: ProfileField,
    label: string,
    inputProps: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => {
    const { value: _value, onChange: _onChange, ...restInputProps } = inputProps;
    const isEditing = editingField === field;

    return (
      <div className="grid gap-2">
        <Label htmlFor={field} data-testid={"label-" + field} className="text-sm font-medium text-white">
          {label}
        </Label>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Input
                {...restInputProps}
                id={field}
                value={tempValues[field] || ""}
                onChange={(e) => setTempValues(prev => ({ ...prev, [field]: e.target.value }))}
                className="flex-1 h-10 sm:h-11 bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20"
                data-testid={"input-" + field + "-edit"}
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={() => handleConfirmSave(field)}
                disabled={isUpdatingProfile}
                data-testid={"button-save-" + field}
                className="h-10 w-10 sm:h-11 sm:w-11 flex-shrink-0 bg-white/10 backdrop-blur-lg border border-white/20 text-white"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => handleCancelEdit(field)}
                disabled={isUpdatingProfile}
                data-testid={"button-cancel-" + field}
                className="h-10 w-10 sm:h-11 sm:w-11 flex-shrink-0 bg-white/10 backdrop-blur-lg border border-white/20 text-white"
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Input
                {...restInputProps}
                id={field}
                value={profileForm[field] || ""}
                readOnly
                className="flex-1 h-10 sm:h-11 bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50"
                data-testid={"input-" + field}
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={() => startEditing(field)}
                data-testid={"button-edit-" + field}
                className="h-10 w-10 sm:h-11 sm:w-11 flex-shrink-0 bg-white/10 backdrop-blur-lg border border-white/20 text-white"
              >
                <Edit className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    );
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    window.dispatchEvent(new Event("userChanged"));
    setLocation("/home");
  };

  const renderDisplayTab = () => {
    return (
      <div className="space-y-4 sm:space-y-6 max-w-4xl">
        <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-lg sm:text-xl text-white">Currency</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6 pt-0">
            {/* Currency Preference */}
            <div className="grid gap-2">
              <Label htmlFor="currency-preference" className="text-sm font-medium text-white" data-testid="label-currency-preference">
                Preferred Currency Display
              </Label>
              <div className="space-y-2">
                <Select value={userCurrency} onValueChange={(value: Currency) => setUserCurrency(value)} data-testid="select-currency">
                  <SelectTrigger className="w-full bg-white/10 backdrop-blur-lg border border-white/20 text-white">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent className="bg-blue-600/60 backdrop-blur-lg border border-white/20 text-white">
                    <SelectItem value="USD" className="text-white hover:bg-white/20" data-testid="option-usd">
                      USD ($) - US Dollar
                    </SelectItem>
                    <SelectItem value="NGN" className="text-white hover:bg-white/20" data-testid="option-ngn">
                      NGN (₦) - Nigerian Naira
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-white/70">
                  Choose how prices are displayed throughout the application. Online payments are not currently active.
                </p>
              </div>
            </div>

            {/* Currency Preview */}
            <div className="grid gap-2">
              <Label className="text-sm font-medium text-white">Price Preview</Label>
              <div className="bg-white/5 backdrop-blur-lg border border-white/20 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-white/80">School Year Access:</span>
                  <span className="font-medium text-white">{formatPrice(16.99)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/80">Viewer Year Access:</span>
                  <span className="font-medium text-white">{formatPrice(6.99)}</span>
                </div>
                <p className="text-xs text-white/60 mt-2">
                  {userCurrency === 'NGN' ? 'Prices converted from USD at current exchange rate' : 'Base prices in USD'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderRevenueTab = () => {
    const revenueHistory = Array.isArray(salesHistory) ? salesHistory : [];

    return (
      <div className="space-y-4 sm:space-y-6 max-w-4xl">
        {renderDisplayTab()}

        <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center text-white">
              <CreditCard className="h-5 w-5 mr-2 text-blue-300" />
              Payment status
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <div className="rounded-lg border border-blue-300/30 bg-blue-500/10 p-4">
              <p className="font-medium text-white">Payments are not currently active.</p>
              <p className="mt-1 text-sm text-white/70">
                Yearbook payments will be processed through Paystack when online payments are enabled for Yearbuk.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center text-white">
              <DollarSign className="h-5 w-5 mr-2 text-green-300" />
              Planned revenue split
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <p className="text-sm text-white/70">
              When payments are enabled, schools are planned to receive 90% of eligible yearbook revenue while Yearbuk retains 10%.
            </p>
            <p className="mt-2 text-xs text-white/50">This is a future platform model, not a current balance or payout.</p>
          </CardContent>
        </Card>

        <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-lg sm:text-xl text-white">Revenue history</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            {loadingSales ? (
              <p className="text-sm text-white/70">Loading revenue history...</p>
            ) : revenueHistory.length === 0 ? (
              <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                Revenue tracking will appear here once Yearbuk payments are enabled.
              </div>
            ) : (
              <div className="space-y-3">
                {revenueHistory.map((sale: any) => (
                  <div key={sale.id} className="flex flex-col gap-2 rounded-lg border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-white">{sale.description || "Yearbook access sale"}</p>
                      <p className="text-xs text-white/60">
                        {sale.date ? new Date(sale.date).toLocaleDateString() : "Date unavailable"}
                        {sale.reference ? " · Ref: " + sale.reference : ""}
                      </p>
                    </div>
                    <span className="font-medium text-green-200">
                      {sale.currency === "NGN" ? "₦" : sale.currency === "USD" ? "$" : ""}{Number(sale.amount || 0).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderProfileTab = () => (
    <div className="space-y-4 sm:space-y-6 max-w-4xl">
      {/* Basic Account Information */}
      <Card className="bg-white/10 backdrop-blur-lg border border-white/20">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-lg sm:text-xl text-white">Account Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6 pt-0">
          {/* School Name Field */}
          <div className="grid gap-2">
            <Label htmlFor="schoolName" data-testid="label-school-name" className="text-sm font-medium text-white">School Name</Label>
            <div className="flex items-center gap-2">
              {editingField === "schoolName" ? (
                <>
                  <Input
                    id="schoolName"
                    value={tempValues.schoolName}
                    onChange={(e) => setTempValues(prev => ({ ...prev, schoolName: e.target.value }))}
                    className="flex-1 h-10 sm:h-11 bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20"
                    data-testid="input-school-name-edit"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleConfirmSave("schoolName")}
                    disabled={isUpdatingProfile || tempValues.schoolName === profileForm.schoolName || !tempValues.schoolName.trim()}
                    data-testid="button-save-school-name"
                    className="h-10 w-10 sm:h-11 sm:w-11 flex-shrink-0 bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleCancelEdit("schoolName")}
                    disabled={isUpdatingProfile}
                    data-testid="button-cancel-school-name"
                    className="h-10 w-10 sm:h-11 sm:w-11 flex-shrink-0 bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <Input
                    id="schoolName"
                    value={profileForm.schoolName}
                    readOnly
                    className="flex-1 bg-gray-50 h-10 sm:h-11 bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20"
                    data-testid="input-school-name"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => startEditing("schoolName")}
                    data-testid="button-edit-school-name"
                    className="h-10 w-10 sm:h-11 sm:w-11 flex-shrink-0 touch-manipulation bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
            {school?.lastSchoolNameChange && (() => {
              const lastChange = new Date(school.lastSchoolNameChange);
              const now = new Date();
              const daysSinceLastChange = (now.getTime() - lastChange.getTime()) / (1000 * 60 * 60 * 24);
              const daysRemaining = Math.max(0, Math.ceil(30 - daysSinceLastChange));
              
              return daysRemaining > 0 ? (
                <p className="text-xs text-amber-200 mt-1 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  School name can be changed again in {daysRemaining} day{daysRemaining === 1 ? '' : 's'}
                </p>
              ) : null;
            })()}
            <p className="text-xs text-white/70 mt-1">
              School name can only be changed once every 30 days
            </p>
          </div>

          {/* Username Field */}
          <div className="grid gap-2">
            <Label htmlFor="username" data-testid="label-username" className="text-sm font-medium text-white">School Username</Label>
            <div className="flex items-center gap-2">
              {editingField === "username" ? (
                <>
                  <div className="flex-1">
                    <Input
                      id="username"
                      value={tempValues.username}
                      onChange={(e) => setTempValues(prev => ({ ...prev, username: e.target.value }))}
                      className="h-10 sm:h-11 bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20"
                      data-testid="input-username-edit"
                    />
                    {/* Real-time Username Availability Status */}
                    {tempValues.username && (
                      <div className="mt-2">
                        {isCheckingUsername ? (
                          <div className="flex items-center space-x-2 text-sm text-blue-200">
                            <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                            <span>Checking availability...</span>
                          </div>
                        ) : usernameAvailable === true ? (
                          <div className="flex items-center space-x-2 text-sm text-green-200 bg-green-500/20 backdrop-blur-lg border border-green-400/30 rounded-md p-2">
                            <CheckCircle className="h-4 w-4" />
                            <span>{usernameMessage}</span>
                          </div>
                        ) : usernameAvailable === false ? (
                          <div className="flex items-center space-x-2 text-sm text-red-200 bg-red-500/20 backdrop-blur-lg border border-red-400/30 rounded-md p-2">
                            <AlertCircle className="h-4 w-4" />
                            <span>{usernameMessage}</span>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleConfirmSave("username")}
                    disabled={isUpdatingProfile || !usernameAvailable || isCheckingUsername || tempValues.username === profileForm.username}
                    data-testid="button-save-username"
                    className="h-10 w-10 sm:h-11 sm:w-11 flex-shrink-0 bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleCancelEdit("username")}
                    disabled={isUpdatingProfile}
                    data-testid="button-cancel-username"
                    className="h-10 w-10 sm:h-11 sm:w-11 flex-shrink-0 bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20"
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
                    className="flex-1 bg-gray-50 h-10 sm:h-11 bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20"
                    data-testid="input-username"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => startEditing("username")}
                    data-testid="button-edit-username"
                    className="h-10 w-10 sm:h-11 sm:w-11 flex-shrink-0 touch-manipulation bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>

           {school?.username && (
             <div className="rounded-lg border border-white/10 bg-white/5 p-3">
               <Label className="text-sm font-medium text-white">Public Profile URL</Label>
               <div className="flex items-center gap-2 mt-2">
                 <a href={`/${school.username}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm text-cyan-300 hover:text-cyan-200">{window.location.origin}/{school.username}</a>
                 <Button size="icon" variant="ghost" onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/${school.username}`); toast({ title: "Profile URL copied" }); }} className="h-9 w-9 flex-shrink-0 border border-white/20 text-white" data-testid="button-copy-profile-url"><Copy className="h-4 w-4" /></Button>
               </div>
             </div>
           )}

          {/* School Logo */}
          <div className="grid gap-2">
            <Label className="text-sm font-medium text-white">School Logo</Label>
            <div className="flex items-center gap-4">
              {/* Current Logo Display */}
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                {school?.logo ? (
                  <img 
                    src={school.logo.startsWith('http') ? school.logo : (school.logo.startsWith('/') ? school.logo : `/${school.logo}`)}
                    alt="School logo"
                    className="w-full h-full object-cover"
                    style={{ aspectRatio: '1 / 1' }}
                  />
                ) : (
                  <Upload className="w-8 h-8 text-white" />
                )}
              </div>
              
              {/* Upload Input */}
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setSelectedImageFile(file);
                      setShowCropDialog(true);
                      // Clear the input so the same file can be selected again
                      e.target.value = '';
                    }
                  }}
                  className="w-full text-sm text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-white/10 file:text-white hover:file:bg-white/20 cursor-pointer"
                  data-testid="input-logo-upload"
                />
                <p className="text-xs text-white/70 mt-1">
                  Upload any image. You'll be able to crop and adjust it before saving.
                </p>
              </div>
            </div>
          </div>

          {/* School Banner */}
          <div className="grid gap-2">
            <Label className="text-sm font-medium text-white">School Banner (Profile Cover Photo)</Label>
            <div className="space-y-3">
              {/* Current Banner Display */}
              <div className="w-full h-32 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center overflow-hidden">
                {school?.coverPhoto ? (
                  <img 
                    src={school.coverPhoto.startsWith('http') ? school.coverPhoto : (school.coverPhoto.startsWith('/') ? school.coverPhoto : `/${school.coverPhoto}`)}
                    alt="School banner"
                    className="w-full h-full object-cover"
                    style={{ aspectRatio: '3 / 1' }}
                  />
                ) : (
                  <div className="text-center">
                    <Upload className="w-8 h-8 text-white mx-auto mb-2" />
                    <p className="text-xs text-white/80">No banner uploaded</p>
                  </div>
                )}
              </div>
              
              {/* Upload Input */}
              <div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setSelectedBannerFile(file);
                      setShowBannerCropDialog(true);
                      // Clear the input so the same file can be selected again
                      e.target.value = '';
                    }
                  }}
                  className="w-full text-sm text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-white/10 file:text-white hover:file:bg-white/20 cursor-pointer"
                  data-testid="input-banner-upload"
                />
                <p className="text-xs text-white/70 mt-1">
                  <strong>Required aspect ratio: 3:1 (1200x400 pixels minimum HD quality).</strong> You'll be able to crop and adjust it before saving.
                </p>
              </div>
            </div>
          </div>

            </CardContent>
       </Card>

       {/* School Details */}
       <Card className="bg-white/10 backdrop-blur-lg border border-white/20">
         <CardHeader className="p-4 sm:p-6">
           <CardTitle className="text-lg sm:text-xl text-white">School Details</CardTitle>
           <p className="text-sm text-blue-50">Manage the information shown on your public Yearbuk profile.</p>
         </CardHeader>
         <CardContent className="space-y-4 p-4 sm:p-6 pt-0">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {renderEditableSchoolField("email", "Public School Email", { type: "email", placeholder: "school@example.com" })}
             {renderEditableSchoolField("phoneNumber", "Public School Phone", { type: "tel", placeholder: "(234)8012345678" })}
             {renderEditableSchoolField("yearFounded", "Year Founded", { type: "number", min: 1000, max: new Date().getFullYear(), placeholder: "e.g. 1998" })}
             {renderEditableSchoolField("country", "Country", { placeholder: "Enter country" })}
             {renderEditableSchoolField("city", "City", { placeholder: "Enter city" })}
           </div>
         </CardContent>
       </Card>

      {/* Location & Website */}
      <Card className="bg-white/10 backdrop-blur-lg border border-white/20">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-lg sm:text-xl text-white">Location & Website</CardTitle>
          <p className="text-sm text-blue-50">Update the public location and website information.</p>
        </CardHeader>
        <CardContent className="space-y-4 p-4 sm:p-6 pt-0">
          <div className="grid gap-2">
            <Label htmlFor="website" data-testid="label-website" className="text-sm font-medium text-white">School Website (Optional)</Label>
            <div className="flex items-center gap-2">
              {editingField === "website" ? (
                <>
                  <Input
                    id="website"
                    type="url"
                    value={tempValues.website || ""}
                    onChange={(e) => setTempValues(prev => ({ ...prev, website: e.target.value }))}
                    className="flex-1 h-10 sm:h-11 bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20"
                    placeholder="https://www.yourschool.com"
                    data-testid="input-website-edit"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleConfirmSave("website")}
                    disabled={isUpdatingProfile}
                    data-testid="button-save-website"
                    className="h-10 w-10 sm:h-11 sm:w-11 flex-shrink-0 bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleCancelEdit("website")}
                    disabled={isUpdatingProfile}
                    data-testid="button-cancel-website"
                    className="h-10 w-10 sm:h-11 sm:w-11 flex-shrink-0 bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <Input
                    id="website"
                    value={school?.website || "Not provided"}
                    readOnly
                    className="flex-1 bg-gray-50 h-10 sm:h-11 bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20"
                    data-testid="input-website"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => startEditing("website")}
                    data-testid="button-edit-website"
                    className="h-10 w-10 sm:h-11 sm:w-11 flex-shrink-0 touch-manipulation bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="address" data-testid="label-address" className="text-sm font-medium text-white">School Address (Optional)</Label>
            <div className="flex items-start gap-2">
              {editingField === "address" ? (
                <>
                  <textarea
                    id="address"
                    value={tempValues.address || ""}
                    onChange={(e) => setTempValues(prev => ({ ...prev, address: e.target.value }))}
                    className="flex-1 min-h-[80px] p-2 border rounded-md text-sm resize-none bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20"
                    placeholder="Enter school address"
                    data-testid="textarea-address-edit"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleConfirmSave("address")}
                    disabled={isUpdatingProfile}
                    data-testid="button-save-address"
                    className="h-10 w-10 flex-shrink-0 mt-1 bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleCancelEdit("address")}
                    disabled={isUpdatingProfile}
                    data-testid="button-cancel-address"
                    className="h-10 w-10 flex-shrink-0 mt-1 bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <textarea
                    id="address"
                    value={school?.address || "Not provided"}
                    readOnly
                    className="flex-1 min-h-[80px] p-2 rounded-md text-sm resize-none bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20"
                    data-testid="textarea-address"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => startEditing("address")}
                    data-testid="button-edit-address"
                    className="h-10 w-10 flex-shrink-0 mt-1 touch-manipulation bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="state" data-testid="label-state" className="text-sm font-medium text-white">State/Province (Optional)</Label>
            <div className="flex items-center gap-2">
              {editingField === "state" ? (
                <>
                  <Input
                    id="state"
                    value={tempValues.state || ""}
                    onChange={(e) => setTempValues(prev => ({ ...prev, state: e.target.value }))}
                    className="flex-1 h-10 sm:h-11 bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20"
                    placeholder="Enter state or province"
                    data-testid="input-state-edit"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleConfirmSave("state")}
                    disabled={isUpdatingProfile}
                    data-testid="button-save-state"
                    className="h-10 w-10 sm:h-11 sm:w-11 flex-shrink-0 bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleCancelEdit("state")}
                    disabled={isUpdatingProfile}
                    data-testid="button-cancel-state"
                    className="h-10 w-10 sm:h-11 sm:w-11 flex-shrink-0 bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <Input
                    id="state"
                    value={school?.state || "Not provided"}
                    readOnly
                    className="flex-1 bg-gray-50 h-10 sm:h-11 bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20"
                    data-testid="input-state"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => startEditing("state")}
                    data-testid="button-edit-state"
                    className="h-10 w-10 sm:h-11 sm:w-11 flex-shrink-0 touch-manipulation bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Generate yearbook codes
  const generateCodes = async () => {
    if (!user?.schoolId) return;
    
    setIsGeneratingCodes(true);
    try {
      const response = await apiRequest("POST", "/api/yearbook-codes/create", {
        schoolId: user.schoolId,
        year: selectedYear,
        count: codeCount
      });
      
      const data = await response.json();
      
      if (data.codes) {
        setGeneratedCodes(data.codes);
        toast({
          className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
          title: "Codes Generated!",
          description: `Successfully generated ${codeCount} yearbook codes for ${selectedYear}`,
        });
        // Refresh existing codes
        queryClient.invalidateQueries({ queryKey: ["/api/yearbook-codes/school", user.schoolId] });
      } else {
        throw new Error(data.message || "Failed to generate codes");
      }
    } catch (error: any) {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Generation Failed",
        description: error.message || "Failed to generate codes",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingCodes(false);
    }
  };

  // Copy code to clipboard
  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast({
        className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Copied!",
        description: `Code ${code} copied to clipboard`,
      });
    } catch (err) {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Copy Failed",
        description: "Could not copy code to clipboard",
        variant: "destructive"
      });
    }
  };

  // Delete individual code
  const handleDeleteCode = async () => {
    if (!codeToDelete || !user?.id) return;
    
    setIsDeletingCode(true);
    try {
      await apiRequest("DELETE", `/api/yearbook-codes/${codeToDelete.id}`);
      
      toast({
        title: "Code deleted",
        description: `Code ${codeToDelete.code} has been deleted`,
      });
      
      // Refresh codes list
      queryClient.invalidateQueries({ queryKey: [`/api/yearbook-codes/school/${user.schoolId}`] });
      setCodeToDelete(null);
    } catch (error) {
      toast({
        title: "Failed to delete code",
        description: "Could not delete the code. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeletingCode(false);
    }
  };

  // Delete all codes for a year
  const handleDeleteAllCodes = async () => {
    if (!yearToDeleteAll || !user?.id || !user?.schoolId) return;
    
    setIsDeletingCode(true);
    try {
      await apiRequest("DELETE", `/api/yearbook-codes/school/${user.schoolId}/year/${yearToDeleteAll}`);
      
      toast({
        title: "All codes deleted",
        description: `All codes for year ${yearToDeleteAll} have been deleted`,
      });
      
      // Refresh codes list
      queryClient.invalidateQueries({ queryKey: [`/api/yearbook-codes/school/${user.schoolId}`] });
      setYearToDeleteAll(null);
    } catch (error) {
      toast({
        title: "Failed to delete codes",
        description: "Could not delete the codes. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeletingCode(false);
    }
  };

  const renderPaymentsTab = () => {
    // API responses should be arrays, but normalize defensively so a malformed
    // or unexpected response cannot crash the entire settings page.
    const purchaseHistory = Array.isArray(paymentHistory) ? paymentHistory : [];
    const revenueHistory = Array.isArray(salesHistory) ? salesHistory : [];

    const calculateTotal = (history: any[] = [], field: 'amount' = 'amount') => {
      if (!Array.isArray(history)) return 0;

      return history.reduce((sum, item) => {
        const amount = Number(item?.[field] ?? 0);
        return sum + (Number.isFinite(amount) ? amount : 0);
      }, 0);
    };

    // Helper to convert amount based on its currency
    const convertAmount = (amount: number, itemCurrency?: string) => {
      // If item is already in NGN, don't convert
      if (itemCurrency === 'NGN') {
        // If user wants USD, convert NGN to USD
        if (userCurrency === 'USD') {
          return amount / (1650); // Convert NGN to USD (approximate)
        }
        return amount; // Keep as NGN
      }
      // If item is in USD, use normal conversion
      return convertPrice(amount);
    };

    // Helper to format based on item's currency
    const formatAmount = (amount: number, itemCurrency?: string) => {
      if (itemCurrency === 'NGN') {
        // Item is in NGN
        if (userCurrency === 'USD') {
          return formatPrice(amount / 1650, 'USD'); // Convert and format as USD
        }
        return formatPrice(amount, 'NGN'); // Format as NGN
      }
      // Item is in USD, convert based on user preference
      return formatPrice(convertPrice(amount));
    };

    return (
      <div
        className={`space-y-4 sm:space-y-6 max-w-6xl ${BETA_VERSION ? 'pointer-events-none opacity-50 select-none' : ''}`}
        aria-disabled={BETA_VERSION}
      >
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-lg flex items-center text-white">
                <DollarSign className="h-5 w-5 mr-2 text-red-400" />
                Total Purchases
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="text-3xl font-bold text-white">
                {formatPrice(convertPrice(calculateTotal(purchaseHistory)))}
              </div>
              <p className="text-sm text-white/60 mt-1">
                Total amount spent on yearbook access
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-lg flex items-center text-white">
                <DollarSign className="h-5 w-5 mr-2 text-green-400" />
                Total Sales
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="text-3xl font-bold text-white">
                {(() => {
                  const total = calculateTotal(revenueHistory);
                  const currency = revenueHistory[0]?.currency;
                  return formatAmount(total, currency);
                })()}
              </div>
              <p className="text-sm text-white/60 mt-1">
                Revenue earned from viewer purchases
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Payment History */}
        <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-lg sm:text-xl flex items-center text-white">
              <Receipt className="h-5 w-5 mr-2 text-red-400" />
              Purchase History
            </CardTitle>
            <p className="text-sm text-white/70">
              Your yearbook access purchases
            </p>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            {loadingPayments ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-white" />
              </div>
            ) : purchaseHistory.length > 0 ? (
              <div className="space-y-3">
                {purchaseHistory.map((payment: any) => (
                  <div key={payment.id} className="bg-white/5 backdrop-blur-lg border border-white/20 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-white">{payment.description}</div>
                        <div className="text-sm text-white/60 mt-1">
                          {new Date(payment.date).toLocaleDateString()}
                        </div>
                        {payment.reference && (
                          <div className="text-xs text-white/50 mt-1">
                            Ref: {payment.reference}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-red-400">
                          -{formatPrice(convertPrice(payment.amount))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-white/60">
                <Receipt className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No purchase history</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sales History */}
        <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-lg sm:text-xl flex items-center text-white">
              <DollarSign className="h-5 w-5 mr-2 text-green-400" />
              Sales History
            </CardTitle>
            <p className="text-sm text-white/70">
              Revenue from viewer purchases
            </p>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            {loadingSales ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-white" />
              </div>
            ) : revenueHistory.length > 0 ? (
              <div className="space-y-3">
                {revenueHistory.map((sale: any) => (
                  <div key={sale.id} className="bg-white/5 backdrop-blur-lg border border-white/20 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-white">{sale.description}</div>
                        <div className="text-sm text-white/60 mt-1">
                          {new Date(sale.date).toLocaleDateString()}
                        </div>
                        {sale.buyerEmail && (
                          <div className="text-xs text-white/50 mt-1">
                            Buyer: {sale.buyerEmail}
                          </div>
                        )}
                        {sale.reference && (
                          <div className="text-xs text-white/50 mt-1">
                            Ref: {sale.reference}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-green-400">
                          +{formatAmount(sale.amount, sale.currency)}
                        </div>
                        <div className="text-xs text-white/50 mt-1">
                          Total: {formatAmount(sale.totalAmount, sale.currency)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-white/60">
                <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No sales history</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderCreateCodesTab = () => {
    return (
      <div
        className={`space-y-4 sm:space-y-6 max-w-4xl ${BETA_VERSION ? 'pointer-events-none opacity-50 select-none' : ''}`}
        aria-disabled={BETA_VERSION}
      >
        <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-lg sm:text-xl flex items-center text-white">
              <Key className="h-5 w-5 mr-2" />
              Generate Yearbook Access Codes
            </CardTitle>
            <p className="text-sm text-white/70">
              Create access codes that allow viewers to unlock yearbooks without payment. Perfect for alumni events, school promotions, or special access.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6 pt-0">
            <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
              {/* Year Selection */}
              <div className="space-y-2">
                <Label htmlFor="year-select" className="text-sm font-medium text-white">
                  Yearbook Year
                </Label>
                <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                  <SelectTrigger className="bg-white/10 backdrop-blur-lg border border-white/20 text-white" data-testid="select-yearbook-year">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent className="bg-blue-600/60 backdrop-blur-lg border border-white/20">
                    
                    <div className="max-h-60 overflow-y-auto">
                      {(() => {
                        const foundingYear = school?.yearFounded || 1980;
                        const years: number[] = [];
                        for (let year = CURRENT_YEAR; year >= foundingYear; year--) {
                          years.push(year);
                        }
                        
                        const filteredYears = yearSearchQuery 
                          ? years.filter(year => year.toString().includes(yearSearchQuery))
                          : years;
                        
                        return filteredYears.length > 0 ? (
                          filteredYears.map(year => (
                            <SelectItem key={year} value={year.toString()} className="text-white hover:bg-white/20">
                              {year}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="px-2 py-4 text-center text-white/60 text-sm">
                            No years found
                          </div>
                        );
                      })()}
                    </div>
                  </SelectContent>
                </Select>
              </div>

              {/* Code Count */}
              <div className="space-y-2">
                <Label htmlFor="code-count" className="text-sm font-medium text-white">
                  Number of Codes
                </Label>
                <Select 
                  value={isCustomCodeCount ? "custom" : codeCount.toString()} 
                  onValueChange={(value) => {
                    if (value === "custom") {
                      setIsCustomCodeCount(true);
                      setCustomCodeCount("");
                    } else {
                      setIsCustomCodeCount(false);
                      setCodeCount(parseInt(value));
                    }
                  }}
                >
                  <SelectTrigger className="bg-white/10 backdrop-blur-lg border border-white/20 text-white" data-testid="select-code-count">
                    <SelectValue placeholder="Select count" />
                  </SelectTrigger>
                  <SelectContent className="bg-blue-600/60 backdrop-blur-lg border border-white/20">
                    {[5, 10, 25, 50, 100].map(count => (
                      <SelectItem key={count} value={count.toString()} className="text-white hover:bg-white/20">
                        {count} codes
                      </SelectItem>
                    ))}
                    <SelectItem value="custom" className="text-white hover:bg-white/20">
                      Custom amount
                    </SelectItem>
                  </SelectContent>
                </Select>
                
                {/* Custom Code Count Input */}
                {isCustomCodeCount && (
                  <div className="space-y-2">
                    <Label htmlFor="custom-code-count" className="text-sm font-medium text-white">
                      Enter custom amount (1-100)
                    </Label>
                    <Input
                      id="custom-code-count"
                      type="number"
                      min="1"
                      max="100"
                      value={customCodeCount}
                      onChange={(e) => {
                        const value = e.target.value;
                        setCustomCodeCount(value);
                        const numValue = parseInt(value);
                        if (numValue >= 1 && numValue <= 100) {
                          setCodeCount(numValue);
                        }
                      }}
                      placeholder="Enter number (1-100)"
                      className="bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50"
                      data-testid="input-custom-code-count"
                    />
                  </div>
                )}
              </div>
            </div>

            <Button
              onClick={generateCodes}
              disabled={isGeneratingCodes}
              className="w-full sm:w-auto text-white hover:bg-white/20 backdrop-blur-lg border border-white/20 hover:text-white bg-green-500/60"
              data-testid="button-generate-codes"
            >
              {isGeneratingCodes ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Key className="h-4 w-4 mr-2" />
              )}
              {isGeneratingCodes ? "Generating..." : `Generate ${codeCount} Codes`}
            </Button>

            {/* Generated Codes Display */}
            {generatedCodes.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-white">Generated Codes ({generatedCodes.length})</h3>
                  <Button
                    className="text-black hover:bg-white/20 backdrop-blur-lg border border-white/20 hover:text-white"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const allCodes = generatedCodes.map(c => c.code).join('\n');
                      copyToClipboard(allCodes);
                    }}
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Copy All
                  </Button>
                </div>
                <div className="grid gap-3 max-h-96 overflow-y-auto">
                  {generatedCodes.map((codeData) => (
                    <div key={codeData.id || codeData.code} className="flex items-center justify-between bg-white/5 backdrop-blur-lg border border-white/20 rounded-lg p-4">
                      <code className="font-mono text-base font-bold text-blue-300" data-testid={`code-${codeData.id || codeData.code}`}>
                        {codeData.code}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(codeData.code)}
                        data-testid={`button-copy-${codeData.id || codeData.code}`}
                      >
                        <Copy className="h-4 w-4 text-white" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Existing Codes */}
        <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-lg sm:text-xl text-white">Previously Generated Codes</CardTitle>
            <p className="text-sm text-white/70">
              View and manage all previously generated access codes for your school.
            </p>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            {isLoadingCodes ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin mr-2 text-white" />
                <span className="text-white">Loading codes...</span>
              </div>
            ) : existingCodes && existingCodes.length > 0 ? (
              <div className="space-y-4">
                {/* Group codes by year */}
                {Object.entries(
                  existingCodes.reduce((acc: Record<number, YearbookCode[]>, code: YearbookCode) => {
                    if (!acc[code.year]) acc[code.year] = [];
                    acc[code.year].push(code);
                    return acc;
                  }, {})
                ).map(([year, codes]: [string, YearbookCode[]]) => (
                  <div key={year} className="bg-white/5 backdrop-blur-lg border border-white/20 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-white">Year {year}</h4>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-white/60">
                          {codes.filter((c: YearbookCode) => c.isUsed).length}/{codes.length} used
                        </span>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setYearToDeleteAll(parseInt(year))}
                          data-testid={`button-delete-all-${year}`}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete All
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-3 max-h-96 overflow-y-auto">
                      {codes.map((code: YearbookCode) => (
                        <div
                          key={code.id}
                          className={`flex items-center justify-between p-4 rounded-lg ${
                            code.isUsed 
                              ? 'bg-red-500/20 backdrop-blur-lg border border-red-400/30' 
                              : 'bg-green-500/20 backdrop-blur-lg border border-green-400/30'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <code className="font-mono text-base font-bold text-white">
                              {code.code}
                            </code>
                            <span className={`text-xs px-2 py-1 rounded ${
                              code.isUsed 
                                ? 'bg-red-500/30 text-red-200' 
                                : 'bg-green-500/30 text-green-200'
                            }`}>
                              {code.isUsed ? 'Used' : 'Available'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {!code.isUsed && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(code.code)}
                                data-testid={`button-copy-${code.id}`}
                              >
                                <Copy className="h-4 w-4 text-white" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setCodeToDelete(code)}
                              data-testid={`button-delete-${code.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-red-400" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-white/60">
                <Key className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No codes generated yet</p>
                <p className="text-sm">Generate some codes above to get started</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };


  const openTwoFactorToggleDialog = (enabled: boolean) => {
    setPendingTwoFactorEnabled(enabled);
    setShowSecurityTwoFactorConfirmDialog(true);
  };

  const requestTwoFactorToggle = async () => {
    setIsRequestingTwoFactor(true);
    try {
      await apiRequest("POST", "/api/auth/request-2fa-toggle", {
        enabled: pendingTwoFactorEnabled,
      });
      setShowSecurityTwoFactorConfirmDialog(false);
      setSecurityTwoFactorCode("");
      setShowSecurityTwoFactorDialog(true);
      toast({
        title: "Verification code sent",
        description: "Check your email for the 6-digit verification code.",
      });
    } catch (error: any) {
      toast({
        title: "Could not send verification code",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRequestingTwoFactor(false);
    }
  };

  const resendTwoFactorToggleCode = async () => {
    setIsRequestingTwoFactor(true);
    try {
      await apiRequest("POST", "/api/auth/request-2fa-toggle", {
        enabled: pendingTwoFactorEnabled,
      });
      toast({
        title: "Verification code resent",
        description: "Check your email for the new 6-digit code.",
      });
    } catch (error: any) {
      toast({
        title: "Could not resend verification code",
        description: error?.message || "Please wait a moment and try again.",
        variant: "destructive",
      });
    } finally {
      setIsRequestingTwoFactor(false);
    }
  };

  const verifyTwoFactorToggle = async () => {
    setIsVerifyingTwoFactor(true);
    try {
      const response = await apiRequest("POST", "/api/auth/verify-2fa-toggle", {
        enabled: pendingTwoFactorEnabled,
        code: securityTwoFactorCode,
      });
      const data = await response.json();
      setTwoFactorEnabled(pendingTwoFactorEnabled);
      setShowSecurityTwoFactorDialog(false);
      setSecurityTwoFactorCode("");
      toast({
        title: pendingTwoFactorEnabled ? "2FA enabled" : "2FA disabled",
        description: data?.message || "Your security setting was updated. Please sign in again.",
      });
      localStorage.removeItem("user");
      window.dispatchEvent(new Event("userChanged"));
      setLocation("/home");
    } catch (error: any) {
      toast({
        title: "Verification failed",
        description: error?.message || "The code was invalid or expired.",
        variant: "destructive",
      });
    } finally {
      setIsVerifyingTwoFactor(false);
    }
  };

  const renderSecurityTab = () => {
    const account = accountUser || user;
    const emailVerified = Boolean(account?.isEmailVerified);
    return (
      <div className="space-y-4 sm:space-y-6 max-w-4xl">
        <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
          <CardHeader className="p-4 sm:p-6"><CardTitle className="text-lg sm:text-xl text-white">Password</CardTitle></CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <p className="text-sm text-white/70 mb-3">Use the existing secure password reset flow to change your password.</p>
            <PasswordChangeDialog />
          </CardContent>
        </Card>

        <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
          <CardHeader className="p-4 sm:p-6"><CardTitle className="text-lg sm:text-xl flex items-center text-white"><Shield className="h-5 w-5 mr-2 text-purple-400" />Two-Factor Authentication</CardTitle></CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 space-y-3">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div><p className="text-white font-medium">{twoFactorEnabled ? "Enabled" : "Disabled"}</p><p className="text-sm text-white/60">{twoFactorEnabled ? "A verification code is required at login." : "Add an extra layer of security with email-based authentication at login."}</p></div>
              <Button onClick={() => openTwoFactorToggleDialog(!twoFactorEnabled)} disabled={isRequestingTwoFactor} className="bg-blue-600/60 border border-white/20 text-white" data-testid="button-toggle-account-2fa">{isRequestingTwoFactor ? "Sending..." : twoFactorEnabled ? "Disable 2FA" : "Enable 2FA"}</Button>
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
      case "display":
      case "revenue":
      case "payments":
        return renderRevenueTab();
      case "codes":
        return renderCreateCodesTab();
      case "security":
        return renderSecurityTab();
      default:
        return renderProfileTab();
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 relative overflow-hidden">
      {/* Animated Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-20 left-20 w-32 h-32 bg-white rounded-full opacity-20 animate-float"></div>
          <div className="absolute top-60 right-40 w-24 h-24 bg-white rounded-full opacity-20 animate-float-delayed"></div>
          <div className="absolute bottom-40 left-40 w-20 h-20 bg-white rounded-full opacity-20 animate-float"></div>
          <div className="absolute bottom-20 right-20 w-16 h-16 bg-white rounded-full opacity-20 animate-float-delayed"></div>
        </div>
      </div>
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white/10 backdrop-blur-lg border-b border-white/20 shadow-2xl relative">
        <div className="flex items-center justify-between p-3 sm:p-4 relative z-10">
          <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 flex-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateBack(setLocation, "/school-dashboard")}
              className="text-white hover:bg-white/20 flex-shrink-0"
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            
            {/* Mobile sidebar toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSidebar(!showSidebar)}
              className="text-white hover:bg-white/20 lg:hidden flex-shrink-0"
              data-testid="button-sidebar-toggle"
            >
              <MenuIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            
            <h1 className="text-lg sm:text-xl font-semibold text-white truncate">School Settings</h1>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0">
            <span className="text-xs sm:text-sm font-medium text-white truncate max-w-24 sm:max-w-none" data-testid="text-user-name">
              <span className="hidden sm:inline">{school?.name || user.fullName || user.username}</span>
              <span className="sm:hidden">{(school?.name || user.fullName || user.username)?.split(" ")[0]}</span>
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
                size="icon"
                onClick={() => setShowHamburgerMenu(!showHamburgerMenu)}
                className="text-white hover:bg-white/20 w-8 h-8 sm:w-10 sm:h-10"
                data-testid="button-hamburger-menu"
              >
                <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>

              {showHamburgerMenu && (
                <div className="hamburger-dropdown fixed top-16 right-4 w-48 bg-blue-950/95 backdrop-blur-lg border border-white/20 rounded-lg shadow-xl z-[999999]">
                  <div className="py-1">
                    <button
                      className="flex items-center w-full px-3 sm:px-4 py-2 text-sm text-white hover:bg-white/10 transition-colors"
                      onClick={() => {
                        setShowHamburgerMenu(false);
                        setLocation("/school-dashboard");
                      }}
                      data-testid="menu-home"
                    >
                      <Home className="h-4 w-4 mr-2 sm:mr-3" />
                      Home
                    </button>
                    <button
                      className="flex items-center w-full px-3 sm:px-4 py-2 text-sm text-white hover:bg-white/10 transition-colors"
                      onClick={() => {
                        setShowHamburgerMenu(false);
                        setLocation("/school-settings");
                      }}
                      data-testid="menu-settings"
                    >
                      <Settings className="h-4 w-4 mr-2 sm:mr-3" />
                      Settings
                    </button>
                    <button
                      className="flex items-center w-full px-3 sm:px-4 py-2 text-sm text-white hover:bg-white/10 transition-colors"
                      onClick={() => {
                        setShowHamburgerMenu(false);
                        navigateWithTracking(setLocation, "/cart");
                      }}
                      data-testid="menu-cart"
                    >
                      <ShoppingCart className="h-4 w-4 mr-2 sm:mr-3" />
                      Cart
                    </button>
                    <div className="border-t border-gray-100"></div>
                    <button
                      className="flex items-center w-full px-3 sm:px-4 py-2 text-sm text-red-500 hover:bg-red-500/40 transition-colors"
                      onClick={() => {
                        setShowHamburgerMenu(false);
                        handleLogout();
                      }}
                      data-testid="menu-logout"
                    >
                      <LogOut className="h-4 w-4 mr-2 sm:mr-3" />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Notification Dropdown */}
      {showNotifications && (
        <div className="notification-dropdown fixed top-16 right-16 w-72 sm:w-80 max-w-[calc(100vw-2rem)] bg-blue-950/95 backdrop-blur-lg rounded-lg shadow-xl border border-white/20 z-[999999]">
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

      {/* Mobile Sidebar Overlay */}
      {showSidebar && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setShowSidebar(false)}
        />
      )}

      <div className="flex">
        {/* Left Sidebar - Desktop */}
        <div className="hidden lg:block w-64 min-h-screen bg-white/10 backdrop-blur-lg border-r border-white/20 shadow-xl overflow-y-auto">
          <div className="p-4 space-y-6">
            {/* Account Section */}
            <div>
              <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2 px-3">Account</h3>
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
                  School Profile
                </button>
                
              </nav>
            </div>

            {/* Billing Section */}
            <div className={BETA_VERSION ? 'pointer-events-none opacity-50 select-none' : ''}>
              <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2 px-3">Billing</h3>
              <nav className="space-y-1">
                
                <button
                  onClick={() => setActiveTab("revenue")}
                  className={`flex items-center w-full px-3 py-2 text-sm rounded-md transition-colors ${
                    activeTab === "revenue"
                      ? "bg-white/20 text-white font-medium"
                      : "text-white/70 hover:text-white hover:bg-white/10"
                  }`}
                  data-testid="tab-revenue"
                >
                  <CreditCard className="h-4 w-4 mr-2 flex-shrink-0" />
                  Payments & Revenue
                </button>
                
              </nav>
            </div>

            {/* Management Section */}
            <div>
              <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2 px-3">Management</h3>
              <nav className="space-y-1">
                <button
                  onClick={() => setActiveTab("codes")}
                  className={`flex items-center w-full px-3 py-2 text-sm rounded-md transition-colors ${
                    activeTab === "codes"
                      ? "bg-white/20 text-white font-medium"
                      : "text-white/70 hover:text-white hover:bg-white/10"
                  }`}
                  data-testid="tab-codes"
                >
                  <Key className="h-4 w-4 mr-2 flex-shrink-0" />
                  Create Codes
                </button>
              </nav>
            </div>

            {/* Security Section */}
            <div>
              <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2 px-3">Security</h3>
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
                  Security
                </button>
              </nav>
            </div>
          </div>
        </div>

        {/* Mobile Sidebar */}
        <div className={`fixed top-0 left-0 h-full w-64 bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out overflow-y-auto lg:hidden ${
          showSidebar ? 'translate-x-0' : '-translate-x-full'
        }`}>
          <div className="p-4 pt-20 space-y-6">
            {/* Account Section */}
            <div>
              <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2 px-3">Account</h3>
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
                  School Profile
                </button>
                
              </nav>
            </div>

            {/* Billing Section */}
            <div className={BETA_VERSION ? 'pointer-events-none opacity-50 select-none' : ''}>
              <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2 px-3">Billing</h3>
              <nav className="space-y-1">
                
                <button
                  onClick={() => {
                    setActiveTab("revenue");
                    setShowSidebar(false);
                  }}
                  className={`flex items-center w-full px-3 py-3 text-sm rounded-md transition-colors touch-manipulation ${
                    activeTab === "revenue"
                      ? "bg-white/20 text-white font-medium"
                      : "text-white/70 hover:text-white hover:bg-white/10"
                  }`}
                  data-testid="tab-revenue-mobile"
                >
                  <CreditCard className="h-5 w-5 mr-3 flex-shrink-0" />
                  Payments & Revenue
                </button>
                
              </nav>
            </div>

            {/* Management Section */}
            <div>
              <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2 px-3">Management</h3>
              <nav className="space-y-1">
                <button
                  onClick={() => {
                    setActiveTab("codes");
                    setShowSidebar(false);
                  }}
                  className={`flex items-center w-full px-3 py-3 text-sm rounded-md transition-colors touch-manipulation ${
                    activeTab === "codes"
                      ? "bg-white/20 text-white font-medium"
                      : "text-white/70 hover:text-white hover:bg-white/10"
                  }`}
                  data-testid="tab-codes-mobile"
                >
                  <Key className="h-5 w-5 mr-3 flex-shrink-0" />
                  Create Codes
                </button>
              </nav>
            </div>

            {/* Security Section */}
            <div>
              <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2 px-3">Security</h3>
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
                  Security
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

      {/* Image Crop Dialog for Logo */}
      <ImageCropDialog
        isOpen={showCropDialog}
        onClose={() => {
          setShowCropDialog(false);
          setSelectedImageFile(null);
        }}
        imageFile={selectedImageFile}
        onSave={handleCroppedLogoSave}
      />

      {/* Image Crop Dialog for Banner */}
      <ImageCropDialog
        isOpen={showBannerCropDialog}
        onClose={() => {
          setShowBannerCropDialog(false);
          setSelectedBannerFile(null);
        }}
        imageFile={selectedBannerFile}
        onSave={handleCroppedBannerSave}
        aspectRatio={3}
        minWidth={1200}
        minHeight={400}
      />

      {/* Delete Single Code Confirmation Dialog */}
      <AlertDialog open={!!codeToDelete} onOpenChange={(open) => !open && setCodeToDelete(null)}>
        <AlertDialogContent className="bg-slate-900 border-white/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Are you sure you want to delete this access code?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/70">
              This action cannot be undone. Code <span className="font-mono font-bold text-blue-300">{codeToDelete?.code}</span> will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              className="bg-white/10 text-white border-white/20 hover:bg-white/20"
              disabled={isDeletingCode}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCode}
              disabled={isDeletingCode}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {isDeletingCode ? "Deleting..." : "Delete Code"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete All Codes Confirmation Dialog */}
      <AlertDialog open={!!yearToDeleteAll} onOpenChange={(open) => !open && setYearToDeleteAll(null)}>
        <AlertDialogContent className="bg-slate-900 border-white/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Are you sure you want to delete all access codes?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/70">
              This action cannot be undone. All codes for year <span className="font-bold text-blue-300">{yearToDeleteAll}</span> will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              className="bg-white/10 text-white border-white/20 hover:bg-white/20"
              disabled={isDeletingCode}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAllCodes}
              disabled={isDeletingCode}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {isDeletingCode ? "Deleting..." : "Delete All Codes"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Username Change Confirmation Dialog */}
      <AlertDialog open={showUsernameConfirm} onOpenChange={() => {}}>
        <AlertDialogContent className="bg-gradient-to-br from-blue-900/95 to-purple-900/95 backdrop-blur-lg border border-white/20 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Confirm Username Change</AlertDialogTitle>
            <AlertDialogDescription className="text-white/80">
              Are you sure you want to change your school username from <span className="font-bold text-blue-300">"{profileForm.username}"</span> to <span className="font-bold text-green-300">"{tempValues.username}"</span>?
              <div className="mt-2 text-amber-200">
                <Clock className="h-4 w-4 inline mr-1" />
                This username controls the school's public profile URL.
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setShowUsernameConfirm(false);
                handleCancelEdit("username");
              }}
              disabled={isUpdatingProfile}
              className="bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white hover:bg-red-700 hover:border-white/40 hover:text-white transition-all duration-200 ease-in-out hover:shadow-lg transition-all duration-200 ease-in-out hover:shadow-lg transition-all duration-200 ease-in-out hover:shadow-lg transition-all duration-200 ease-in-out"
              data-testid="button-cancel-username-confirm"
            >
              Cancel
            </Button>
            <Button
              onClick={() => performSave("username")}
              disabled={isUpdatingProfile}
              className="bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white hover:bg-blue-700 hover:border-white/40 hover:text-white transition-all duration-200 ease-in-out hover:shadow-lg transition-all duration-200 ease-in-out hover:shadow-lg transition-all duration-200 ease-in-out hover:shadow-lg transition-all duration-200 ease-in-out"
              data-testid="button-confirm-username-change"
            >
              {isUpdatingProfile ? "Saving..." : "Confirm Change"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* School Name Change Confirmation Dialog */}
      <AlertDialog open={showSchoolNameConfirm} onOpenChange={() => {}}>
        <AlertDialogContent className="bg-gradient-to-br from-blue-900/95 to-purple-900/95 backdrop-blur-lg border border-white/20 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Confirm School Name Change</AlertDialogTitle>
            <AlertDialogDescription className="text-white/80">
              Are you sure you want to change your school name from <span className="font-bold text-blue-300">"{profileForm.schoolName}"</span> to <span className="font-bold text-green-300">"{tempValues.schoolName}"</span>?
              <div className="mt-2 text-amber-200">
                <Clock className="h-4 w-4 inline mr-1" />
                Note: School name can only be changed once every 30 days.
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setShowSchoolNameConfirm(false);
                handleCancelEdit("schoolName");
              }}
              disabled={isUpdatingProfile}
              className="bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white hover:bg-red-700 hover:border-white/40 hover:text-white transition-all duration-200 ease-in-out hover:shadow-lg transition-all duration-200 ease-in-out hover:shadow-lg transition-all duration-200 ease-in-out hover:shadow-lg transition-all duration-200 ease-in-out"
              data-testid="button-cancel-school-name-confirm"
            >
              Cancel
            </Button>
            <Button
              onClick={() => performSave("schoolName")}
              disabled={isUpdatingProfile}
              className="bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white hover:bg-blue-700 hover:border-white/40 hover:text-white transition-all duration-200 ease-in-out hover:shadow-lg transition-all duration-200 ease-in-out hover:shadow-lg transition-all duration-200 ease-in-out hover:shadow-lg transition-all duration-200 ease-in-out"
              data-testid="button-confirm-school-name-change"
            >
              {isUpdatingProfile ? "Saving..." : "Confirm Change"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 2FA confirmation dialog */}
      <AlertDialog open={showSecurityTwoFactorConfirmDialog} onOpenChange={(open) => { if (!open && !isRequestingTwoFactor) setShowSecurityTwoFactorConfirmDialog(false); }}>
        <AlertDialogContent className="bg-gradient-to-br from-blue-900/95 to-purple-900/95 backdrop-blur-lg border border-white/20 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Confirm {pendingTwoFactorEnabled ? "Enable" : "Disable"} 2FA</AlertDialogTitle>
            <AlertDialogDescription className="text-white/80">
              A verification code will be sent to your mailbox.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRequestingTwoFactor} className="bg-white/10 border-white/20 text-white hover:bg-white/20">Cancel</AlertDialogCancel>
            <Button onClick={requestTwoFactorToggle} disabled={isRequestingTwoFactor} className="bg-blue-600/60 border border-white/20 text-white" data-testid="button-send-2fa-code">
              {isRequestingTwoFactor ? "Sending..." : "Send code"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 2FA verification dialog */}
      <AlertDialog open={showSecurityTwoFactorDialog} onOpenChange={(open) => { if (!open && !isVerifyingTwoFactor) { setShowSecurityTwoFactorDialog(false); setSecurityTwoFactorCode(""); } }}>
        <AlertDialogContent className="bg-gradient-to-br from-blue-900/95 to-purple-900/95 backdrop-blur-lg border border-white/20 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Enter verification code</AlertDialogTitle>
            <AlertDialogDescription className="text-white/80">
              Enter the 6-digit code sent to your mailbox. You will be signed out of all devices after verification.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="security-two-factor-code" className="text-white">Verification code</Label>
            <Input id="security-two-factor-code" value={securityTwoFactorCode} onChange={(e) => setSecurityTwoFactorCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" maxLength={6} placeholder="000000" className="h-12 text-center text-xl tracking-[0.5em] bg-white/10 border border-white/20 text-white" data-testid="input-security-2fa-code" autoFocus />
            <Button type="button" variant="ghost" onClick={resendTwoFactorToggleCode} disabled={isRequestingTwoFactor || isVerifyingTwoFactor} className="w-full text-blue-200 hover:text-white" data-testid="button-resend-security-2fa-code">
              {isRequestingTwoFactor ? "Sending..." : "Resend code"}
            </Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isVerifyingTwoFactor} className="bg-white/10 border-white/20 text-white hover:bg-white/20">Cancel</AlertDialogCancel>
            <Button onClick={verifyTwoFactorToggle} disabled={isVerifyingTwoFactor || securityTwoFactorCode.length !== 6} className="bg-blue-600/60 border border-white/20 text-white" data-testid="button-verify-security-2fa">
              {isVerifyingTwoFactor ? "Verifying..." : "Verify and log out"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}