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
  userType: string | undefined
): string => {
  // If no Cloudinary ID, return the original URL (local file)
  if (!cloudinaryPublicId) {
    return imageUrl;
  }
  
  // For Cloudinary images, generate signed URLs with appropriate transformations
  // Authenticated images require signed URLs to access
  
  // If image is from Cloudinary and user is a viewer, apply watermark and sign URL
  if (shouldApplyWatermark(userType)) {
    return generateSignedUrl(cloudinaryPublicId, {
      expirySeconds: 3600, // 1 hour expiry
      transformation: [
        {
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
        }
      ]
    });
  }
  
  // For school admins and super admins, return signed URL without watermark
  return generateSignedUrl(cloudinaryPublicId, {
    expirySeconds: 3600 // 1 hour expiry
  });
};

export default {
  shouldApplyWatermark,
  getImageUrl
};
