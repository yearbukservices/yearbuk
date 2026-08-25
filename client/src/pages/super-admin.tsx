import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import SuperAdminDashboard from "./super-admin-dashboard";

export default function SuperAdmin() {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Check if user is authenticated as super admin
    const token = localStorage.getItem('superAdminToken');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData);
        // Verify user has super_admin privileges
        if (parsedUser.userType === 'super_admin' || parsedUser.role === 'super_admin') {
          // Verify token by trying to fetch user data
          fetch('/api/super-admin/analytics', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          })
          .then(response => {
            if (response.ok) {
              // Token is valid, set user state
              setUser(parsedUser);
            } else {
              // Token is invalid, redirect to login
              localStorage.removeItem('superAdminToken');
              localStorage.removeItem('user');
              setLocation('/login');
            }
          })
          .catch(() => {
            // Error occurred, redirect to login
            localStorage.removeItem('superAdminToken');
            localStorage.removeItem('user');
            setLocation('/login');
          })
          .finally(() => {
            setIsLoading(false);
          });
        } else {
          // User doesn't have super admin privileges
          setLocation('/login');
          setIsLoading(false);
        }
      } catch {
        // Invalid user data, redirect to login
        setLocation('/login');
        setIsLoading(false);
      }
    } else {
      // Not authenticated, redirect to login
      setLocation('/login');
      setIsLoading(false);
    }
  }, [setLocation]);

  const handleLogout = () => {
    localStorage.removeItem('superAdminToken');
    localStorage.removeItem('user');
    setLocation('/login');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to login via useEffect
  }

  return <SuperAdminDashboard user={user} onLogout={handleLogout} />;
}