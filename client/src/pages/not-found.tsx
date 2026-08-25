import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-20" />
      
      <Card className="w-full max-w-md mx-4 bg-white/10 backdrop-blur-lg border-white/20 shadow-2xl relative z-10" data-testid="card-not-found">
        <CardContent className="pt-8 pb-6 px-6">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="rounded-full bg-red-500/20 p-4 backdrop-blur-sm">
              <AlertCircle className="h-12 w-12 text-red-400" data-testid="icon-alert" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-4xl font-bold text-white" data-testid="text-404">404</h1>
              <h2 className="text-xl font-semibold text-white/90" data-testid="text-title">Page Not Found</h2>
              <p className="text-sm text-white/70" data-testid="text-description">
                The page you're looking for doesn't exist or has been moved.
              </p>
            </div>

            <Link href="/login">
              <Button 
                className="mt-4 bg-blue-600 hover:bg-blue-700 text-white gap-2"
                data-testid="button-back-login"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
