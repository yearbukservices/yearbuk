import { useLocation } from "wouter";
import { Settings } from "lucide-react";

interface SchoolSettingsTabProps {
  user: any;
}

export default function SchoolSettingsTab({ user }: SchoolSettingsTabProps) {
  const [, setLocation] = useLocation();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-white">Settings</h1>
      </div>
      
      <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Settings className="h-6 w-6 text-white" />
          <h2 className="text-xl font-semibold text-white">School Account Settings</h2>
        </div>
        <p className="text-white/80 mb-6">
          Manage your school account settings, security preferences, and contact information.
        </p>
        <button
          onClick={() => setLocation("/school-settings")}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors"
          data-testid="button-go-to-settings"
        >
          Go to Settings
        </button>
      </div>
    </div>
  );
}
