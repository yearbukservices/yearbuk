import { useParams, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import UnifiedDashboard from "@/pages/unified-dashboard";
import StandaloneSchoolProfileWrapper from "@/pages/standalone-school-profile-wrapper";
import PublicViewerProfile from "@/pages/public-viewer-profile";
import { useLocation } from "wouter";

export default function DynamicProfileHandler() {
  const { schoolUsername } = useParams();
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  // Check which tab we're on based on the URL
  const [matchMemories] = useRoute("/:schoolUsername/memories");
  const [matchYearbooks] = useRoute("/:schoolUsername/yearbooks");
  const [matchAlumni] = useRoute("/:schoolUsername/alumni");

  const initialTab = matchYearbooks ? "yearbooks" : matchAlumni ? "alumni" : "memories";

  // Check if the username belongs to a school
  const { data: schoolData, isLoading: schoolLoading, isError: schoolError } = useQuery({
    queryKey: ["/api/schools/by-username", schoolUsername],
    queryFn: async () => {
      const res = await fetch(`/api/schools/by-username/${schoolUsername}`);
      if (!res.ok) throw new Error("Not a school");
      return res.json();
    },
    retry: false,
    enabled: !!schoolUsername,
  });

  // If not a school, check if it's a viewer/user
  const { data: userData, isLoading: userLoading } = useQuery({
    queryKey: ["/api/users/by-username", schoolUsername],
    queryFn: async () => {
      const res = await fetch(`/api/users/by-username/${schoolUsername}`);
      if (!res.ok) throw new Error("Not a user");
      return res.json();
    },
    retry: false,
    enabled: !!schoolUsername && !schoolLoading && !!schoolError,
  });

  const isLoading = authLoading || schoolLoading || (!!schoolError && userLoading);

  if (isLoading) {
    return null;
  }

  // It's a viewer/user profile
  if (schoolError && userData) {
    if (user) {
      // Logged-in: show viewer profile inside the dashboard (with sidebar)
      return <UnifiedDashboard forceViewerProfile={schoolUsername} />;
    } else {
      // Not logged in: show full-page viewer profile with background
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
          <PublicViewerProfile
            username={schoolUsername!}
            onBack={() => setLocation("/search")}
          />
        </div>
      );
    }
  }

  // It's a school profile — use existing school profile layout
  if (user) {
    return <UnifiedDashboard forceSchoolProfile={schoolUsername} initialTab={initialTab} />;
  } else {
    return <StandaloneSchoolProfileWrapper schoolUsername={schoolUsername!} initialTab={initialTab} />;
  }
}
