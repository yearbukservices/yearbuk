import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
// Set favicon dynamically
const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement || document.createElement('link');
link.type = 'image/png';
link.rel = 'icon';
link.href = "/tab_logo_good.png";
if (!document.querySelector("link[rel~='icon']")) {
  document.head.appendChild(link);
}

createRoot(document.getElementById("root")!).render(<App />);
