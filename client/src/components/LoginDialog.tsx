import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Camera } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { ForgotPasswordDialog } from "@/components/ForgotPasswordDialog";

interface LoginDialogProps {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  redirectContext?: {
    intent: string;
    schoolId?: string;
  };
}

export function LoginDialog({ children, open, onOpenChange, redirectContext }: LoginDialogProps) {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await apiRequest("POST", "/api/auth/login", {
        username,
        password,
        redirectContext,
      });

      const data = await response.json();
      
      if (data.requires2FA) {
        sessionStorage.setItem("pending2FAUserId", data.userId);
        sessionStorage.setItem("pending2FAEmail", data.email);
        setLocation("/two-factor-auth");
        return;
      }
      
      localStorage.removeItem("user");
      localStorage.removeItem("superAdminToken");
      localStorage.setItem("user", JSON.stringify(data.user));
      window.dispatchEvent(new Event('userChanged'));

      if (data.redirectTo) {
        if (data.user.userType === "super_admin" || data.user.role === "super_admin") {
          localStorage.setItem("superAdminToken", data.user.id);
        }
        setLocation(data.redirectTo);
        onOpenChange?.(false);
      }
    } catch (error: any) {
      const errorText = await error.response?.text();
      let errorData;
      try {
        errorData = errorText ? JSON.parse(errorText) : {};
      } catch {
        errorData = {};
      }

      if (errorData.emailNotVerified && errorData.redirectTo && errorData.email && errorData.userId) {
        const params = new URLSearchParams({
          email: errorData.email,
          userId: errorData.userId
        });
        setLocation(`${errorData.redirectTo}?${params.toString()}`);
        return;
      }

      if (errorData.pendingApproval && errorData.redirectTo) {
        setLocation(errorData.redirectTo);
        return;
      }

      setError(errorData.message || "Invalid credentials. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-md bg-gradient-to-br from-slate-900/95 via-blue-900/95 to-indigo-900/95 border-white/20 text-white backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="text-3xl font-bold text-center">Welcome Back</DialogTitle>
          <DialogDescription className="text-blue-100/80 text-center">
            Sign in to access your portal
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="username" className="text-white/100">
              Username or Email
            </Label>
            <Input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="border-2 border-gray-200 hover:border-blue-300 focus:border-blue-500 bg-white/10 text-white"
              data-testid="input-username"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-white">
              Password
            </Label>
            <Input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="border-2 border-gray-200 hover:border-blue-300 focus:border-blue-500 bg-white/10 text-white"
              data-testid="input-password"
            />
            <div className="flex justify-end">
              <ForgotPasswordDialog />
            </div>
          </div>

          <Button 
            type="submit" 
            disabled={isLoading} 
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold"
            data-testid="button-sign-in"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing In...
              </>
            ) : (
              "Sign In to Your Portal"
            )}
          </Button>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </form>

        <div className="mt-4 text-center space-y-3 border-t border-white/10 pt-4">
          <p className="text-sm text-white">
            Don't have an account?{" "}
            <Button
              variant="link"
              className="p-0 h-auto text-blue-400 hover:text-blue-300 font-semibold"
              onClick={() => {
                setLocation("/signup");
                onOpenChange?.(false);
              }}
              data-testid="link-signup"
            >
              Sign up here
            </Button>
          </p>
          <div className="pt-2">
            <p className="text-sm text-white/80 mb-2">
              Want to share a memory?
            </p>
            <Button
              variant="outline"
              className="bg-white/10 hover:bg-white/20 text-white border-white/30"
              onClick={() => {
                setLocation("/guest-upload");
                onOpenChange?.(false);
              }}
              data-testid="button-upload-memory"
            >
              <Camera className="w-4 h-4 mr-2" />
              Upload Memory
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
