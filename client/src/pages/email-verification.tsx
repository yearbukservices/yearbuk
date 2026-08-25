import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Mail, CheckCircle, Clock } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import logoImage from "@assets/logo_background_null.png";

export default function EmailVerificationPage() {
  const [, setLocation] = useLocation();
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [cooldownTime, setCooldownTime] = useState(0);
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState("");

  const maskEmail = (email: string) => {
    const [localPart, domain] = email.split("@");
    if (!localPart || !domain) return email;

    const visibleCharacters = localPart.slice(0, 2);
    return `${visibleCharacters}${"*".repeat(Math.max(6, localPart.length - 2))}@${domain}`;
  };

  useEffect(() => {
    // Get user info from URL params (persists across page refreshes)
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get("email");
    const userIdParam = params.get("userId");
    
    if (emailParam) setUserEmail(emailParam);
    if (userIdParam) setUserId(userIdParam);
  }, []);

  useEffect(() => {
    // Countdown timer for cooldown
    if (cooldownTime > 0) {
      const timer = setTimeout(() => {
        setCooldownTime(cooldownTime - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldownTime]);

  const handleResendVerification = async () => {
    if (!userId) {
      setError("User information not found. Please try logging in again.");
      return;
    }

    setIsResending(true);
    setError("");
    setSuccess(false);

    try {
      const response = await apiRequest("POST", "/api/resend-verification", {
        userId,
      });

      const data = await response.json();
      setSuccess(true);
      setCooldownTime(50); // Start 50-second cooldown
    } catch (err: any) {
      const errorText = await err.response?.text();
      let errorData;
      try {
        errorData = errorText ? JSON.parse(errorText) : {};
      } catch {
        errorData = {};
      }

      if (errorData.remainingTime) {
        setCooldownTime(errorData.remainingTime);
        setError(errorData.message);
      } else {
        setError(errorData.message || "Failed to resend verification email. Please try again.");
      }
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-indigo-950 to-purple-950 dark:from-gray-950 dark:via-blue-950 dark:to-indigo-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img 
            src={logoImage} 
            alt="Yearbuk Logo" 
            className="h-20 w-auto"
          />
        </div>

        <Card className="border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-blue-500/10 p-3">
                <Mail className="h-8 w-8 text-blue-400" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-white">
              Email Verification
            </CardTitle>
            <CardDescription className="text-gray-300">
              A verification link was sent to{" "}
               <span className="font-semibold text-blue-300">
                 {userEmail ? maskEmail(userEmail) : "your email"}
               </span>.
              <br />
              Please check your inbox to continue.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive" className="border-red-500/50 bg-red-500/10">
                <AlertDescription className="text-red-200">{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="border-green-500/50 bg-green-500/10">
                <CheckCircle className="h-4 w-4 text-green-400" />
                <AlertDescription className="text-green-200">
                  Verification email sent successfully! Please check your inbox.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-4 pt-4">
              <Button
                onClick={handleResendVerification}
                disabled={isResending || cooldownTime > 0}
                className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white"
                data-testid="button-resend-verification"
              >
                {isResending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : cooldownTime > 0 ? (
                  <>
                    <Clock className="mr-2 h-4 w-4" />
                    Resend in {cooldownTime}s
                  </>
                ) : (
                  "Resend Verification Link"
                )}
              </Button>

              <div className="text-center">
                <Button
                  variant="link"
                  onClick={() => setLocation("/login")}
                  className="text-blue-300 hover:text-blue-200"
                  data-testid="link-back-to-login"
                >
                  Back to Login
                </Button>
              </div>
            </div>

            <div className="mt-6 p-4 bg-blue-500/5 rounded-lg border border-blue-500/20">
              <p className="text-sm text-gray-300 text-center">
                <strong className="text-white">Tip:</strong> Check your spam folder if you don't see the email.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
