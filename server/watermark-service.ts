import { generateWatermarkedUrl, generateSignedUrl } from './cloudinary-config';

export interface WatermarkOptions {
  applyWatermark: boolean;
  userType?: string;
}

// Determine if a watermark should be applied based on user type
export const shouldApplyWatermark = (userType: string | undefined): boolean => {
  // Apply watermark only for viewer accounts
  // School admins, super admins see original images
  return userType === 'viewer';
};

// Generate the appropriate URL based on user type and image source
export const getImageUrl = (
  imageUrl: string,
  cloudinaryPublicId: string | null | undefined,
  userType: string | undefined,
  transformation: any[] = [],
  pageType?: string
): string => {
  // If no Cloudinary ID, return the original URL (local file)
  if (!cloudinaryPublicId) {
    return imageUrl;
  }
  
  // For Cloudinary images, generate signed URLs with appropriate transformations
  // Authenticated images require signed URLs to access
  
  const watermarkTransformation = {
    overlay: {
      font_family: "Arial",
      font_size: 24,
      font_weight: "bold",
      text: encodeURIComponent("© Yearbuk") // URL encode special characters
    },
    gravity: "south_east",
    opacity: 40,
    x: 15,
    y: 15,
    color: "#FFFFFF"
  };

  const isPublicCover = pageType === 'front_cover' || pageType === 'back_cover';
  const finalTransformation = shouldApplyWatermark(userType)
    ? [...transformation, watermarkTransformation]
    : transformation;

  // Covers are intentionally public so they can be shown before authentication.
  // Deliver them through the public Cloudinary route even if an older database
  // record contains an authenticated delivery URL for the same public asset.
  if (isPublicCover) {
    return generateCloudinaryUrl(cloudinaryPublicId, {
      transformation: finalTransformation
    });
  }

  // Interior pages remain protected with short-lived signed URLs.
  return generateSignedUrl(cloudinaryPublicId, {
    expirySeconds: 3600, // 1 hour expiry
    transformation: finalTransformation
  });
};

export default {
  shouldApplyWatermark,
  getImageUrl
};
