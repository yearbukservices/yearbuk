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
import { ArrowLeft, User, ShoppingCart, Bell, Settings, Menu, Eye, EyeOff, Edit, Check, X, LogOut, MenuIcon, Home, DollarSign, Building2, CheckCircle, AlertCircle, CreditCard, Monitor, Key, Copy, RefreshCw, Search, Upload, Receipt, Shield, Smartphone, MapPin, Clock, Trash2 } from "lucide-react";
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
  name: string;
  yearFounded?: number;
  country?: string;
  city?: string;
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

  // Update profile form when school data is loaded
  useEffect(() => {
    if (school) {
      setProfileForm(prev => ({
        ...prev,
        schoolName: school.name || "",
        website: school.website || "",
        address: school.address || "",
        state: school.state || ""
      }));
    }
  }, [school]);

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
    enabled: !!school?.id && !!user?.id && activeTab === "payments",
  });

  // Fetch sales history (for payments tab)
  const { data: salesHistory = [], isLoading: loadingSales } = useQuery<any[]>({
    queryKey: ["/api/schools", school?.id, "sales-history"],
    enabled: !!school?.id && !!user?.id && activeTab === "payments",
  });

  // Fetch login activity (for security tab)
  const { data: loginActivity = [], isLoading: loadingLoginActivity } = useQuery<any[]>({
    queryKey: ["/api/users", user?.id, "login-activity"],
    enabled: !!user?.id && activeTab === "security",
  });

  // Fetch most recent login (for security tab)
  const { data: recentLogin, isLoading: loadingRecentLogin } = useQuery<any>({
    queryKey: ["/api/users", user?.id, "recent-login"],
    enabled: !!user?.id && activeTab === "security",
  });

  const renderDisplayTab = () => {
    return (
      <div className="space-y-4 sm:space-y-6 max-w-4xl">
        <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-lg sm:text-xl text-white">Display Preferences</CardTitle>
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
                  Choose how prices are displayed throughout the application. All transactions are processed in USD.
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
    const isAlreadySetup = school?.paystackSubaccountCode && school?.subaccountStatus === 'active';

    return (
      <div className="space-y-4 sm:space-y-6 max-w-4xl">
        {isAlreadySetup && !isChangingAccount ? (
          <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center text-green-400">
                <CheckCircle className="h-5 w-5 mr-2" />
                Revenue Sharing Active
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="space-y-4">
                <div className="bg-green-500/20 backdrop-blur-lg border border-green-400/30 rounded-lg p-4">
                  <h3 className="font-medium text-green-100 mb-2">Your revenue sharing is successfully configured!</h3>
                  <div className="text-sm text-green-200 space-y-1">
                    <p><strong>Revenue Share:</strong> You receive {school?.revenueSharePercentage || 80}% of all yearbook sales</p>
                    <p><strong>Bank Account:</strong> ****{school?.bankAccountNumber?.slice(-4)}</p>
                    <p><strong>Status:</strong> Active and ready to receive payments</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 text-sm text-white/70">
                  <Building2 className="h-4 w-4 mt-1 text-blue-400" />
                  <div>
                    <p className="font-medium text-white">How it works:</p>
                    <ul className="list-disc list-inside space-y-1 mt-1">
                      <li>When viewers purchase yearbooks, 80% goes directly to your bank account</li>
                      <li>Payments are processed automatically through Paystack</li>
                      <li>You'll receive settlements according to Paystack's schedule</li>
                    </ul>
                  </div>
                </div>
                <div className="pt-4 border-t">
                  <Button 
                    onClick={handleChangeAccount}
                    variant="outline"
                    className="w-full sm:w-auto text-black hover:bg-white/20 backdrop-blur-lg border border-white/20 hover:text-white"
                    data-testid="button-change-account"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Change Bank Account
                  </Button>
                  <p className="text-xs text-white/60 mt-2">
                    Need to update your bank account? Click above to change your payment details.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card
            className={`bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl ${BETA_VERSION ? 'pointer-events-none opacity-50 select-none' : ''}`}
            aria-disabled={BETA_VERSION}
          >
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center text-white">
                <CreditCard className="h-5 w-5 mr-2" />
                {isChangingAccount ? "Change Bank Account" : "Set Up Revenue Sharing"}
              </CardTitle>
              <p className="text-sm text-white/70">
                {isChangingAccount 
                  ? "Update your bank account details for receiving revenue payments." 
                  : "Configure your bank account to automatically receive 80% of yearbook sales revenue."
                }
              </p>
              {isChangingAccount && (
                <div className="flex items-center space-x-2 mt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsChangingAccount(false)}
                    data-testid="button-cancel-change"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="mb-6">
                <div className="bg-blue-500/20 backdrop-blur-lg border border-blue-400/30 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <AlertCircle className="h-5 w-5 text-blue-400 mt-0.5" />
                    <div className="text-sm text-blue-200">
                      <p className="font-medium mb-1 text-white">Revenue Split Details:</p>
                      <ul className="space-y-1">
                        <li>• <strong>Your school receives:</strong> 80% of every yearbook sale</li>
                        <li>• <strong>Platform fee:</strong> 20% (covers processing, hosting, and maintenance)</li>
                        <li>• <strong>Payment processor:</strong> Paystack (secure and reliable)</li>
                        <li>• <strong>Settlement:</strong> Automatic transfer to your bank account</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <form onSubmit={handleRevenueSubmit} className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-white">Select Bank</Label><Label className="text-sm font-medium text-red-500"> *</Label>
                    <div className="relative mt-1" ref={bankDropdownRef}>
                      <div
                        className="flex items-center w-full px-3 py-2 bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20 rounded-md cursor-pointer hover:border-white/40"
                        onClick={() => setShowBankDropdown(!showBankDropdown)}
                        data-testid="select-bank"
                      >
                        <Search className="w-4 h-4 text-gray-400 mr-2" />
                        <input
                          type="text"
                          value={bankSearchQuery}
                          onChange={(e) => setBankSearchQuery(e.target.value)}
                          placeholder="Search for your bank..."
                          className="flex-1 outline-none bg-transparent"
                          onFocus={() => setShowBankDropdown(true)}
                        />
                      </div>
                      
                      {showBankDropdown && (
                        <div className="absolute z-10 w-full mt-1 bg-blue-700/100 backdrop-blur-lg border border-white/20 text-white max-h-60 overflow-auto">
                          {banksData?.data
                            ?.filter((bank) => 
                              bank.name.toLowerCase().includes(bankSearchQuery.toLowerCase())
                            )
                            ?.map((bank) => (
                              <div
                                key={bank.code}
                                className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-white"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setSelectedBankCode(bank.code);
                                  setSelectedBankName(bank.name);
                                  setBankSearchQuery(bank.name);
                                  setShowBankDropdown(false);
                                }}
                                data-testid={`bank-option-${bank.code}`}
                              >
                                {bank.name}
                              </div>
                            )) || []}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="accountNumber" className="text-white" data-testid="label-account-number">Account Number</Label>
                    <Input
                      id="accountNumber"
                      type="text"
                      value={bankAccountNumber}
                      onChange={(e) => setBankAccountNumber(e.target.value.replace(/\D/g, ''))}
                      placeholder="Enter your 10-digit account number"
                      maxLength={10}
                      className="bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50"
                      data-testid="input-account-number"
                    />
                    
                    {/* Real-time Account Verification Preview */}
                    {bankAccountNumber && selectedBankCode && (
                      <div className="mt-2">
                        {isVerifyingAccount ? (
                          <div className="flex items-center space-x-2 text-sm text-blue-600">
                            <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                            <span>Verifying account...</span>
                          </div>
                        ) : accountHolderName ? (
                          <div className="flex items-center space-x-2 text-sm text-green-200 bg-green-500/20 backdrop-blur-lg border border-green-400/30 rounded-md p-2">
                            <CheckCircle className="h-4 w-4" />
                            <span><strong>Account Holder:</strong> {accountHolderName}</span>
                          </div>
                        ) : verificationError ? (
                          <div className="flex items-center space-x-2 text-sm text-red-200 bg-red-500/20 backdrop-blur-lg border border-red-400/30 rounded-md p-2">
                            <AlertCircle className="h-4 w-4" />
                            <span>{verificationError}</span>
                          </div>
                        ) : null}
                      </div>
                    )}
                    
                    <p className="text-xs text-white/60 mt-1">
                      {accountHolderName 
                        ? "Account verified! You can proceed with the setup." 
                        : "This will be verified with your bank in real-time."
                      }
                    </p>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={
                    (isChangingAccount ? updateAccountMutation.isPending : createSubaccountMutation.isPending) || 
                    !bankAccountNumber || 
                    !selectedBankCode ||
                    !accountHolderName
                  }
                  className="w-full"
                  data-testid={isChangingAccount ? "button-update-account" : "button-setup-revenue-sharing"}
                >
                  {isChangingAccount
                    ? (updateAccountMutation.isPending ? "Updating Account..." : "Update Bank Account")
                    : (createSubaccountMutation.isPending ? "Setting up..." : "Set Up Revenue Sharing")
                  }
                </Button>
              </form>

              <div className="mt-6 text-xs text-gray-500">
                <p>
                  By setting up revenue sharing, you agree to receive payments through Paystack.
                  Your bank details will be securely stored and used only for payment processing.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* 2FA Verification Dialog */}
        <AlertDialog open={show2FADialog} onOpenChange={setShow2FADialog}>
          <AlertDialogContent className="bg-gradient-to-br from-blue-900/95 to-purple-900/95 backdrop-blur-lg border border-white/20 shadow-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center text-white">
                <Shield className="h-5 w-5 mr-2 text-blue-400" />
                Two-Factor Authentication Required
              </AlertDialogTitle>
              <AlertDialogDescription className="text-white/80">
                For security purposes, please enter the 6-digit verification code sent to your email to confirm this bank account change.
              </AlertDialogDescription>
            </AlertDialogHeader>
            
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="twoFactorCode" className="text-white">Verification Code</Label>
                <Input
                  id="twoFactorCode"
                  type="text"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  className="mt-1 bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50"
                  data-testid="input-2fa-code"
                />
                <p className="text-xs text-white/60 mt-1">
                  The code will expire in 5 minutes
                </p>
              </div>
              
              {!canResend2FA && resendCooldown > 0 && (
                <div className="flex items-center space-x-2 text-sm text-white/70">
                  <Clock className="h-4 w-4" />
                  <span>Resend code in {resendCooldown}s</span>
                </div>
              )}
            </div>
            
            <AlertDialogFooter>
              {canResend2FA && (
                <Button
                  variant="outline"
                  onClick={send2FACode}
                  disabled={isSending2FA}
                  className="text-white border-white/20 hover:bg-white/10"
                  data-testid="button-resend-2fa"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isSending2FA ? 'animate-spin' : ''}`} />
                  Resend Code
                </Button>
              )}
              <AlertDialogCancel 
                className="text-white border-white/20 hover:bg-white/10"
                data-testid="button-cancel-2fa"
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={verify2FACode}
                disabled={isVerifying2FA || twoFactorCode.length !== 6}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                data-testid="button-verify-2fa"
              >
                {isVerifying2FA ? "Verifying..." : "Verify Code"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  };

  const handleBackClick = () => {
    navigateBack(setLocation);
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    window.dispatchEvent(new Event('userChanged'));
    setLocation("/home");
  };

  // Real-time bank verification for preview
  const verifyBankAccount = async (accountNumber: string, bankCode: string) => {
    if (!accountNumber || accountNumber.length !== 10 || !bankCode) {
      setAccountHolderName("");
      setVerificationError("");
      return;
    }

    setIsVerifyingAccount(true);
    setVerificationError("");

    try {
      const response = await apiRequest("POST", "/api/banks/verify-preview", {
        accountNumber,
        bankCode
      });
      
      const result = await response.json();
      
      if (result.status) {
        setAccountHolderName(result.data.account_name);
        setVerificationError("");
      } else {
        setAccountHolderName("");
        setVerificationError(result.message || "Unable to verify account");
      }
    } catch (error) {
      setAccountHolderName("");
      setVerificationError("Error verifying account. Please try again.");
    } finally {
      setIsVerifyingAccount(false);
    }
  };

  // Create subaccount mutation
  const createSubaccountMutation = useMutation({
    mutationFn: async (data: { bankAccountNumber: string; bankCode: string }) => {
      const response = await apiRequest("POST", `/api/schools/${user?.schoolId}/create-subaccount`, data);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.status) {
        toast({
          className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
          title: "Revenue sharing setup successful!",
          description: `Your account is now set up to receive 80% of yearbook sales. Account holder: ${data.data.account_holder_name}`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/schools", user?.schoolId] });
        setBankAccountNumber("");
        setSelectedBankCode("");
        setAccountHolderName("");
        setVerificationError("");
      } else {
        toast({
          className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
          title: "Setup failed",
          description: data.message || "Failed to set up revenue sharing. Please try again.",
          variant: "destructive"
        });
      }
    },
    onError: (error: any) => {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Error",
        description: error.message || "An error occurred while setting up revenue sharing.",
        variant: "destructive"
      });
    },
  });

  // Update bank account mutation
  const updateAccountMutation = useMutation({
    mutationFn: async (data: { bankAccountNumber: string; bankCode: string; userId?: string }) => {
      const response = await apiRequest("POST", `/api/schools/${user?.schoolId}/update-account`, data);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.status) {
        toast({
          className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
          title: "Bank account updated successfully!",
          description: `Your new account (${data.data.account_holder_name}) is now set up to receive payments.`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/schools", user?.schoolId] });
        setBankAccountNumber("");
        setSelectedBankCode("");
        setAccountHolderName("");
        setVerificationError("");
        setIsChangingAccount(false);
        setIs2FAVerified(false);
        setTwoFactorCode("");
      } else {
        toast({
          className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
          title: "Update failed",
          description: data.message || "Failed to update bank account. Please try again.",
          variant: "destructive"
        });
      }
    },
    onError: (error: any) => {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Error",
        description: error.message || "An error occurred while updating bank account.",
        variant: "destructive"
      });
    },
  });

  // Real-time verification effect
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (bankAccountNumber && selectedBankCode) {
        verifyBankAccount(bankAccountNumber, selectedBankCode);
      }
    }, 500); // Debounce for 500ms

    return () => clearTimeout(timeoutId);
  }, [bankAccountNumber, selectedBankCode]);

  // Username availability checking effect
  React.useEffect(() => {
    const checkUsername = async () => {
      if (!tempValues.username || editingField !== "username") {
        setUsernameAvailable(null);
        setUsernameMessage("");
        return;
      }

      // Don't check if it's the same as current username
      if (tempValues.username === profileForm.username) {
        setUsernameAvailable(true);
        setUsernameMessage("This is your current username");
        return;
      }

      setIsCheckingUsername(true);
      try {
        const response = await apiRequest("POST", "/api/users/check-username", {
          username: tempValues.username,
          currentUserId: user?.id
        });
        const result = await response.json();

        setUsernameAvailable(result.available);
        setUsernameMessage(result.message);
      } catch (error) {
        setUsernameAvailable(false);
        setUsernameMessage("Error checking username availability");
      } finally {
        setIsCheckingUsername(false);
      }
    };

    const timeoutId = setTimeout(() => {
      checkUsername();
    }, 500); // Debounce for 500ms

    return () => clearTimeout(timeoutId);
  }, [tempValues.username, editingField, profileForm.username, user?.id]);

  // Send 2FA code for bank account change
  const send2FACode = async () => {
    if (!user?.id || !user?.schoolId) return;

    setIsSending2FA(true);
    try {
      const response = await apiRequest("POST", `/api/schools/${user.schoolId}/send-bank-2fa`, {
        userId: user.id
      });
      const result = await response.json();

      if (result.status) {
        toast({
          className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
          title: "Code sent",
          description: result.message || "Verification code sent to your email"
        });
        setShow2FADialog(true);
        setCanResend2FA(false);
        setResendCooldown(60);
      } else {
        toast({
          className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
          title: "Failed to send code",
          description: result.message || "Could not send verification code",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Error",
        description: error.message || "Failed to send verification code",
        variant: "destructive"
      });
    } finally {
      setIsSending2FA(false);
    }
  };

  // Verify 2FA code
  const verify2FACode = async () => {
    if (!user?.id || !user?.schoolId || !twoFactorCode) return;

    setIsVerifying2FA(true);
    try {
      const response = await apiRequest("POST", `/api/schools/${user.schoolId}/verify-bank-2fa`, {
        userId: user.id,
        code: twoFactorCode
      });
      const result = await response.json();

      if (result.status) {
        setIs2FAVerified(true);
        setShow2FADialog(false);
        toast({
          className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
          title: "Verified",
          description: "You can now update your bank account"
        });
      } else {
        toast({
          className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
          title: "Invalid code",
          description: result.message || "The verification code is incorrect",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Error",
        description: error.message || "Failed to verify code",
        variant: "destructive"
      });
    } finally {
      setIsVerifying2FA(false);
    }
  };

  // Cooldown timer for resend
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (resendCooldown === 0 && !canResend2FA) {
      setCanResend2FA(true);
    }
  }, [resendCooldown, canResend2FA]);

  const handleRevenueSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!bankAccountNumber || !selectedBankCode) {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Missing information",
        description: "Please provide both bank account number and select a bank.",
        variant: "destructive"
      });
      return;
    }

    if (!accountHolderName) {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Account verification required",
        description: "Please wait for account verification to complete.",
        variant: "destructive"
      });
      return;
    }

    if (isChangingAccount) {
      // For changing account, require 2FA
      if (!is2FAVerified) {
        toast({
          className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
          title: "2FA required",
          description: "Please complete 2FA verification first",
          variant: "destructive"
        });
        return;
      }
      
      updateAccountMutation.mutate({
        bankAccountNumber,
        bankCode: selectedBankCode,
        userId: user?.id
      });
    } else {
      createSubaccountMutation.mutate({
        bankAccountNumber,
        bankCode: selectedBankCode
      });
    }
  };

  const handleChangeAccount = async () => {
    // Check if 30-day restriction applies
    if (school?.lastBankAccountChange) {
      const lastChange = new Date(school.lastBankAccountChange);
      const now = new Date();
      const daysSinceLastChange = (now.getTime() - lastChange.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSinceLastChange < 30) {
        const daysRemaining = Math.ceil(30 - daysSinceLastChange);
        toast({
          className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
          title: "Change restricted",
          description: `You can only change your bank account once every 30 days. Please wait ${daysRemaining} more day${daysRemaining === 1 ? '' : 's'}.`,
          variant: "destructive"
        });
        return;
      }
    }

    setIsChangingAccount(true);
    setBankAccountNumber("");
    setSelectedBankCode("");
    setAccountHolderName("");
    setVerificationError("");
    setIs2FAVerified(false);
    setTwoFactorCode("");
    
    // Send 2FA code
    await send2FACode();
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
      
      // Update form state - only update user fields, keep school fields intact
      setProfileForm(prev => ({
        ...prev,
        email: updatedUser.email || "",
        username: updatedUser.username || ""
      }));
      
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

  const handleConfirmSave = (field: string) => {
    // Show confirmation dialog for username and schoolName
    if (field === "username") {
      setShowUsernameConfirm(true);
      return;
    }
    if (field === "schoolName") {
      setShowSchoolNameConfirm(true);
      return;
    }
    
    // For other fields, save directly
    performSave(field);
  };
  
  const performSave = (field: string) => {
    if (!user) return;
    
    const value = tempValues[field as keyof typeof tempValues];
    
    // For optional fields like website, address, and state, allow empty values
    if (!['website', 'address', 'state'].includes(field) && !value.trim()) {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Invalid input",
        description: "Field cannot be empty",
        variant: "destructive",
      });
      return;
    }

    setIsUpdatingProfile(true);
    
    // For school-specific fields, update the school record
    if (['schoolName', 'website', 'address', 'state'].includes(field)) {
      if (!school?.id) {
        toast({
          className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
          title: "Error",
          description: "School information not found",
          variant: "destructive",
        });
        setIsUpdatingProfile(false);
        return;
      }
      
      // Update school record
      const updateSchool = async () => {
        try {
          // Map schoolName to name for backend
          const fieldName = field === 'schoolName' ? 'name' : field;
          await apiRequest("PATCH", `/api/schools/${school.id}`, {
            [fieldName]: value || null
          });
          
          // Update local form state
          setProfileForm(prev => ({
            ...prev,
            [field]: value
          }));
          
          // Invalidate school query
          queryClient.invalidateQueries({ queryKey: ["/api/schools", user?.schoolId] });
          
          toast({
            className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
            title: "Updated successfully",
            description: `${field.charAt(0).toUpperCase() + field.slice(1)} has been updated`,
          });
          
          setEditingField(null);
          setShowSchoolNameConfirm(false);
        } catch (error: any) {
          toast({
            className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
            title: "Update failed",
            description: error.message || `Failed to update ${field}`,
            variant: "destructive",
          });
        } finally {
          setIsUpdatingProfile(false);
        }
      };
      
      updateSchool();
    } else {
      // For user fields, use the existing mutation
      updateProfileMutation.mutate({ [field]: value });
      setShowUsernameConfirm(false);
    }
  };

  const handleCancelEdit = (field: string) => {
    setEditingField(null);
    setTempValues(prev => ({
      ...prev,
      [field]: profileForm[field as keyof typeof profileForm]
    }));
  };

  const startEditing = (field: string) => {
    // Check 30-day restriction for school name changes
    if (field === "schoolName" && school?.lastSchoolNameChange) {
      const lastChange = new Date(school.lastSchoolNameChange);
      const now = new Date();
      const daysSinceLastChange = (now.getTime() - lastChange.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSinceLastChange < 30) {
        const daysRemaining = Math.ceil(30 - daysSinceLastChange);
        toast({
          className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
          title: "Change restricted",
          description: `School name can only be changed once every 30 days. Please wait ${daysRemaining} more day${daysRemaining === 1 ? '' : 's'}.`,
          variant: "destructive"
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
            <Label htmlFor="username" data-testid="label-username" className="text-sm font-medium text-white">Username</Label>
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
        </CardContent>
      </Card>

      {/* School Information Card - Read Only */}
      <Card className="bg-white/10 backdrop-blur-lg border border-white/20">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-lg sm:text-xl text-white">School Information</CardTitle>
          <p className="text-sm text-blue-50">Basic school information (contact support to modify)</p>
        </CardHeader>
        <CardContent className="space-y-4 p-4 sm:p-6 pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="yearFounded" className="text-sm font-medium text-blue-50">Year Founded</Label>
              <Input
                id="yearFounded"
                value={school?.yearFounded || ""}
                readOnly
                className="bg-gray-50 h-10 sm:h-11 bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20"
                data-testid="input-year-founded"
              />
            </div>
            <div>
              <Label htmlFor="country" className="text-sm font-medium text-blue-50">Country</Label>
              <Input
                id="country"
                value={school?.country || ""}
                readOnly
                className="bg-gray-50 h-10 sm:h-11 bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20"
                data-testid="input-country"
              />
            </div>
            <div>
              <Label htmlFor="city" className="text-sm font-medium text-blue-50">City</Label>
              <Input
                id="city"
                value={school?.city || ""}
                readOnly
                className="bg-gray-50 h-10 sm:h-11 bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20"
                data-testid="input-city"
              />
            </div>
            <div>
              <Label htmlFor="phoneNumber" className="text-sm font-medium text-blue-50">Phone Number</Label>
              <Input
                id="phoneNumber"
                value={school?.phoneNumber || ""}
                readOnly
                className="bg-gray-50 h-10 sm:h-11 bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20"
                data-testid="input-phone-number"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Editable School Information */}
      <Card className="bg-white/10 backdrop-blur-lg border border-white/20">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-lg sm:text-xl text-white">Additional Information</CardTitle>
          <p className="text-sm text-blue-50">Update optional school information</p>
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
    const calculateTotal = (history: any[] = [], field: 'amount' = 'amount') => {
      return history?.reduce((sum, item) => sum + (item[field] || 0), 0) || 0;
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
                {formatPrice(convertPrice(calculateTotal(paymentHistory || [])))}
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
                  const total = calculateTotal(salesHistory || []);
                  const currency = salesHistory?.[0]?.currency;
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
            ) : paymentHistory && paymentHistory.length > 0 ? (
              <div className="space-y-3">
                {paymentHistory.map((payment: any) => (
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
            ) : salesHistory && salesHistory.length > 0 ? (
              <div className="space-y-3">
                {salesHistory.map((sale: any) => (
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

  const renderSecurityTab = () => {
    return (
      <div className="space-y-4 sm:space-y-6 max-w-6xl">
        {/* Most Recent Login Card */}
        {recentLogin && (
          <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-lg sm:text-xl flex items-center text-white">
                <Shield className="h-5 w-5 mr-2 text-green-400" />
                Most Recent Login
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center text-white/70 text-sm">
                    <Smartphone className="h-4 w-4 mr-2" />
                    <span>Device: {recentLogin.deviceType || 'Unknown'} - {recentLogin.browser || 'Unknown'}</span>
                  </div>
                  <div className="flex items-center text-white/70 text-sm">
                    <Monitor className="h-4 w-4 mr-2" />
                    <span>OS: {recentLogin.os || 'Unknown'}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center text-white/70 text-sm">
                    <MapPin className="h-4 w-4 mr-2" />
                    <span>Location: {recentLogin.city || recentLogin.country || 'Unknown'}</span>
                  </div>
                  <div className="flex items-center text-white/70 text-sm">
                    <Clock className="h-4 w-4 mr-2" />
                    <span>{new Date(recentLogin.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Login Activity History */}
        <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-lg sm:text-xl flex items-center text-white">
              <Clock className="h-5 w-5 mr-2 text-blue-400" />
              Login Activity
            </CardTitle>
            <p className="text-sm text-white/70 mt-2">
              Review your recent login history and security activity
            </p>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            {loadingLoginActivity ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-white" />
              </div>
            ) : loginActivity && loginActivity.length > 0 ? (
              <div className="max-h-96 overflow-y-auto pr-2 space-y-3">
                {loginActivity.map((activity: any, index: number) => (
                  <div key={activity.id || index} className="bg-white/5 backdrop-blur-lg border border-white/20 rounded-lg p-4">
                    <div className="flex justify-between items-start flex-wrap gap-2">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex items-center px-2 py-1 rounded text-xs ${
                            activity.loginStatus === 'success' 
                              ? 'bg-green-500/20 text-green-200' 
                              : 'bg-red-500/20 text-red-200'
                          }`}>
                            {activity.loginStatus === 'success' ? 'Successful' : 'Failed'}
                          </span>
                          {activity.failureReason && (
                            <span className="text-xs text-red-300">({activity.failureReason})</span>
                          )}
                        </div>
                        <div className="text-white/80 text-sm">
                          {activity.browser} on {activity.os} - {activity.deviceType}
                        </div>
                        <div className="text-white/60 text-xs">
                          {activity.city || activity.country || 'Unknown location'} • {activity.ipAddress}
                        </div>
                      </div>
                      <div className="text-white/60 text-xs whitespace-nowrap">
                        {new Date(activity.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-white/60">
                <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No login activity recorded</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Security Settings - Can be expanded */}
        <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-lg sm:text-xl flex items-center text-white">
              <Settings className="h-5 w-5 mr-2 text-purple-400" />
              Security Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <div className="space-y-4">
              {/* Change Password Section */}
              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <h3 className="text-white font-medium mb-2">Change Password</h3>
                <p className="text-white/60 text-sm mb-3">
                  Reset your password securely via email verification
                </p>
                <PasswordChangeDialog />
              </div>

              <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                <h3 className="text-white font-medium mb-2">Two-Factor Authentication</h3>
                <p className="text-white/60 text-sm mb-3">Add an extra layer of security to your account</p>
                <Button variant="outline" size="sm" className="text-white border-white/20" disabled>
                  Coming Soon
                </Button>
              </div>
              
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
        return renderDisplayTab();
      case "revenue":
        return renderRevenueTab();
      case "payments":
        return renderPaymentsTab();
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
              onClick={handleBackClick}
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
                <div className="hamburger-dropdown fixed top-16 right-4 w-48 bg-blue-600/70 backdrop-blur-lg border border-white/20 rounded-lg shadow-xl z-[999999]">
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
                <button
                  onClick={() => setActiveTab("display")}
                  className={`flex items-center w-full px-3 py-2 text-sm rounded-md transition-colors ${
                    activeTab === "display"
                      ? "bg-white/20 text-white font-medium"
                      : "text-white/70 hover:text-white hover:bg-white/10"
                  }`}
                  data-testid="tab-display"
                >
                  <Monitor className="h-4 w-4 mr-2 flex-shrink-0" />
                  Display Preferences
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
                  Revenue Settings
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
                  Payment & Sales History
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
                  Login Activity
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
                <button
                  onClick={() => {
                    setActiveTab("display");
                    setShowSidebar(false);
                  }}
                  className={`flex items-center w-full px-3 py-3 text-sm rounded-md transition-colors touch-manipulation ${
                    activeTab === "display"
                      ? "bg-white/20 text-white font-medium"
                      : "text-white/70 hover:text-white hover:bg-white/10"
                  }`}
                  data-testid="tab-display-mobile"
                >
                  <Monitor className="h-5 w-5 mr-3 flex-shrink-0" />
                  Display Preferences
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
                  Revenue Settings
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
                  Payment & Sales History
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
                  Login Activity
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
              Are you sure you want to change your username from <span className="font-bold text-blue-300">"{profileForm.username}"</span> to <span className="font-bold text-green-300">"{tempValues.username}"</span>?
              <div className="mt-2 text-amber-200">
                <Clock className="h-4 w-4 inline mr-1" />
                Note: Username can only be changed once every 14 days.
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
    </div>
  );
}