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
import { Loader2, KeyRound, CheckCircle2, Mail } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export function ForgotPasswordDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccess(false);

    try {
      const response = await apiRequest("POST", "/api/auth/request-password-reset", {
        email: email.toLowerCase().trim(),
      });

      const data = await response.json();
      setSuccess(true);
      setEmail("");
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
          variant="link" 
          className="text-blue-300 hover:text-blue-200 p-0 h-auto font-normal text-sm"
          data-testid="link-forgot-password"
        >
          Forgot your password?
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white">Reset Your Password</DialogTitle>
          <DialogDescription className="text-slate-300">
            Enter your email address and we'll send you a secure link to reset your password.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <>
            <Alert className="bg-green-900/30 border-green-700">
              <CheckCircle2 className="h-4 w-4 text-green-400" />
              <AlertDescription className="text-green-200">
                If this email is associated with a Yearbuk account, you'll receive a password reset link shortly. Please check your inbox.
              </AlertDescription>
            </Alert>
            <DialogFooter>
              <Button
                type="button"
                onClick={handleClose}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                data-testid="button-close-success"
              >
                Close
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleRequestReset}>
            <div className="space-y-4 py-4">
              {error && (
                <Alert variant="destructive" className="bg-red-900/30 border-red-700" data-testid="alert-error">
                  <AlertDescription className="text-red-200">{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="forgot-email" className="text-white">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="forgot-email"
                    name="forgot-password-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    disabled={isLoading}
                    autoComplete="off"
                    className="pl-10 bg-slate-800 border-slate-600 text-white placeholder:text-slate-400"
                    data-testid="input-forgot-email"
                  />
                </div>
                
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isLoading}
                className="bg-slate-800 border-slate-600 text-white hover:bg-slate-700"
                data-testid="button-cancel-forgot"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                data-testid="button-send-reset-link"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <KeyRound className="mr-2 h-4 w-4" />
                    Send Reset Link
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
