// Helper function to create secure image URLs with user authentication
export function getSecureImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  
  // Cloudinary URLs are already watermarked server-side for viewers
  // Return them directly without modification
  if (imageUrl.includes('cloudinary.com') || imageUrl.includes('res.cloudinary.com')) {
    return imageUrl;
  }
  
  // Get user ID from localStorage for authentication
  const userString = localStorage.getItem("user") || "{}";
  const user = JSON.parse(userString);
  
  if (!user?.id) {
    console.warn("No user ID found for secure image access, returning original URL");
    return imageUrl; // Fallback to original URL if no user
  }
  
  // If it's already a secure URL, add userId parameter
  if (imageUrl.includes('/api/secure-image/')) {
    return `${imageUrl}?userId=${user.id}`;
  }
  
  // Memories are freely accessible - don't convert to secure URLs
  if (imageUrl.includes('/uploads/memories/')) {
    return imageUrl; // Return original URL for direct access
  }
  
  if (imageUrl.includes('/uploads/yearbooks/')) {
    const filename = imageUrl.split('/').pop();
    return `/api/secure-image/yearbooks/${filename}?userId=${user.id}`;
  }
  
  if (imageUrl.includes('/uploads/accreditation/')) {
    const filename = imageUrl.split('/').pop();
    return `/api/secure-image/accreditation/${filename}?userId=${user.id}`;
  }
  
  // Return original URL for other cases
  return imageUrl;
}

// Helper function for public front cover images (no authentication required)
export function getPublicFrontCoverUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  
  // Front covers are publicly accessible - return the URL directly
  // No authentication needed since yearbook front covers are meant to be visible for purchase decisions
  return imageUrl;
}

// Helper function for public memory images (no authentication required)
export function getPublicMemoryUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  
  // Cloudinary URLs are already publicly accessible
  if (imageUrl.includes('cloudinary.com') || imageUrl.includes('res.cloudinary.com')) {
    return imageUrl;
  }
  
  // Local upload URLs are also publicly accessible for memories
  // Memory images are meant to be visible to all authenticated users
  return imageUrl;
}