import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, KeyRound, CheckCircle2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export function PasswordChangeDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    const enteredEmail = email.toLowerCase().trim();
    let accountEmail = "";
    try {
      const stored = localStorage.getItem("user");
      if (stored) accountEmail = (JSON.parse(stored)?.email || "").toLowerCase().trim();
    } catch {}

    if (!accountEmail) {
      setError("You must be signed in to request a password change.");
      return;
    }

    if (enteredEmail !== accountEmail) {
      setError("This email doesn't match your account email.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiRequest("POST", "/api/auth/request-password-reset", {
        email: enteredEmail,
      });

      const data = await response.json();
      setSuccess(true);
      setEmail("");
      
      setTimeout(() => {
        setOpen(false);
        setSuccess(false);
      }, 3000);
    } catch (error: any) {
      const errorText = await error.response?.text();
      let errorData;
      try {
        errorData = errorText ? JSON.parse(errorText) : {};
      } catch {
        errorData = {};
      }
      setError(errorData.message || "Failed to send password reset email");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setOpen(false);
      setEmail("");
      setError("");
      setSuccess(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="text-white bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl"
          data-testid="button-request-password-change"
        >
          <KeyRound className="h-4 w-4 mr-2" />
          Request Password Change
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl text-white">
        <DialogHeader>
          <DialogTitle>Change Password</DialogTitle>
          <DialogDescription className="text-white">
            Enter your email address and we'll send you a secure link to reset your password.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              We've sent a password reset link to your email. Please check your inbox to continue.
            </AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={handleRequestReset}>
            <div className="space-y-4 py-4">
              {error && (
                <Alert variant="destructive" data-testid="alert-error">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="reset-email">Email Address</Label>
                <Input
                  className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl "
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder=""
                  required
                  disabled={isLoading}
                  data-testid="input-reset-email"
                />
                <p className="text-xs text-muted-foreground text-white">
                  The reset link will expire in 30 minutes
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isLoading}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                data-testid="button-send-reset-link"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send Reset Link"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
