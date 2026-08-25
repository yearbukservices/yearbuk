import { useState, useEffect, ReactNode } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Bell, Menu, ShoppingCart, Settings, Home, LogOut, X, Library, User, Upload, Users, Search, BookOpen, Image as ImageIcon, Package, UserCheck } from "lucide-react";
import logoImage from "@assets/logo_background_null.png";
import type { Notification, User as UserType, AlumniBadge } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Copy, Calendar } from "lucide-react";

interface DashboardLayoutProps {
  children: ReactNode;
  userType?: "viewer" | "school";
  onSearchTabClick?: () => void;
}

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

export function DashboardLayout({ children, userType = "viewer", onSearchTabClick }: DashboardLayoutProps) {
  const [location, setLocation] = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showHamburgerMenu, setShowHamburgerMenu] = useState(false);
  const [user, setUser] = useState<UserType | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const userData = localStorage.getItem("user");
    console.log('DashboardLayout - Raw localStorage user data:', userData);
    if (!userData) {
      console.log('DashboardLayout - No user data in localStorage, redirecting to /home');
      setLocation("/home");
      return;
    }
    
    try {
      const parsedUser = JSON.parse(userData);
      console.log('DashboardLayout - Parsed user:', parsedUser);
      setUser(parsedUser);
    } catch (error) {
      console.error('DashboardLayout - Failed to parse user data:', error);
      setLocation("/home");
    }
  }, [setLocation]);

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user?.id) return [];
      const res = await fetch(`/api/notifications/${user.id}`);
      if (!res.ok) throw new Error("Failed to fetch notifications");
      return res.json();
    },
    refetchInterval: 30000,
  });

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

  const { data: pendingAlumniRequestCount = 0 } = useQuery<number>({
    queryKey: ["/api/alumni-requests/school/count", user?.schoolId],
    enabled: user?.userType === "school" && !!user?.schoolId,
    queryFn: async () => {
      if (!user?.schoolId) return 0;
      const res = await fetch(`/api/alumni-requests/school/${user.schoolId}/count`);
      if (!res.ok) throw new Error("Failed to fetch alumni request count");
      const data = await res.json();
      return data.count || 0;
    },
    refetchInterval: 30000,
  });

  const { data: pendingMemoriesCount = 0 } = useQuery<number>({
    queryKey: ["/api/memories/school/pending-count", user?.schoolId],
    enabled: user?.userType === "school" && !!user?.schoolId,
    queryFn: async () => {
      if (!user?.schoolId) return 0;
      try {
        const url = `/api/memories/school/${user.schoolId}/pending-count`;
        console.log('Fetching pending memories from:', url);
        const res = await fetch(url);
        console.log('Response status:', res.status);
        if (!res.ok) {
          const error = await res.text();
          console.error("Failed to fetch pending memories count:", res.status, error);
          throw new Error("Failed to fetch pending memories count");
        }
        const data = await res.json();
        console.log('Pending memories response:', data);
        return data.count || 0;
      } catch (error) {
        console.error("Error in pendingMemoriesCount query:", error);
        return 0;
      }
    },
    refetchInterval: 30000,
  });

  const unreadNotificationCount = notifications.filter(n => !n.isRead).length;

  // Determine account status for viewer accounts
  const getAccountStatus = () => {
    if (!user) return null;
    if (user.userType !== 'viewer') return null;
    
    const verifiedBadges = alumniBadges.filter(badge => badge.status === 'verified');
    const totalBadges = alumniBadges.length;
    
    if (verifiedBadges.length > 0) {
      return `Alumni (${verifiedBadges.length})`;
    }
    return 'Viewer';
  };
  
  const accountStatus = getAccountStatus();
  
  // For debugging
  console.log('DashboardLayout - User:', user?.username, 'Type:', user?.userType, 'Account Status:', accountStatus, 'Alumni Badges:', alumniBadges.length, 'Pending Memories:', pendingMemoriesCount);

  const handleLogout = () => {
    localStorage.removeItem("user");
    window.dispatchEvent(new Event('userChanged'));
    setLocation("/home");
  };

  const markNotificationReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      await apiRequest("PATCH", `/api/notifications/${notificationId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications", user?.id] });
    },
  });

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

  const isActive = (path: string) => {
    if (path === '/' && location === '/') return true;
    if (path !== '/' && location.startsWith(path)) return true;
    return false;
  };

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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-white/10 backdrop-blur-lg border-b border-white/20 shadow-2xl z-30">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <button 
            onClick={() => setLocation("/")}
            className="flex items-center space-x-3 hover:opacity-80 transition-opacity"
            data-testid="link-logo"
          >
            <img src={logoImage} alt="Yearbuk Logo" className="h-12 w-auto" />
            <span className="text-2xl font-bold text-white">Yearbuk</span>
          </button>
          
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              className="relative text-white hover:bg-white/20"
              onClick={() => setShowNotifications(!showNotifications)}
              data-testid="button-notifications"
            >
              <Bell className="h-5 w-5" />
              {unreadNotificationCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {unreadNotificationCount}
                </span>
              )}
            </Button>
            
            {accountStatus && (
              <>
                {/* Mobile Circle Status Indicator - Show only on small screens */}
                <div className="sm:hidden relative" data-testid="account-status-mobile">
                  {accountStatus.startsWith("Alumni") ? (
                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                      {alumniBadges.filter(b => b.status === "verified").length}
                    </div>
                  ) : (
                    <div className="w-6 h-6 bg-blue-500 rounded-full"></div>
                  )}
                </div>
                
                {/* Desktop Account Status Indicator - Hidden on small screens */}
                <div 
                  className={`hidden sm:block px-2 sm:px-3 py-1 rounded-full text-xs font-medium ${
                    accountStatus.startsWith("Alumni") 
                      ? "bg-green-500/20 text-green-200 border border-green-400/30" 
                      : "bg-blue-500/20 text-blue-200 border border-blue-400/30"
                  }`}
                  data-testid="account-status-desktop"
                >
                  <span className="hidden md:inline">Account Status: </span>{accountStatus}
                </div>
              </>
            )}
            
            {!accountStatus && (
              <span className="text-xs sm:text-sm font-medium text-white hidden xs:block">
                <span className="hidden sm:inline">{user.fullName}</span>
                <span className="sm:hidden">{user.fullName?.split(" ")[0]}</span>
              </span>
            )}
            
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
      </header>

      {/* Notifications Dropdown */}
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
                    onClick={() => clearAllNotificationsMutation.mutate()}
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
                          markNotificationReadMutation.mutate(notification.id);
                        }
                      }} className="cursor-pointer">
                        <h4 className="text-sm font-medium text-white">
                          {notification.title}
                        </h4>
                        <p className="text-sm text-white/80 mt-1">
                          {notification.message}
                        </p>
                      </div>
                      
                      {notification.type === 'upload_code_created' && notification.uploadCode && notification.expiresAt && (
                        <div className="mt-3 space-y-2">
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
                setLocation(userType === "school" ? "/school-settings" : "/viewer-settings");
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

      {/* Desktop Left Sidebar Navigation */}
      <nav className="hidden lg:flex fixed left-0 top-20 bottom-0 w-64 bg-white/10 backdrop-blur-lg border-r border-white/20 shadow-2xl z-20 flex-col py-6 px-4">
        <div className="flex flex-col gap-3">
          {userType === "school" ? (
            <>
              <button
                onClick={() => setLocation("/")}
                className={`px-4 py-3 text-sm font-medium rounded-xl flex items-center space-x-3 transition-all duration-300 ${
                  isActive("/") && location === "/"
                    ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/25" 
                    : "bg-white/10 text-blue-100 hover:bg-white/20 hover:text-white"
                }`}
                data-testid="tab-dashboard-desktop"
              >
                <Home className="h-5 w-5" />
                <span>Dashboard</span>
              </button>
              <button
                onClick={() => setLocation("/yearbooks")}
                className={`px-4 py-3 text-sm font-medium rounded-xl flex items-center space-x-3 transition-all duration-300 ${
                  isActive("/yearbooks")
                    ? "bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-lg shadow-cyan-500/25" 
                    : "bg-white/10 text-blue-100 hover:bg-white/20 hover:text-white"
                }`}
                data-testid="tab-yearbooks-desktop"
              >
                <BookOpen className="h-5 w-5" />
                <span>Yearbooks</span>
              </button>
              <button
                onClick={() => setLocation("/memories")}
                className={`px-4 py-3 text-sm font-medium rounded-xl flex items-center space-x-3 transition-all duration-300 relative ${
                  isActive("/memories")
                    ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/25" 
                    : "bg-white/10 text-blue-100 hover:bg-white/20 hover:text-white"
                }`}
                data-testid="tab-memories-desktop"
              >
                <ImageIcon className="h-5 w-5" />
                <span>Memories</span>
                {pendingMemoriesCount > 0 && (
                  <span 
                    className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center"
                    data-testid="badge-pending-memories-desktop"
                  >
                    {pendingMemoriesCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setLocation("/alumni")}
                className={`px-4 py-3 text-sm font-medium rounded-xl flex items-center space-x-3 transition-all duration-300 relative ${
                  isActive("/alumni")
                    ? "bg-gradient-to-r from-green-500 to-teal-500 text-white shadow-lg shadow-green-500/25" 
                    : "bg-white/10 text-blue-100 hover:bg-white/20 hover:text-white"
                }`}
                data-testid="tab-alumni-desktop"
              >
                <UserCheck className="h-5 w-5" />
                <span>Alumni</span>
                {pendingAlumniRequestCount > 0 && (
                  <span 
                    className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center"
                    data-testid="badge-alumni-requests-desktop"
                  >
                    {pendingAlumniRequestCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setLocation("/school-profile")}
                className={`px-4 py-3 text-sm font-medium rounded-xl flex items-center space-x-3 transition-all duration-300 ${
                  isActive("/school-profile")
                    ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/25" 
                    : "bg-white/10 text-blue-100 hover:bg-white/20 hover:text-white"
                }`}
                data-testid="tab-profile-desktop"
              >
                <User className="h-5 w-5" />
                <span>Profile</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setLocation("/")}
                className={`px-4 py-3 text-sm font-medium rounded-xl flex items-center space-x-3 transition-all duration-300 ${
                  isActive("/") && location === "/"
                    ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/25" 
                    : "bg-white/10 text-blue-100 hover:bg-white/20 hover:text-white"
                }`}
                data-testid="tab-home-desktop"
              >
                <Home className="h-5 w-5" />
                <span>Home</span>
              </button>
              <button
                onClick={() => {
                  if (location === "/search" && onSearchTabClick) {
                    onSearchTabClick();
                  } else {
                    setLocation("/search");
                  }
                }}
                className={`px-4 py-3 text-sm font-medium rounded-xl flex items-center space-x-3 transition-all duration-300 ${
                  isActive("/search")
                    ? "bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-lg shadow-cyan-500/25" 
                    : "bg-white/10 text-blue-100 hover:bg-white/20 hover:text-white"
                }`}
                data-testid="tab-search-desktop"
              >
                <Search className="h-5 w-5" />
                <span>Search</span>
              </button>
              <button
                onClick={() => setLocation("/library")}
                className={`px-4 py-3 text-sm font-medium rounded-xl flex items-center space-x-3 transition-all duration-300 ${
                  isActive("/library")
                    ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/25" 
                    : "bg-white/10 text-blue-100 hover:bg-white/20 hover:text-white"
                }`}
                data-testid="tab-library-desktop"
              >
                <Library className="h-5 w-5" />
                <span>Library</span>
              </button>
              <button
                onClick={() => setLocation("/profile")}
                className={`px-4 py-3 text-sm font-medium rounded-xl flex items-center space-x-3 transition-all duration-300 ${
                  isActive("/profile")
                    ? "bg-gradient-to-r from-green-500 to-teal-500 text-white shadow-lg shadow-green-500/25" 
                    : "bg-white/10 text-blue-100 hover:bg-white/20 hover:text-white"
                }`}
                data-testid="tab-profile-desktop"
              >
                <User className="h-5 w-5" />
                <span>Profile</span>
              </button>
              <button
                onClick={() => setLocation("/memory-upload")}
                className={`px-4 py-3 text-sm font-medium rounded-xl flex items-center space-x-3 transition-all duration-300 ${
                  isActive("/memory-upload")
                    ? "bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-lg shadow-yellow-500/25" 
                    : "bg-white/10 text-blue-100 hover:bg-white/20 hover:text-white"
                }`}
                data-testid="tab-memory-upload-desktop"
              >
                <Upload className="h-5 w-5" />
                <span>Memory Upload</span>
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/10 backdrop-blur-lg border-t border-white/20 shadow-2xl z-20">
        <div className="flex justify-around items-center px-2 py-3">
          {userType === "school" ? (
            <>
              <button
                onClick={() => {
                  if (location === "/search" && onSearchTabClick) {
                    onSearchTabClick();
                  } else {
                    setLocation("/search");
                  }
                }}
                className={`flex flex-col items-center justify-center px-2 py-2 rounded-lg transition-all duration-300 ${
                  location.startsWith("/search") ? "text-white" : "text-blue-200"
                }`}
                data-testid="tab-search-mobile"
              >
                <Search className={`h-6 w-6 mb-1 ${location.startsWith("/search") ? "text-cyan-400" : ""}`} />
                <span className="text-xs">Search</span>
              </button>
              <button
                onClick={() => setLocation("/yearbooks")}
                className={`flex flex-col items-center justify-center px-2 py-2 rounded-lg transition-all duration-300 ${
                  location.startsWith("/yearbooks") ? "text-white" : "text-blue-200"
                }`}
                data-testid="tab-yearbooks-mobile"
              >
                <BookOpen className={`h-6 w-6 mb-1 ${location.startsWith("/yearbooks") ? "text-cyan-400" : ""}`} />
                <span className="text-xs">Books</span>
              </button>
              <button
                onClick={() => setLocation("/memories")}
                className={`flex flex-col items-center justify-center px-2 py-2 rounded-lg transition-all duration-300 relative ${
                  location.startsWith("/memories") ? "text-white" : "text-blue-200"
                }`}
                data-testid="tab-memories-mobile"
              >
                <ImageIcon className={`h-6 w-6 mb-1 ${location.startsWith("/memories") ? "text-purple-400" : ""}`} />
                <span className="text-xs">Memories</span>
                {pendingMemoriesCount > 0 && (
                  <span 
                    className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center"
                    data-testid="badge-pending-memories-mobile"
                  >
                    {pendingMemoriesCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setLocation("/alumni")}
                className={`flex flex-col items-center justify-center px-2 py-2 rounded-lg transition-all duration-300 relative ${
                  location.startsWith("/alumni") ? "text-white" : "text-blue-200"
                }`}
                data-testid="tab-alumni-mobile"
              >
                <UserCheck className={`h-6 w-6 mb-1 ${location.startsWith("/alumni") ? "text-green-400" : ""}`} />
                <span className="text-xs">Alumni</span>
                {pendingAlumniRequestCount > 0 && (
                  <span 
                    className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center"
                    data-testid="badge-alumni-requests-mobile"
                  >
                    {pendingAlumniRequestCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setLocation("/school-profile")}
                className={`flex flex-col items-center justify-center px-2 py-2 rounded-lg transition-all duration-300 ${
                  location.startsWith("/school-profile") ? "text-white" : "text-blue-200"
                }`}
                data-testid="tab-profile-mobile"
              >
                <User className={`h-6 w-6 mb-1 ${location.startsWith("/school-profile") ? "text-indigo-400" : ""}`} />
                <span className="text-xs">Profile</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setLocation("/")}
                className={`flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-all duration-300 ${
                  location === "/" ? "text-white" : "text-blue-200"
                }`}
                data-testid="tab-home-mobile"
              >
                <Home className={`h-6 w-6 mb-1 ${location === "/" ? "text-blue-400" : ""}`} />
                <span className="text-xs">Home</span>
              </button>
              <button
                onClick={() => {
                  if (location === "/search" && onSearchTabClick) {
                    onSearchTabClick();
                  } else {
                    setLocation("/search");
                  }
                }}
                className={`flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-all duration-300 ${
                  location.startsWith("/search") ? "text-white" : "text-blue-200"
                }`}
                data-testid="tab-search-mobile"
              >
                <Search className={`h-6 w-6 mb-1 ${location.startsWith("/search") ? "text-cyan-400" : ""}`} />
                <span className="text-xs">Search</span>
              </button>
              <button
                onClick={() => setLocation("/library")}
                className={`flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-all duration-300 ${
                  location.startsWith("/library") ? "text-white" : "text-blue-200"
                }`}
                data-testid="tab-library-mobile"
              >
                <Library className={`h-6 w-6 mb-1 ${location.startsWith("/library") ? "text-purple-400" : ""}`} />
                <span className="text-xs">Library</span>
              </button>
              <button
                onClick={() => setLocation("/profile")}
                className={`flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-all duration-300 ${
                  location.startsWith("/profile") ? "text-white" : "text-blue-200"
                }`}
                data-testid="tab-profile-mobile"
              >
                <User className={`h-6 w-6 mb-1 ${location.startsWith("/profile") ? "text-green-400" : ""}`} />
                <span className="text-xs">Profile</span>
              </button>
              <button
                onClick={() => setLocation("/memory-upload")}
                className={`flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-all duration-300 ${
                  isActive("/memory-upload") ? "text-white" : "text-blue-200"
                }`}
                data-testid="tab-memory-upload-mobile"
              >
                <Upload className={`h-6 w-6 mb-1 ${isActive("/memory-upload") ? "text-yellow-400" : ""}`} />
                <span className="text-xs">Upload</span>
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="lg:ml-64 pb-20 lg:pb-8 pt-20">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-6 sm:py-8">
          {children}
        </div>
      </div>
    </div>
  );
}
