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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { KeyRound } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export function PasswordChangeDialog() {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRequestReset = async () => {
    setError("");

    let accountEmail = "";
    try {
      const stored = localStorage.getItem("user");
      if (stored) accountEmail = (JSON.parse(stored)?.email || "").toLowerCase().trim();
    } catch {}

    if (!accountEmail) {
      setError("You must be signed in to request a password change.");
      return;
    }

    setIsLoading(true);

    try {
      await apiRequest("POST", "/api/auth/request-password-reset", {
        email: accountEmail,
      });
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

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      void handleRequestReset();
    } else {
      setError("");
    }
  };

  const handleClose = () => {
    setOpen(false);
    setError("");
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
            A password reset link has been sent to your registered email address. Please check your inbox and follow the instructions to update your credentials.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {isLoading && (
            <p className="text-sm text-white/70">Sending password reset link...</p>
          )}
          {error && (
            <Alert variant="destructive" data-testid="alert-error">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            data-testid="button-cancel"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
