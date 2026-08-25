import { Loader2 } from "lucide-react";
import logoImage from "@assets/logo_background_null.png";

export default function LoadingSplash() {
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center z-50">
      <div className="flex flex-col items-center gap-6">
        <img 
          src={logoImage} 
          alt="Waibuk Logo" 
          className="w-32 h-32 object-contain animate-pulse"
        />
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    </div>
  );
}
