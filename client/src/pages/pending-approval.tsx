import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Shield, CheckCircle } from "lucide-react";
import logoImage from "@assets/logo_background_null.png";

export default function PendingApprovalPage() {
  const [, setLocation] = useLocation();

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
              <div className="rounded-full bg-amber-500/10 p-3">
                <Clock className="h-8 w-8 text-amber-400" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-white">
              Pending Approval
            </CardTitle>
            <CardDescription className="text-gray-300 text-base">
              Your account has been verified but is awaiting approval by our moderation team.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="space-y-4">
              {/* Status Steps */}
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    <CheckCircle className="h-5 w-5 text-green-400" />
                  </div>
                  <div>
                    <h4 className="text-white font-medium">Email Verified</h4>
                    <p className="text-sm text-gray-400">Your email has been successfully verified.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    <Clock className="h-5 w-5 text-amber-400" />
                  </div>
                  <div>
                    <h4 className="text-white font-medium">Pending Review</h4>
                    <p className="text-sm text-gray-400">
                      Our team is currently reviewing your registration documents.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    <Shield className="h-5 w-5 text-gray-500" />
                  </div>
                  <div>
                    <h4 className="text-gray-400 font-medium">Account Activation</h4>
                    <p className="text-sm text-gray-500">
                      You'll receive access once approved.
                    </p>
                  </div>
                </div>
              </div>

              {/* Information Box */}
              <div className="mt-6 p-4 bg-blue-500/5 rounded-lg border border-blue-500/20">
                <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-400" />
                  What happens next?
                </h4>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-1">•</span>
                    <span>Our moderation team will review your school registration within 3-5 business days.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-1">•</span>
                    <span>You'll receive an email notification once your account is approved or if we need additional information.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-1">•</span>
                    <span>Once approved, you can log in and start managing your school's yearbooks and memories.</span>
                  </li>
                </ul>
              </div>

              {/* Actions */}
              <div className="space-y-3 pt-4">
                <Button
                  onClick={() => setLocation("/login")}
                  className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white"
                  data-testid="button-back-to-login"
                >
                  Back to Login
                </Button>

                <div className="text-center">
                  <p className="text-sm text-gray-400">
                    Need help?{" "}
                    <a 
                      href="mailto:support@yearbuk.com" 
                      className="text-blue-400 hover:text-blue-300 underline"
                      data-testid="link-contact-support"
                    >
                      Contact Support
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
