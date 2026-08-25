import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, GraduationCap, Star } from "lucide-react";

export default function VerifyEmail() {
  const [location] = useLocation();
  const isSchoolVerification = location.startsWith("/verify-school-email");
  const [, params] = useRoute(isSchoolVerification ? "/verify-school-email/:token" : "/verify-email/:token");
  const [, setLocation] = useLocation();

  const [isVerifying, setIsVerifying] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const verifyEmail = async () => {
      if (!params?.token) {
        setError("Invalid verification link");
        setIsVerifying(false);
        return;
      }

      try {
        const apiEndpoint = isSchoolVerification 
          ? `/api/verify-school-email/${params.token}`
          : `/api/verify-email/${params.token}`;
        
        const response = await fetch(apiEndpoint);
        const data = await response.json();

        if (data.success) {
          setSuccess(true);
          setMessage(data.message);
          
          setTimeout(() => {
            setLocation("/login");
          }, 3000);
        } else {
          setError(data.message || "Verification failed");
        }
      } catch (err) {
        setError("Something went wrong. Please try again.");
      } finally {
        setIsVerifying(false);
      }
    };

    verifyEmail();
  }, [params?.token, setLocation, isSchoolVerification]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-20 left-20 w-32 h-32 bg-white rounded-full opacity-5 animate-float"></div>
          <div className="absolute top-60 right-40 w-24 h-24 bg-white rounded-full opacity-5 animate-float-delayed"></div>
          <div className="absolute bottom-40 left-40 w-20 h-20 bg-white rounded-full opacity-5 animate-float"></div>
          <div className="absolute bottom-20 right-20 w-16 h-16 bg-white rounded-full opacity-5 animate-float-delayed"></div>
        </div>
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden animate-fade-in-up">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-8 text-center">
            <div className="flex items-center justify-center mb-4">
              <div className="relative">
                <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                  <GraduationCap className="text-white w-10 h-10" />
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
                  <Star className="text-yellow-800 w-3 h-3" />
                </div>
              </div>
            </div>
            <h1 className="text-3xl font-bold text-white">Email Verification</h1>
          </div>

          {/* Content */}
          <div className="p-8">
            {isVerifying ? (
              <div className="text-center py-8 animate-pulse">
                <div className="mb-6 flex justify-center">
                  <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center backdrop-blur-sm border-2 border-blue-400/50">
                    <Info className="w-12 h-12 text-blue-400 animate-spin" data-testid="icon-verifying" />
                  </div>
                </div>
                <p className="text-white text-lg">Verifying your email...</p>
              </div>
            ) : success ? (
              <div className="text-center py-8 animate-fade-in">
                <div className="mb-6 flex justify-center">
                  <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center backdrop-blur-sm border-2 border-green-400/50">
                    <Star className="w-12 h-12 text-green-400" data-testid="icon-success" />
                  </div>
                </div>
                <Alert className="bg-green-500/20 border-green-400/50 backdrop-blur-sm mb-6">
                  <AlertDescription className="text-white text-center">
                    {message}
                  </AlertDescription>
                </Alert>
                <p className="text-green-200 text-sm">Redirecting to login page...</p>
              </div>
            ) : (
              <div className="text-center py-8 animate-fade-in">
                <div className="mb-6 flex justify-center">
                  <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center backdrop-blur-sm border-2 border-red-400/50">
                    <Info className="w-12 h-12 text-red-400" data-testid="icon-error" />
                  </div>
                </div>
                <Alert className="bg-red-500/20 border-red-400/50 backdrop-blur-sm mb-6">
                  <AlertDescription className="text-white text-center">
                    {error}
                  </AlertDescription>
                </Alert>
                <Button
                  onClick={() => setLocation("/login")}
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 px-8 py-6 text-lg shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300"
                  data-testid="button-back-to-login"
                >
                  Go to Login
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
