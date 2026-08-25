import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Shield, Mail } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import logoImage from "@assets/logo_background_null.png";

export default function TwoFactorAuthPage() {
  const [, setLocation] = useLocation();
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [userId, setUserId] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");

  useEffect(() => {
    // Get userId from session storage (set during login)
    const pendingUserId = sessionStorage.getItem("pending2FAUserId");
    const email = sessionStorage.getItem("pending2FAEmail");
    
    if (!pendingUserId || !email) {
      setLocation("/login");
      return;
    }
    
    setUserId(pendingUserId);
    setMaskedEmail(maskEmail(email));
  }, [setLocation]);

  useEffect(() => {
    if (cooldownSeconds > 0) {
      const timer = setTimeout(() => setCooldownSeconds(cooldownSeconds - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldownSeconds]);

  const maskEmail = (email: string): string => {
    const [local, domain] = email.split("@");
    if (local.length <= 2) {
      return `${local[0]}******@${domain}`;
    }
    return `${local.substring(0, 2)}******${local[local.length - 1]}@${domain}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await apiRequest("POST", "/api/auth/verify-2fa", {
        userId,
        code: code.trim(),
      });

      const data = await response.json();
      
      // Clear session storage
      sessionStorage.removeItem("pending2FAUserId");
      sessionStorage.removeItem("pending2FAEmail");
      
      // Clear any existing user data before storing new user
      localStorage.removeItem("user");
      localStorage.removeItem("superAdminToken");
      
      // Store user data in localStorage
      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("superAdminToken", data.user.id);
      
      // Dispatch custom event to notify CurrencyContext of user change
      window.dispatchEvent(new Event('userChanged'));

      setSuccess("Verification successful! Redirecting...");
      setTimeout(() => {
        setLocation("/super-admin");
      }, 1000);
    } catch (error: any) {
      const errorText = await error.response?.text();
      let errorData;
      try {
        errorData = errorText ? JSON.parse(errorText) : {};
      } catch {
        errorData = {};
      }
      setError(errorData.message || "Invalid verification code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setIsResending(true);
    setError("");
    setSuccess("");

    try {
      const response = await apiRequest("POST", "/api/auth/resend-2fa", {
        userId,
      });

      const data = await response.json();
      setSuccess("A new verification code has been sent to your email.");
      setCooldownSeconds(50); // 50-second cooldown
      setCode(""); // Clear the code field
    } catch (error: any) {
      const errorText = await error.response?.text();
      let errorData;
      try {
        errorData = errorText ? JSON.parse(errorText) : {};
      } catch {
        errorData = {};
      }
      setError(errorData.message || "Failed to resend code. Please try again.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 p-12 flex-col justify-center items-center text-white">
        <div className="max-w-md space-y-8">
          <div className="flex items-center gap-3 mb-8">
            <img src={logoImage} alt="Yearbuk Logo" className="h-16 w-16" />
            <h1 className="text-4xl font-bold text-white">Yearbuk</h1>
          </div>
          
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <Shield className="h-8 w-8 text-blue-300 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-xl font-semibold mb-2">Two-Factor Authentication</h3>
                <p className="text-blue-200">
                  Enhanced security for super admin access. Your account is protected with an additional verification step.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <Mail className="h-8 w-8 text-blue-300 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-xl font-semibold mb-2">Email Verification</h3>
                <p className="text-blue-200">
                  A secure 6-digit code has been sent to your registered email address.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - 2FA Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-white bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full mb-4">
              <Shield className="h-8 w-8 text-blue-600 dark:text-blue-300" />
            </div>
            <h2 className="text-3xl font-bold text-white">Verify Your Identity</h2>
            <p className="mt-2 text-white">
              A 6-digit verification code has been sent to
            </p>
            <p className="font-semibold text-white mt-1">
              {maskedEmail}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="code" className="text-white">
                Verification Code
              </Label>
              <Input
                id="code"
                data-testid="input-2fa-code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="Enter 6-digit code"
                maxLength={6}
                required
                className="mt-1 text-center text-2xl tracking-widest"
                autoFocus
              />
              <p className="text-xs text-white">
                Code expires in 5 minutes
              </p>
            </div>

            {error && (
              <Alert variant="destructive" data-testid="alert-error">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="bg-green-50 dark:bg-green-900/20 text-green-800 border-green-200" data-testid="alert-success">
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              data-testid="button-verify-2fa"
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              disabled={isLoading || code.length !== 6}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify Code"
              )}
            </Button>

            <div className="text-center">
              <Button
                type="button"
                data-testid="button-resend-2fa"
                variant="link"
                onClick={handleResendCode}
                disabled={isResending || cooldownSeconds > 0}
                className="text-blue-600 dark:text-blue-400"
              >
                {isResending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resending...
                  </>
                ) : cooldownSeconds > 0 ? (
                  `Resend Code (${cooldownSeconds}s)`
                ) : (
                  "Resend Code"
                )}
              </Button>
            </div>

            <div className="text-center">
              <Button
                type="button"
                data-testid="link-back-to-login"
                variant="link"
                onClick={() => {
                  sessionStorage.removeItem("pending2FAUserId");
                  sessionStorage.removeItem("pending2FAEmail");
                  setLocation("/login");
                }}
                className="text-white"
              >
                Back to Login
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
