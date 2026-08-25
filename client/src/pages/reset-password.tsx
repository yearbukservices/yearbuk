import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, XCircle, GraduationCap, Star, LockKeyhole } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/reset-password/:token");
  const token = params?.token || "";
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccess(false);

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long");
      setIsLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    try {
      await apiRequest("POST", "/api/auth/reset-password", { token, newPassword });
      setSuccess(true);
      window.setTimeout(() => setLocation("/login"), 2500);
    } catch (resetError: any) {
      const errorText = await resetError.response?.text();
      let errorData: { message?: string } = {};
      try {
        errorData = errorText ? JSON.parse(errorText) : {};
      } catch {
        errorData = {};
      }
      setError(errorData.message || "Failed to reset password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-20 left-20 w-32 h-32 bg-white rounded-full opacity-5 animate-float" />
          <div className="absolute top-60 right-40 w-24 h-24 bg-white rounded-full opacity-5 animate-float-delayed" />
          <div className="absolute bottom-40 left-40 w-20 h-20 bg-white rounded-full opacity-5 animate-float" />
          <div className="absolute bottom-20 right-20 w-16 h-16 bg-white rounded-full opacity-5 animate-float-delayed" />
        </div>
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden animate-fade-in-up">
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-8 text-center">
            <div className="flex items-center justify-center mb-4">
              <div className="relative">
                <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                  {token ? (
                    <LockKeyhole className="text-white w-10 h-10" />
                  ) : (
                    <GraduationCap className="text-white w-10 h-10" />
                  )}
                </div>
  
              </div>
            </div>
            <h1 className="text-3xl font-bold text-white">Reset Your Password</h1>
            <p className="text-blue-100 mt-2">Create a new password for your Yearbuk account</p>
          </div>

          <div className="p-8">
            {!token ? (
              <div className="text-center py-4 animate-fade-in">
                <div className="mb-6 flex justify-center">
                  <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center backdrop-blur-sm border-2 border-red-400/50">
                    <XCircle className="w-12 h-12 text-red-400" />
                  </div>
                </div>
                <Alert variant="destructive" className="bg-red-500/20 border-red-400/50 backdrop-blur-sm mb-6">
                  <AlertDescription className="text-white text-center">
                    Invalid reset link. Please request a new password reset.
                  </AlertDescription>
                </Alert>
                <Button
                  onClick={() => setLocation("/login")}
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 px-8 py-6 text-lg shadow-xl transition-all duration-300"
                  data-testid="button-back-to-login"
                >
                  Back to Login
                </Button>
              </div>
            ) : success ? (
              <div className="text-center py-4 animate-fade-in">
                <div className="mb-6 flex justify-center">
                  <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center backdrop-blur-sm border-2 border-green-400/50">
                    <CheckCircle2 className="w-12 h-12 text-green-400" />
                  </div>
                </div>
                <Alert className="bg-green-500/20 border-green-400/50 backdrop-blur-sm mb-6">
                  <AlertDescription className="text-white text-center">
                    Password reset successful! Redirecting to login...
                  </AlertDescription>
                </Alert>
                <p className="text-green-200 text-sm">You can now sign in with your new password.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5 animate-fade-in">
                {error && (
                  <Alert variant="destructive" className="bg-red-500/20 border-red-400/50 backdrop-blur-sm" data-testid="alert-error">
                    <AlertDescription className="text-white">{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="text-white">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="Enter new password"
                    autoComplete="new-password"
                    className="bg-white/10 border-white/20 text-white placeholder:text-blue-100/60 focus:border-blue-300 focus:ring-blue-300/30"
                    data-testid="input-new-password"
                  />
                  <p className="text-xs text-blue-100/80">Must be at least 6 characters</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-white">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="Confirm new password"
                    autoComplete="new-password"
                    className="bg-white/10 border-white/20 text-white placeholder:text-blue-100/60 focus:border-blue-300 focus:ring-blue-300/30"
                    data-testid="input-confirm-password"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 py-6 text-base shadow-xl transition-all duration-300"
                  disabled={isLoading}
                  data-testid="button-reset-password"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Resetting Password...
                    </>
                  ) : (
                    "Reset Password"
                  )}
                </Button>

                <div className="text-center">
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => setLocation("/login")}
                    className="text-blue-200 hover:text-white"
                    data-testid="link-back-to-login"
                  >
                    Back to Login
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}