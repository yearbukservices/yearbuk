import { useLocation } from "wouter";
import { useEffect } from "react";
import InstagramSchoolProfile from "./instagram-school-profile";
import { Button } from "@/components/ui/button";
import logoImage from "@assets/logo_background_null.png";

interface StandaloneSchoolProfileWrapperProps {
  schoolUsername: string;
  initialTab?: "memories" | "yearbooks" | "alumni";
}

export default function StandaloneSchoolProfileWrapper({ 
  schoolUsername,
  initialTab = "memories" 
}: StandaloneSchoolProfileWrapperProps) {
  const [, setLocation] = useLocation();

  // Set page title
  useEffect(() => {
    document.title = `${schoolUsername} - Yearbuk`;
  }, [schoolUsername]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
      {/* Public Header */}
      <div className="sticky top-0 left-0 right-0 bg-white/10 backdrop-blur-lg border-b border-white/20 z-30">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <button 
            onClick={() => setLocation("/home")}
            className="flex items-center space-x-2 hover-elevate active-elevate-2"
            data-testid="link-logo-public"
          >
            <img src={logoImage} alt="Yearbuk Logo" className="h-10 w-auto" />
            <span className="text-xl font-bold text-white">Yearbuk</span>
          </button>
          
          <div className="flex items-center gap-3">
            <Button 
              variant="outline"
              onClick={() => setLocation('/login')}
              data-testid="button-public-login"
              className="bg-white/20 backdrop-blur-lg border border-white/30 text-white hover:bg-white/30"
            >
              Login
            </Button>
            <Button 
              onClick={() => setLocation('/signup')}
              data-testid="button-public-signup"
              className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/25"
            >
              Sign Up
            </Button>
          </div>
        </div>
      </div>

      {/* Instagram Style School Profile */}
      <div className="py-6">
        <InstagramSchoolProfile 
          schoolUsername={schoolUsername} 
          initialTab={initialTab}
          inDashboard={false}
        />
      </div>
    </div>
  );
}
