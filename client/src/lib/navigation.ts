// Navigation utility for tracking previous routes and smart back navigation

interface NavigationHistory {
  previousRoute?: string;
  previousTab?: string;
}

class NavigationTracker {
  private history: NavigationHistory = {};
  private listeners: Array<(history: NavigationHistory) => void> = [];

  setPreviousRoute(route: string, tab?: string) {
    this.history = {
      previousRoute: route,
      previousTab: tab
    };
    this.notifyListeners();
  }

  getPreviousRoute(): string {
    // Default fallback routes based on user type
    if (this.history.previousRoute) {
      return this.history.previousRoute;
    }
    
    // Get user from localStorage to determine default route
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    switch (user.userType) {
      case 'school':
        return '/school-dashboard';
      case 'viewer':
        return '/';
      case 'super_admin':
        return '/super-admin';
      default:
        return '/login';
    }
  }

  getPreviousTab(): string | undefined {
    return this.history.previousTab;
  }

  getBackRoute(): string {
    const prevRoute = this.getPreviousRoute();
    const prevTab = this.getPreviousTab();
    
    if (prevRoute === '/school-dashboard' && prevTab) {
      return `${prevRoute}?tab=${prevTab}`;
    }
    
    return prevRoute;
  }

  subscribe(listener: (history: NavigationHistory) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.history));
  }

  clear() {
    this.history = {};
    this.notifyListeners();
  }
}

export const navigationTracker = new NavigationTracker();

// Smart navigation functions
export const navigateToSchoolSettings = (setLocation: (location: string) => void, currentRoute?: string, currentTab?: string) => {
  if (currentRoute && currentRoute !== '/school-settings') {
    navigationTracker.setPreviousRoute(currentRoute, currentTab);
  }
  setLocation('/school-settings');
};

export const navigateToYearbookManage = (setLocation: (location: string) => void, schoolId: string, year: string) => {
  navigationTracker.setPreviousRoute('/school-dashboard', 'years');
  setLocation(`/yearbook-manage/${schoolId}/${year}`);
};

export const navigateToPhotosManage = (setLocation: (location: string) => void, schoolId: string, year: string) => {
  navigationTracker.setPreviousRoute('/school-dashboard', 'photos');
  setLocation(`/photos-memories-manage/${schoolId}/${year}`);
};

// Function to navigate TO a page while tracking where we came from
export const navigateWithTracking = (setLocation: (location: string) => void, targetRoute: string, currentRoute?: string) => {
  const actualCurrentRoute = currentRoute || window.location.pathname;
  
  // Only track if we're actually changing routes
  if (actualCurrentRoute !== targetRoute) {
    navigationTracker.setPreviousRoute(actualCurrentRoute);
  }
  
  setLocation(targetRoute);
};

export const navigateBack = (setLocation: (location: string) => void) => {
  const backRoute = navigationTracker.getBackRoute();
  setLocation(backRoute);
  navigationTracker.clear();
};