import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Bell, Menu, ShoppingCart, Settings, Home, LogOut, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoImage from "@assets/logo_background_null.png";
import type { Notification, User } from "@shared/schema";

interface ViewerDashboardLayoutProps {
  children: React.ReactNode;
  user: User | null;
}

export function ViewerDashboardLayout({ children, user }: ViewerDashboardLayoutProps) {
  const [, setLocation] = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showHamburgerMenu, setShowHamburgerMenu] = useState(false);

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

  const unreadNotificationCount = notifications.filter(n => !n.isRead).length;

  const handleLogout = () => {
    localStorage.removeItem("user");
    window.dispatchEvent(new Event('userChanged'));
    setLocation("/home");
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 relative">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 bg-white/10 backdrop-blur-lg border-b border-white/20 shadow-2xl z-30">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <button 
            onClick={() => setLocation("/")}
            className="flex items-center space-x-3 hover:opacity-80 transition-opacity"
            data-testid="link-logo"
          >
            <img src={logoImage} alt="Yearbuk Logo" className="h-12 w-auto" />
            <span className="text-2xl font-bold text-white">Yearbuk</span>
          </button>
          
          <div className="flex items-center space-x-4">
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
            
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-white hover:bg-white/20"
              onClick={() => setShowHamburgerMenu(!showHamburgerMenu)}
              data-testid="button-hamburger-menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Notifications Dropdown */}
      {showNotifications && (
        <div className="fixed top-20 right-4 w-96 max-w-[calc(100vw-2rem)] bg-blue-600/60 backdrop-blur-lg border border-white/20 rounded-lg shadow-2xl z-[999999] max-h-[calc(100vh-6rem)] overflow-hidden flex flex-col">
          <div className="p-4 border-b border-white/20">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Notifications</h3>
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
                      <h4 className="text-sm font-medium text-white">
                        {notification.title}
                      </h4>
                      <p className="text-sm text-white/80 mt-1">
                        {notification.message}
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
        <div className="hamburger-dropdown fixed top-20 right-4 w-48 bg-blue-600/60 backdrop-blur-lg border border-white/20 rounded-lg shadow-xl z-[999999]">
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

      {/* Main Content Area - with top padding for header */}
      <div className="pt-20">
        {children}
      </div>
    </div>
  );
}
