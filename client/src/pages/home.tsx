import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { BookOpen, Users, Camera, Shield, Heart } from "lucide-react";
import { LoginDialog } from "@/components/LoginDialog";
import logoImage from "@assets/logo_background_null.png";
import { FaXTwitter, FaInstagram } from "react-icons/fa6";

export default function HomePage() {
  const [, setLocation] = useLocation();
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex flex-col relative overflow-hidden">
      {/* Animated Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-20 left-20 w-32 h-32 bg-white rounded-full opacity-5 animate-float"></div>
          <div className="absolute top-60 right-40 w-24 h-24 bg-white rounded-full opacity-5 animate-float-delayed"></div>
          <div className="absolute bottom-40 left-40 w-20 h-20 bg-white rounded-full opacity-5 animate-float"></div>
          <div className="absolute bottom-20 right-20 w-16 h-16 bg-white rounded-full opacity-5 animate-float-delayed"></div>
        </div>
      </div>

      {/* Header */}
      <div className="fixed top-0 left-0 right-0 bg-white/10 backdrop-blur-lg border-b border-white/20 shadow-2xl z-30">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <button 
            onClick={() => setLocation("/home")}
            className="flex items-center space-x-3 hover:opacity-80 transition-opacity"
            data-testid="link-logo-home"
          >
            <img src={logoImage} alt="Yearbuk Logo" className="h-12 w-auto" />
            <span className="text-2xl font-bold text-white">Yearbuk</span>
          </button>
          
          <div className="flex items-center space-x-4">
            <LoginDialog open={loginDialogOpen} onOpenChange={setLoginDialogOpen}>
              <Button 
                variant="outline"
                className="bg-white/20 backdrop-blur-lg border border-white/30 text-white hover:bg-white/30"
                data-testid="button-home-login"
              >
                Login
              </Button>
            </LoginDialog>
            <Button 
              onClick={() => setLocation('/signup')}
              className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg hover:from-blue-600 hover:to-cyan-600 border-0"
              data-testid="button-home-signup"
            >
              Sign Up
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 sm:p-8 relative z-10 pt-32">
        <div className="max-w-4xl animate-fade-in-up text-center w-full">
          {/* Main Brand Section */}
          <div className="mb-16">
            <div className="flex items-center justify-center mb-8">
              <div className="relative">
                <div className="w-32 h-32 rounded-full flex items-center justify-center shadow-2xl overflow-hidden">
                  <img 
                    src={logoImage} 
                    alt="Yearbuk Logo" 
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>
            <h1 className="text-6xl md:text-7xl font-bold text-white mb-6 tracking-tight">
              Yearbuk
            </h1>
            <p className="text-2xl md:text-3xl text-blue-100 leading-relaxed mb-12 animate-fade-in-delayed">
              Where School Memories Live Forever
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 w-full max-w-md sm:max-w-none mx-auto">
              <Button 
                onClick={() => setLocation('/signup')}
                size="lg"
                className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 shadow-2xl transform hover:scale-105 transition-all duration-200"
                data-testid="button-get-started"
              >
                Get Started
              </Button>
              <Button 
                onClick={() => setLocation('/guest-upload')}
                size="lg"
                variant="outline"
                className="w-full sm:w-auto bg-white/10 hover:bg-white/20 text-white border-white/30 hover:border-white/50 transition-all px-6 sm:px-8 py-5 sm:py-6 text-base sm:text-lg"
                data-testid="button-upload-memory-hero"
              >
                <Camera className="w-5 h-5 mr-2" />
                Upload Memory
              </Button>
            </div>
          </div>

          {/* Feature Highlights */}
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-8 mb-16">
            <div className="text-center animate-slide-in-left hover:scale-105 transition-transform duration-300">
              <div className="w-20 h-20 bg-blue-500/20 rounded-xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm border border-blue-400/30 hover:bg-blue-500/30 hover:border-blue-300/50 transition-all duration-300">
                <BookOpen className="text-blue-300 w-10 h-10 hover:text-blue-200 transition-colors" />
              </div>
              <h3 className="text-white font-semibold text-lg mb-2">Digital Yearbooks</h3>
              <p className="text-blue-200 text-sm hidden sm:block">Beautiful, interactive school memories</p>
            </div>
            <div className="text-center animate-slide-in-right hover:scale-105 transition-transform duration-300 animation-delay-200">
              <div className="w-20 h-20 bg-purple-500/20 rounded-xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm border border-purple-400/30 hover:bg-purple-500/30 hover:border-purple-300/50 transition-all duration-300">
                <Users className="text-purple-300 w-10 h-10 hover:text-purple-200 transition-colors" />
              </div>
              <h3 className="text-white font-semibold text-lg mb-2">Alumni Network</h3>
              <p className="text-blue-200 text-sm hidden sm:block">Connect with classmates worldwide</p>
            </div>
            <div className="text-center animate-slide-in-left hover:scale-105 transition-transform duration-300 animation-delay-400">
              <div className="w-20 h-20 bg-green-500/20 rounded-xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm border border-green-400/30 hover:bg-green-500/30 hover:border-green-300/50 transition-all duration-300">
                <Camera className="text-green-300 w-10 h-10 hover:text-green-200 transition-colors" />
              </div>
              <h3 className="text-white font-semibold text-lg mb-2">Memory Discovery</h3>
              <p className="text-blue-200 text-sm hidden sm:block">View, discover, and even upload school moments</p>
            </div>
            <div className="text-center animate-slide-in-right hover:scale-105 transition-transform duration-300 animation-delay-600">
              <div className="w-20 h-20 bg-red-500/20 rounded-xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm border border-red-400/30 hover:bg-red-500/30 hover:border-red-300/50 transition-all duration-300">
                <Shield className="text-red-300 w-10 h-10 hover:text-red-200 transition-colors" />
              </div>
              <h3 className="text-white font-semibold text-lg mb-2">Safe & Secure</h3>
              <p className="text-blue-200 text-sm hidden sm:block">Protected educational environment</p>
            </div>
          </div>

          {/* Social Proof */}
          <div className="text-center animate-fade-in-up animation-delay-800">
            <div className="flex items-center justify-center mb-4">
              <div className="flex -space-x-2">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full border-4 border-white animate-avatar-bounce animation-delay-200"></div>
                <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-blue-500 rounded-full border-4 border-white animate-avatar-bounce animation-delay-400"></div>
                <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full border-4 border-white animate-avatar-bounce animation-delay-600"></div>
              </div>
              <Heart className="text-red-400 w-6 h-6 ml-4 animate-heartbeat" />
            </div>
            <p className="text-blue-200 text-lg animate-fade-in-delayed">
              Trusted by schools worldwide
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 py-8 text-center">
        <div className="flex justify-center items-center space-x-6 mb-4">
          <a
            href="https://twitter.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/70 hover:text-white transition-colors duration-200"
            aria-label="Follow us on X (Twitter)"
            data-testid="link-twitter-footer"
          >
            <FaXTwitter className="w-6 h-6" />
          </a>
          <a
            href="https://instagram.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/70 hover:text-white transition-colors duration-200"
            aria-label="Follow us on Instagram"
            data-testid="link-instagram-footer"
          >
            <FaInstagram className="w-6 h-6" />
          </a>
        </div>
        <div className="text-center space-x-4">
          <button className="text-sm text-white/70 hover:text-white">Privacy Policy</button>
          <span className="text-white/50">•</span>
          <button className="text-sm text-white/70 hover:text-white">Terms of Service</button>
        </div>
      </div>
    </div>
  );
}
