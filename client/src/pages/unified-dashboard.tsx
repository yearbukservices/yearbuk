import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { DashboardLayout } from "@/components/DashboardLayout";
import DashboardHome from "@/pages/dashboard/home";
import SearchPage from "@/pages/dashboard/search-page";
import LibraryPage from "@/pages/dashboard/library";
import ProfilePage from "@/pages/dashboard/profile";
import MemoryUploadPage from "@/pages/dashboard/memory-upload";
import SchoolDashboardHome from "@/pages/school-dashboard-tabs/home";
import SchoolYearbooks from "@/pages/school-dashboard-tabs/yearbooks";
import SchoolMemories from "@/pages/school-dashboard-tabs/memories";
import SchoolOrders from "@/pages/school-dashboard-tabs/orders";
import SchoolSettingsTab from "@/pages/school-dashboard-tabs/settings";
import SchoolAlumni from "@/pages/school-dashboard-tabs/alumni";
import InstagramSchoolProfile from "@/pages/instagram-school-profile";
import { useQuery } from "@tanstack/react-query";

interface UnifiedDashboardProps {
  forceSchoolProfile?: string;
  forceViewerProfile?: string;
  initialTab?: "memories" | "yearbooks" | "alumni";
}

export default function UnifiedDashboard({ forceSchoolProfile, forceViewerProfile, initialTab = "memories" }: UnifiedDashboardProps = {}) {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("home");
  const [searchResetKey, setSearchResetKey] = useState(0);
  const searchTabRef = useRef<(() => void) | null>(null);
  const [forcedProfile, setForcedProfile] = useState<string | undefined>(forceSchoolProfile);
  const [forcedViewerProfile, setForcedViewerProfile] = useState<string | undefined>(forceViewerProfile);
  const [profileTab, setProfileTab] = useState<"memories" | "yearbooks" | "alumni">(initialTab);

  const userType = user?.userType === "school" ? "school" : "viewer";

  // If forceSchoolProfile is provided, switch to search tab and load school profile
  useEffect(() => {
    if (forceSchoolProfile) {
      setActiveTab("search");
      setForcedProfile(forceSchoolProfile);
      setForcedViewerProfile(undefined);
      setProfileTab(initialTab);
    }
  }, [forceSchoolProfile, initialTab]);

  // If forceViewerProfile is provided, switch to search tab and load viewer profile
  useEffect(() => {
    if (forceViewerProfile) {
      setActiveTab("search");
      setForcedViewerProfile(forceViewerProfile);
      setForcedProfile(undefined);
    }
  }, [forceViewerProfile]);

  // Determine which tab to show based on URL
  useEffect(() => {
    if (location === "/") setActiveTab("home");
    else if (location === "/search") {
      setActiveTab("search");
      // Don't reset forcedProfile/forcedViewerProfile here — only reset on tab click
    }
    else if (location === "/library") setActiveTab("library");
    else if (location === "/profile") setActiveTab("profile");
    else if (location === "/memory-upload") setActiveTab("memory-upload");
    else if (location === "/yearbooks") setActiveTab("yearbooks");
    else if (location === "/memories") setActiveTab("memories");
    else if (location === "/alumni") setActiveTab("alumni");
    else if (location === "/orders") setActiveTab("orders");
    else if (location === "/settings") setActiveTab("settings");
    else if (location === "/school-profile") setActiveTab("profile");
    else if (location.startsWith("/") && location !== "/") {
      const username = location.substring(1);
      if (!username.includes("/")) {
        setActiveTab("search");
      }
    }
  }, [location, userType]);

  const handleSearchTabReset = (resetFn: () => void) => {
    searchTabRef.current = resetFn;
  };

  const { data: schoolData } = useQuery<{ id: string; username: string }>({
    queryKey: ["/api/schools", user?.id],
    enabled: !!user && userType === "school" && activeTab === "profile",
  });

  // Render non-search content for viewer users
  const renderViewerContent = () => {
    switch (activeTab) {
      case "home":
        return <DashboardHome />;
      case "library":
        return <LibraryPage />;
      case "profile":
        return <ProfilePage />;
      case "memory-upload":
        return <MemoryUploadPage />;
      default:
        return null;
    }
  };

  const renderSchoolContent = () => {
    switch (activeTab) {
      case "home":
        return <SchoolDashboardHome user={user} />;
      case "yearbooks":
        return <SchoolYearbooks />;
      case "memories":
        return <SchoolMemories />;
      case "alumni":
        return <SchoolAlumni />;
      case "orders":
        return <SchoolOrders user={user} />;
      case "settings":
        return <SchoolSettingsTab user={user} />;
      case "profile":
        return schoolData?.username ? (
          <InstagramSchoolProfile
            schoolUsername={schoolData.username}
            initialTab="memories"
            inDashboard={true}
          />
        ) : null;
      default:
        return <SchoolDashboardHome user={user} />;
    }
  };

  return (
    <DashboardLayout
      userType={userType}
      onSearchTabClick={() => {
        // DashboardLayout only fires this when already on /search,
        // so this is always a "reset" action — fully remount SearchPage
        setForcedProfile(undefined);
        setForcedViewerProfile(undefined);
        setSearchResetKey(k => k + 1);
      }}
    >
      {userType === "school" ? (
        renderSchoolContent()
      ) : (
        <>
          {/* SearchPage is always mounted to preserve state across tab switches.
              It is hidden (not destroyed) when another tab is active. */}
          <div style={{ display: activeTab === "search" ? "block" : "none" }}>
            <SearchPage
              key={searchResetKey}
              onRegisterReset={handleSearchTabReset}
              forceSchoolProfile={forcedProfile}
              forceViewerProfile={forcedViewerProfile}
              initialProfileTab={profileTab}
            />
          </div>

          {/* All other tab content — only rendered when active */}
          {activeTab !== "search" && renderViewerContent()}
        </>
      )}
    </DashboardLayout>
  );
}
