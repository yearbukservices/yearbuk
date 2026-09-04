import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Add the current account auth version to authenticated requests, including
// feature-specific fetches that do not go through apiRequest.
const originalFetch = window.fetch.bind(window);
window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  let storedUser: { authVersion?: number } | null = null;
  try {
    const userData = localStorage.getItem("user");
    storedUser = userData ? JSON.parse(userData) : null;
  } catch {
    storedUser = null;
  }

  const requestHeaders = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
  if (requestHeaders.has("Authorization") && storedUser?.authVersion !== undefined) {
    requestHeaders.set("X-Auth-Version", String(storedUser.authVersion));
  }

  return originalFetch(input, { ...init, headers: requestHeaders });
};// Set favicon dynamically
const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement || document.createElement('link');
link.type = 'image/png';
link.rel = 'icon';
link.href = "/tab_logo_good.png?v=2";
if (!document.querySelector("link[rel~='icon']")) {
  document.head.appendChild(link);
}

// Provide the same branded icon for iOS home-screen shortcuts.
const appleTouchLink = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement || document.createElement('link');
appleTouchLink.rel = 'apple-touch-icon';
appleTouchLink.href = '/tab_logo_good.png?v=2';
if (!document.querySelector("link[rel='apple-touch-icon']")) {
  document.head.appendChild(appleTouchLink);
}

createRoot(document.getElementById("root")!).render(<App />);
