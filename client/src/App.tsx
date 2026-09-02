import { Switch, Route, useLocation } from "wouter";
import { Component, useEffect, useRef, type ErrorInfo, type ReactNode } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { RootRedirect, GuestOnlyRoute } from "@/components/RouteGuards";
import { YearbookProtection } from "@/components/YearbookProtection";
import { PageTitleManager } from "@/components/PageTitleManager";
import { navigationTracker } from "./lib/navigation";

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

interface AppErrorBoundaryState {
  error: Error | null;
}

class AppErrorBoundary extends Component<{ children: ReactNode }, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Unhandled application error:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
          <div className="max-w-lg w-full rounded-xl border border-white/20 bg-white/10 p-6 shadow-2xl">
            <h1 className="text-xl font-semibold">Something went wrong</h1>
            <p className="mt-2 text-sm text-white/70">The page could not be displayed. Reload to try again.</p>
            <p className="mt-4 rounded-md bg-black/20 p-3 font-mono text-xs text-red-200 break-words">{this.state.error.message}</p>
            <button
              type="button"
              onClick={this.handleReload}
              className="mt-5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function NavigationHistorySync() {
  const [location] = useLocation();
  const previousLocationRef = useRef(location);

  useEffect(() => {
    if (previousLocationRef.current !== location) {
      navigationTracker.trackRouteChange(previousLocationRef.current);
      previousLocationRef.current = location;
    }
  }, [location]);

  return null;
}

function PaymentCallbackHandler() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get("payment");
    const reference = params.get("reference") || params.get("trxref") || localStorage.getItem("lastPaymentReference");

    // A verified callback is already being displayed by the destination page.
    if (paymentStatus) {
      localStorage.removeItem("lastPaymentReference");
      return;
    }
    if (!reference) return;

    // Fallback for transactions whose Paystack dashboard callback still points
    // at the app instead of the backend verifier.
    window.location.replace(`/api/payments/verify/${encodeURIComponent(reference)}`);
  }, []);

  return null;
}

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
            <NavigationHistorySync />
            <PageTitleManager />
            <YearbookProtection />
            <PaymentCallbackHandler />
            <Toaster />
            <AppErrorBoundary>
              <Router />
            </AppErrorBoundary>
          </TooltipProvider>
        </CurrencyProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
