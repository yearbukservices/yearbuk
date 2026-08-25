/**
 * Detects the aspect ratio of an image by loading it and measuring dimensions
 * Returns a string like "3/4" or "9/16" or "4/3"
 */
export async function detectImageAspectRatio(imageUrl: string): Promise<string | null> {
  try {
    return await new Promise((resolve) => {
      const img = new Image();
      
      // Add timeout to prevent hanging
      const timeout = setTimeout(() => {
        resolve(null);
      }, 5000);
      
      img.onload = () => {
        clearTimeout(timeout);
        const width = img.width;
        const height = img.height;
        
        if (width > 0 && height > 0) {
          // Calculate aspect ratio
          const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
          const divisor = gcd(width, height);
          const ratioWidth = width / divisor;
          const ratioHeight = height / divisor;
          
          // Return as simplified ratio string
          resolve(`${Math.round(ratioWidth)}/${Math.round(ratioHeight)}`);
        } else {
          resolve(null);
        }
      };
      
      img.onerror = () => {
        clearTimeout(timeout);
        resolve(null);
      };
      
      // Cross-origin handling for image loading
      img.crossOrigin = "anonymous";
      img.src = imageUrl;
    });
  } catch (error) {
    console.error('Error detecting image aspect ratio:', error);
    return null;
  }
}

/**
 * Maps detected aspect ratio to optimal viewport dimensions and styles
 */
export function getAspectRatioConfig(aspectRatio: string | null) {
  // Default to portrait 3:4 if no ratio detected
  const ratio = aspectRatio || '3/4';
  
  // Common aspect ratio configurations
  const configs: Record<string, { viewportRatio: string; pageRatio: string; twoPageRatio: string; singlePageRatio: string }> = {
    '3/4': {
      viewportRatio: '884/572',     // Two-page spread
      pageRatio: '3/4',              // Single page
      twoPageRatio: '3/4',           // Two pages
      singlePageRatio: '1040/780'    // Single page landscape
    },
    '9/16': {
      viewportRatio: '450/800',      // Two-page spread - tall
      pageRatio: '9/16',             // Single page
      twoPageRatio: '9/16',          // Two pages
      singlePageRatio: '900/800'     // Single page landscape
    },
    '4/3': {
      viewportRatio: '1430/585',     // Two-page landscape
      pageRatio: '4/3',              // Single page
      twoPageRatio: '4/3',           // Two pages
      singlePageRatio: '1040/780'    // Single page
    },
    '16/9': {
      viewportRatio: '1430/585',     // Two-page landscape
      pageRatio: '16/9',             // Single page
      twoPageRatio: '16/9',          // Two pages
      singlePageRatio: '1040/585'    // Single page
    }
  };
  
  return configs[ratio] || configs['3/4'];
}

/**
 * Determines if aspect ratio is portrait or landscape
 */
export function isPortraitRatio(aspectRatio: string | null): boolean {
  if (!aspectRatio) return true; // Default to portrait
  
  const [width, height] = aspectRatio.split('/').map(Number);
  return height > width;
}
