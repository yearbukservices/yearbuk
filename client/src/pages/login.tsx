import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, GraduationCap, BookOpen, Users, Camera, Star, Shield, Heart } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { ForgotPasswordDialog } from "@/components/ForgotPasswordDialog";
import logoImage from "@assets/tab_logo_good.png";
import { FaXTwitter, FaInstagram } from "react-icons/fa6";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState("");
  const [emailNotVerified, setEmailNotVerified] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [unverifiedUserId, setUnverifiedUserId] = useState("");
  const [resendSuccess, setResendSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setEmailNotVerified(false);
    setResendSuccess(false);

    try {
      const response = await apiRequest("POST", "/api/auth/login", {
        username,
        password,
      });

      const data = await response.json();
      
      // Check if 2FA is required
      if (data.requires2FA) {
        // Store pending 2FA info in session storage
        sessionStorage.setItem("pending2FAUserId", data.userId);
        sessionStorage.setItem("pending2FAEmail", data.email);
        setLocation("/two-factor-auth");
        return;
      }
      
      // Clear any existing user data before storing new user
      localStorage.removeItem("user");
      localStorage.removeItem("superAdminToken");
      
      // Store user data in localStorage
      localStorage.setItem("user", JSON.stringify(data.user));
      
      // Dispatch custom event to notify CurrencyContext of user change
      window.dispatchEvent(new Event('userChanged'));

      // Backend handles redirection based on user role
      if (data.redirectTo) {
        if (data.user.userType === "super_admin" || data.user.role === "super_admin") {
          localStorage.setItem("superAdminToken", data.user.id);
        }
        setLocation(data.redirectTo);
      }
    } catch (error: any) {
      const errorText = await error.response?.text();
      let errorData;
      try {
        errorData = errorText ? JSON.parse(errorText) : {};
      } catch {
        errorData = {};
      }

      // Handle email verification redirect
      if (errorData.emailNotVerified && errorData.redirectTo && errorData.email && errorData.userId) {
        // Pass email and userId as URL params to persist across page refreshes
        setUnverifiedUserId(errorData.userId);
        const params = new URLSearchParams({
          email: errorData.email,
          userId: errorData.userId
        });
        setLocation(`${errorData.redirectTo}?${params.toString()}`);
        return;
      }

      // Handle pending approval redirect
      if (errorData.pendingApproval && errorData.redirectTo) {
        setLocation(errorData.redirectTo);
        return;
      }

      setError(errorData.message || "Invalid credentials. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setIsResending(true);
    setError("");
    setResendSuccess(false);

    try {
      const response = await apiRequest("POST", "/api/resend-verification", {
        userId: unverifiedUserId,
      });

      const data = await response.json();
      setResendSuccess(true);
      setError("");
    } catch (error: any) {
      setError("Failed to resend verification email. Please try again.");
    } finally {
      setIsResending(false);
    }
  };


  return (
    <div className="login-form-page min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex flex-col lg:flex-row relative overflow-hidden">
      {/* Animated Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-20 left-20 w-32 h-32 bg-white rounded-full opacity-5 animate-float"></div>
          <div className="absolute top-60 right-40 w-24 h-24 bg-white rounded-full opacity-5 animate-float-delayed"></div>
          <div className="absolute bottom-40 left-40 w-20 h-20 bg-white rounded-full opacity-5 animate-float"></div>
          <div className="absolute bottom-20 right-20 w-16 h-16 bg-white rounded-full opacity-5 animate-float-delayed"></div>
        </div>
      </div>

      {/* Left Content Panel - Hidden on mobile, shown on desktop */}
      <div className="hidden lg:flex flex-1 items-center justify-center p-8 relative z-10">
        <div className="max-w-lg animate-fade-in-up">
          {/* Main Brand Section */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center mb-6">
              <div className="relative ">
                <div className="w-24 h-24 rounded-full flex items-center justify-center shadow-2xl overflow-hidden">
                  <img 
                    src={logoImage} 
                    alt="Waibuk Logo" 
                    className="w-full h-full object-cover scale-110 origin-top"
                  />
                </div>
                
              </div>
            </div>
            <h1 className="text-5xl font-bold text-white mb-4 tracking-tight">
              Yearbuk
            </h1>
            <p className="text-xl text-blue-100 leading-relaxed mb-8 animate-fade-in-delayed">
              Where School Memories Live Forever
            </p>
          </div>

          {/* Feature Highlights */}
          <div className="grid grid-cols-2 gap-6 mb-12">
            <div className="text-center animate-slide-in-left hover:scale-105 transition-transform duration-300">
              <div className="w-16 h-16 bg-blue-500/20 rounded-xl flex items-center justify-center mx-auto mb-3 backdrop-blur-sm border border-blue-400/30 hover:bg-blue-500/30 hover:border-blue-300/50 transition-all duration-300">
                <BookOpen className="text-blue-300 w-8 h-8 hover:text-blue-200 transition-colors" />
              </div>
              <h3 className="text-white font-semibold mb-1">Digital Yearbooks</h3>
              <p className="text-blue-200 text-sm">Beautiful, interactive school memories</p>
            </div>
            <div className="text-center animate-slide-in-right hover:scale-105 transition-transform duration-300 animation-delay-200">
              <div className="w-16 h-16 bg-purple-500/20 rounded-xl flex items-center justify-center mx-auto mb-3 backdrop-blur-sm border border-purple-400/30 hover:bg-purple-500/30 hover:border-purple-300/50 transition-all duration-300">
                <Users className="text-purple-300 w-8 h-8 hover:text-purple-200 transition-colors" />
              </div>
              <h3 className="text-white font-semibold mb-1">Alumni Network</h3>
              <p className="text-blue-200 text-sm">Connect with classmates worldwide</p>
            </div>
            <div className="text-center animate-slide-in-left hover:scale-105 transition-transform duration-300 animation-delay-400">
              <div className="w-16 h-16 bg-green-500/20 rounded-xl flex items-center justify-center mx-auto mb-3 backdrop-blur-sm border border-green-400/30 hover:bg-green-500/30 hover:border-green-300/50 transition-all duration-300">
                <Camera className="text-green-300 w-8 h-8 hover:text-green-200 transition-colors" />
              </div>
              <h3 className="text-white font-semibold mb-1">Memory Discovery</h3>
              <p className="text-blue-200 text-sm">View, discover, and even upload school moments</p>
            </div>
            <div className="text-center animate-slide-in-right hover:scale-105 transition-transform duration-300 animation-delay-600">
              <div className="w-16 h-16 bg-red-500/20 rounded-xl flex items-center justify-center mx-auto mb-3 backdrop-blur-sm border border-red-400/30 hover:bg-red-500/30 hover:border-red-300/50 transition-all duration-300">
                <Shield className="text-red-300 w-8 h-8 hover:text-red-200 transition-colors" />
              </div>
              <h3 className="text-white font-semibold mb-1">Safe & Secure</h3>
              <p className="text-blue-200 text-sm">Protected educational environment</p>
            </div>
          </div>

          {/* Social Proof */}
          <div className="text-center animate-fade-in-up animation-delay-800">
            <div className="flex items-center justify-center mb-3">
              <div className="flex -space-x-2">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full border-2 border-white animate-avatar-bounce animation-delay-200"></div>
                <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-blue-500 rounded-full border-2 border-white animate-avatar-bounce animation-delay-400"></div>
                <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full border-2 border-white animate-avatar-bounce animation-delay-600"></div>
              </div>
              <Heart className="text-red-400 w-5 h-5 ml-3 animate-heartbeat" />
            </div>
            <p className="text-blue-200 text-sm animate-fade-in-delayed">
              Trusted by schools worldwide
            </p>
          </div>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-center py-8 px-4 relative z-10">
        <div className="text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full flex items-center justify-center shadow-2xl overflow-hidden">
                <img 
                  src={logoImage} 
                  alt="Waibuk Logo" 
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">
            Yearbuk
          </h1>
          <p className="text-blue-100 text-sm">
            Where School Memories Live Forever
          </p>
        </div>
      </div>

      {/* Login Panel - Full width on mobile, right panel on desktop */}
      <div className="flex-1 lg:w-full lg:max-w-md bg-black/50 backdrop-blur-sm shadow-2xl flex items-center justify-center relative z-10 animate-slide-in-right backdrop-blur-lg ">
        <div className="w-full px-6 pt-2 pb-6 sm:p-6 lg:p-8 max-w-md sm:max-w-md mx-auto">
          {/* Login Header */}
          <div className="text-center mb-8 sm:mb-8 animate-fade-in-up">
            <h3 className="text-5xl sm:text-4xl font-bold text-white mb-4 tracking-wide">Welcome</h3>
            <p className="text-base sm:text-base text-blue-100/80 font-semibold tracking-wider">Sign in to access your portal</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            {/* Username Field */}
            <div className="space-y-2">
              <Label htmlFor="username" className="block text-sm font-semibold text-white/100">
                Username or Email
              </Label>
              <Input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder=""
                className="w-full h-10 sm:h-12 border-2 border-gray-200 hover:border-blue-300 focus:border-blue-500 transition-colors duration-200 rounded-lg text-sm sm:text-base bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/60"
                data-testid="input-username"
              />
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="block text-sm font-semibold text-white">
                  Password
                </Label>
                <ForgotPasswordDialog />
              </div>
              <Input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder=""
                className="w-full h-10 sm:h-12 border-2 border-gray-200 hover:border-blue-300 focus:border-blue-500 transition-colors duration-200 rounded-lg text-sm sm:text-base bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/60"
                data-testid="input-password"
              />
            </div>

            {/* Login Button */}
            <Button 
              type="submit" 
              disabled={isLoading} 
              className="w-full h-10 sm:h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-sm sm:text-base shadow-lg transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none rounded-lg"
              data-testid="button-sign-in"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                  Signing In...
                </>
              ) : (
                "Sign In to Your Portal"
              )}
            </Button>

            {/* Error Message */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* TEMPORARY: Email verification disabled during development */}
            {/* Success Message for Resend */}
            {/* {resendSuccess && (
              <Alert className="bg-green-500/20 border-green-400/50 backdrop-blur-sm">
                <AlertDescription className="text-white">
                  Verification email sent! Please check your inbox.
                </AlertDescription>
              </Alert>
            )} */}

            {/* Resend Verification Button */}
            {/* {emailNotVerified && !resendSuccess && (
              <Button
                type="button"
                onClick={handleResendVerification}
                disabled={isResending}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-semibold"
                data-testid="button-resend-verification"
              >
                {isResending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Resend Verification Email"
                )}
              </Button>
            )} */}
          </form>

          {/* Signup Link */}
          <div className="mt-8 text-center space-y-3">
            <p className="text-sm text-white">
              Don't have an account?{" "}
              <Button
                variant="link"
                className="p-0 h-auto text-blue-600 hover:text-blue-800 font-semibold"
                onClick={() => setLocation("/signup")}
                data-testid="link-signup"
              >
                Sign up here
              </Button>
            </p>
            <div className="pt-2 border-t border-white/10">
              <p className="text-sm text-white/80 mb-2">
                Want to share a memory?
              </p>
              <Button
                variant="outline"
                className="bg-white/10 hover:bg-white/20 text-white border-white/30 hover:border-white/50 transition-all"
                onClick={() => setLocation("/guest-upload")}
                data-testid="button-upload-memory"
              >
                <Camera className="w-4 h-4 mr-2" />
                Upload Memory
              </Button>
            </div>
          </div>

          {/* Footer Links */}
          <div className="mt-6 text-center space-x-4">
            <button className="text-xs text-white hover:text-white">Privacy Policy</button>
            <span className="text-gray-300">•</span>
            <button className="text-xs text-white hover:text-white">Terms of Service</button>
          </div>

          {/* Social Media Icons */}
          <div className="mt-6 flex justify-center items-center space-x-4">
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/70 hover:text-white transition-colors duration-200"
              aria-label="Follow us on X (Twitter)"
              data-testid="link-twitter"
            >
              <FaXTwitter className="w-5 h-5" />
            </a>
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/70 hover:text-white transition-colors duration-200"
              aria-label="Follow us on Instagram"
              data-testid="link-instagram"
            >
              <FaInstagram className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
