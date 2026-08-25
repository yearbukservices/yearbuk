import { useEffect } from "react";
import { useLocation } from "wouter";

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/home": "Home",
  "/search": "Search",
  "/library": "Library",
  "/profile": "Profile",
  "/school-settings": "Settings",
  "/viewer-settings": "Settings",
  "/cart": "Cart",
  "/guest-upload": "Upload",
  "/photos-memories-manage": "School Memories",
  "/super-admin-dashboard": "",
  "/super-admin": "Super Admin",
  "/yearbook-finder": "Find Yearbooks",
  "/login": "Login",
  "/signup": "Sign Up",
  "/school-signup": "Sign Up",
  "/viewer-signup": "Sign Up",
  "/verify-email": "Verify Email",
  "/email-verification": "Email Verification",
  "/pending-approval": "Pending Approval",
  "/reset-password": "Reset Password",
  "/two-factor-auth": "Two-Factor Authentication",
  "/yearbook-manage": "Manage Yearbook",
  "/yearbook-preview": "Preview Yearbook",
  "/yearbook-viewer": "View Yearbook",
  "/yearbook": "Yearbook",
  "/waibuk": "Yearbook",
  "/memory-upload": "Memory Upload",
  "/verify-school-email": "Verify Email",
};

export function PageTitleManager() {
  const [location] = useLocation();

  useEffect(() => {
    // Try exact match first
    let pageTitle = PAGE_TITLES[location];
    
    // If no exact match, try base path (for dynamic routes like /yearbook-manage/2024)
    if (!pageTitle) {
      const basePath = location.split("/")[1] ? `/${location.split("/")[1]}` : "/";
      pageTitle = PAGE_TITLES[basePath];
    }
    
    // If still no match, try two-segment path (for routes like /yearbook/:schoolId/:year)
    if (!pageTitle && location.split("/").length >= 3) {
      const twoSegmentPath = `/${location.split("/")[1]}/${location.split("/")[2]}`;
      pageTitle = PAGE_TITLES[twoSegmentPath];
    }
    
    if (pageTitle) {
      document.title = `${pageTitle} – Yearbuk`;
    } else {
      document.title = "Yearbuk";
    }
  }, [location]);

  return null;
}
