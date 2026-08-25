import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { RootRedirect, GuestOnlyRoute } from "@/components/RouteGuards";
import { YearbookProtection } from "@/components/YearbookProtection";
import { PageTitleManager } from "@/components/PageTitleManager";

import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home";
import TwoFactorAuthPage from "@/pages/two-factor-auth";
import SignupPage from "@/pages/signup";
import SchoolSignupPage from "@/pages/school-signup";
import ViewerSignupPage from "@/pages/viewer-signup";
import VerifyEmailPage from "@/pages/verify-email";
import EmailVerificationPage from "@/pages/email-verification";
import PendingApprovalPage from "@/pages/pending-approval";
import ResetPasswordPage from "@/pages/reset-password";
import UnifiedDashboard from "@/pages/unified-dashboard";
import SuperAdminDashboard from "@/pages/super-admin-dashboard";
import SuperAdmin from "@/pages/super-admin";
import YearbookManage from "@/pages/yearbook-manage";
import YearbookPreview from "@/pages/yearbook-preview";
import YearbookViewer from "@/pages/yearbook-viewer";
import DynamicYearbookViewer from "@/pages/dynamic-yearbook-viewer";
import YearbookFinder from "@/pages/yearbook-finder";
import PhotosMemoriesManage from "@/pages/photos-memories-manage";
import GuestUpload from "@/pages/guest-upload";
import MemoryUploadRedirect from "@/pages/memory-upload-redirect";
import SchoolSettings from "@/pages/school-settings";
import ViewerSettings from "@/pages/viewer-settings";
import Cart from "@/pages/cart";
import SchoolProfile from "@/pages/school-profile";
import Search from "@/pages/search";
import DynamicProfileHandler from "@/components/DynamicProfileHandler";
import { DashboardLayout } from "@/components/DashboardLayout";
import DashboardHome from "@/pages/dashboard/home";
import SearchPage from "@/pages/dashboard/search-page";
import LibraryPage from "@/pages/dashboard/library";
import ProfilePage from "@/pages/dashboard/profile";
import SchoolYearbooks from "@/pages/school-dashboard-tabs/yearbooks";
import SchoolMemories from "@/pages/school-dashboard-tabs/memories";
import SchoolOrders from "@/pages/school-dashboard-tabs/orders";
import SchoolSettingsTab from "@/pages/school-dashboard-tabs/settings";
import SchoolAlumni from "@/pages/school-dashboard-tabs/alumni";

function Router() {
  return (
    <Switch>
      <Route path="/home" component={HomePage} />
      <Route path="/login" component={HomePage} />
      <Route path="/two-factor-auth" component={TwoFactorAuthPage} />
      <Route path="/signup">
        <GuestOnlyRoute>
          <SignupPage />
        </GuestOnlyRoute>
      </Route>
      <Route path="/school-signup">
        <GuestOnlyRoute>
          <SchoolSignupPage />
        </GuestOnlyRoute>
      </Route>
      <Route path="/viewer-signup">
        <GuestOnlyRoute>
          <ViewerSignupPage />
        </GuestOnlyRoute>
      </Route>
      <Route path="/verify-email/:token" component={VerifyEmailPage} />
      <Route path="/verify-school-email/:token" component={VerifyEmailPage} />
      <Route path="/email-verification" component={EmailVerificationPage} />
      <Route path="/pending-approval" component={PendingApprovalPage} />
      <Route path="/reset-password/:token" component={ResetPasswordPage} />
      
      {/* Unified Dashboard Routes - All authenticated views flow through UnifiedDashboard */}
      <Route path="/">
        <RootRedirect>
          <UnifiedDashboard />
        </RootRedirect>
      </Route>
      <Route path="/search">
        <RootRedirect>
          <UnifiedDashboard />
        </RootRedirect>
      </Route>
      <Route path="/library">
        <RootRedirect>
          <UnifiedDashboard />
        </RootRedirect>
      </Route>
      <Route path="/profile">
        <RootRedirect>
          <UnifiedDashboard />
        </RootRedirect>
      </Route>
      <Route path="/yearbooks">
        <RootRedirect>
          <UnifiedDashboard />
        </RootRedirect>
      </Route>
      <Route path="/memories">
        <RootRedirect>
          <UnifiedDashboard />
        </RootRedirect>
      </Route>
      <Route path="/orders">
        <RootRedirect>
          <UnifiedDashboard />
        </RootRedirect>
      </Route>
      <Route path="/settings">
        <RootRedirect>
          <UnifiedDashboard />
        </RootRedirect>
      </Route>
      <Route path="/alumni">
        <RootRedirect>
          <UnifiedDashboard />
        </RootRedirect>
      </Route>
      
      <Route path="/super-admin-dashboard" component={SuperAdminDashboard} />
      <Route path="/super-admin" component={SuperAdmin} />
      <Route path="/yearbook-manage/:year" component={YearbookManage} />
      <Route path="/yearbook-preview/:year" component={YearbookPreview} />
      <Route path="/yearbook-viewer/:year" component={YearbookViewer} />
      <Route path="/yearbook/:schoolId/:year" component={DynamicYearbookViewer} />
      <Route path="/waibuk/:year" component={DynamicYearbookViewer} />
      <Route path="/yearbook-finder" component={YearbookFinder} />
      <Route path="/photos-memories-manage" component={PhotosMemoriesManage} />
      <Route path="/guest-upload/:code?" component={GuestUpload} />
      <Route path="/guest-upload" component={GuestUpload} />
      <Route path="/memory-upload">
        <RootRedirect>
          <UnifiedDashboard />
        </RootRedirect>
      </Route>
      <Route path="/school-settings" component={SchoolSettings} />
      <Route path="/viewer-settings" component={ViewerSettings} />
      <Route path="/cart" component={Cart} />
      
      {/* Dynamic School Profile Handler - Must be before NotFound */}
      <Route path="/:schoolUsername/memories" component={DynamicProfileHandler} />
      <Route path="/:schoolUsername/yearbooks" component={DynamicProfileHandler} />
      <Route path="/:schoolUsername/alumni" component={DynamicProfileHandler} />
      <Route path="/:schoolUsername" component={DynamicProfileHandler} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <CurrencyProvider>
          <TooltipProvider>
            <PageTitleManager />
            <YearbookProtection />
            <Toaster />
            <Router />
          </TooltipProvider>
        </CurrencyProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
