import { useEffect } from "react";
import { useLocation } from "wouter";

export default function MemoryUploadRedirect() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Check if user is logged in
    const storedUser = localStorage.getItem('user');
    
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        
        // If user is a viewer/alumni, redirect to viewer dashboard with memory upload tab
        if (user.userType === 'viewer') {
          setLocation('/?tab=memory_upload');
          return;
        }
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }
    
    // For non-registered users or other user types, redirect to guest-upload page where they can enter the 12-character code
    setLocation('/guest-upload');
  }, [setLocation]);

  // Show loading while redirecting
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center">
      <div className="text-center text-white">
        <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p>Redirecting to memory upload...</p>
      </div>
    </div>
  );
}