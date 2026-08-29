import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";
const HOMEPAGE_HEAD_METADATA = "    <meta name=\"description\" content=\"School memories live forever. Preserve, revisit, and share the memories that made your school years unforgettable.\" />\n    <link rel=\"icon\" type=\"image/png\" href=\"/tab_logo_good.png\" />\n    <link rel=\"apple-touch-icon\" href=\"/tab_logo_good.png\" />\n    <meta property=\"og:title\" content=\"Yearbuk\" />\n    <meta property=\"og:description\" content=\"School memories live forever. Preserve, revisit, and share the memories that made your school years unforgettable.\" />\n    <meta property=\"og:type\" content=\"website\" />\n    <meta property=\"og:url\" content=\"https://yearbuk.com/\" />\n    <meta property=\"og:image\" content=\"https://yearbuk.com/chrome_search_logo.png\" />\n    <meta name=\"twitter:card\" content=\"summary_large_image\" />\n    <meta name=\"twitter:title\" content=\"Yearbuk\" />\n    <meta name=\"twitter:description\" content=\"School memories live forever. Preserve, revisit, and share the memories that made your school years unforgettable.\" />\n    <meta name=\"twitter:image\" content=\"https://yearbuk.com/chrome_search_logo.png\" />";

function injectHomepageMetadata(template: string) {
  if (template.includes('name="description"')) {
    return template;
  }

  return template.replace("</head>", HOMEPAGE_HEAD_METADATA + "\n  </head>");
}


const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(process.cwd(), "client", "index.html");

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = injectHomepageMetadata(template);
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(process.cwd(), "dist/public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Secure static file serving - block direct access to secure uploads only
  app.use((req, res, next) => {
    if (req.path.includes('/uploads/yearbooks/') || req.path.includes('/uploads/accreditation/')) {
      return res.status(403).json({ 
        message: 'Direct access to secure content is not allowed. Please use secure image endpoints.' 
      });
    }
    next();
  });
  
  app.use(express.static(distPath, { index: false }));

  // fall through to index.html if the file doesn't exist
  app.use("*", async (_req, res, next) => {
    try {
      const indexPath = path.resolve(distPath, "index.html");
      const template = injectHomepageMetadata(
        await fs.promises.readFile(indexPath, "utf-8"),
      );
      res.status(200).type("html").send(template);
    } catch (error) {
      next(error);
    }
  });
}
