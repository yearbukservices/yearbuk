import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary with environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// Test configuration on startup
export const testCloudinaryConnection = async (): Promise<boolean> => {
  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    console.warn('Cloudinary is not configured; image uploads are disabled until its environment variables are added.');
    return false;
  }

  try {
    await cloudinary.api.ping();
    console.log('✅ Cloudinary connection successful');
    return true;
  } catch (error) {
    console.error('❌ Cloudinary connection failed:', error);
    return false;
  }
};

// Upload image to Cloudinary
export const uploadToCloudinary = async (
  filePath: string,
  folder: string,
  options: any = {}
): Promise<{ url: string; publicId: string; secureUrl: string }> => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder,
      resource_type: 'auto',
      ...options
    });
    
    return {
      url: result.url,
      secureUrl: result.secure_url,
      publicId: result.public_id
    };
  } catch (error) {
    console.error('❌ Cloudinary upload failed:', error);
    throw new Error('Failed to upload to Cloudinary');
  }
};

// Build a durable HTTPS delivery URL for an existing public Cloudinary asset.
export const generateCloudinaryUrl = (
  publicId: string,
  options: any = {}
): string => {
  return cloudinary.url(publicId, {
    secure: true,
    ...options
  });
};

// Upload secured yearbook content page to Cloudinary with authenticated access
export const uploadSecureYearbookPage = async (
  filePath: string,
  folder: string,
  options: any = {}
): Promise<{ url: string; publicId: string; secureUrl: string }> => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder,
      resource_type: 'auto',
      type: 'authenticated', // Authenticated type for restricted access
      ...options
    });
    
    return {
      url: result.url,
      secureUrl: result.secure_url,
      publicId: result.public_id
    };
  } catch (error) {
    console.error('❌ Cloudinary secure upload failed:', error);
    throw new Error('Failed to upload secured page to Cloudinary');
  }
};

// Upload PDF and convert each page to individual images
// Strategy: Upload as public first to enable transformation, extract pages as authenticated assets, then delete public source
export const uploadPdfToCloudinary = async (
  filePath: string,
  folder: string,
  useAuthenticated: boolean = true
): Promise<{ pages: Array<{ url: string; publicId: string; secureUrl: string; pageNumber: number }>; pdfPublicId: string }> => {
  let tempPdfPublicId: string | null = null;
  
  try {
    console.log(`📄 Uploading PDF to Cloudinary: ${filePath}`);
    
    // Step 1: Upload PDF as PUBLIC first (required for transformation access)
    // Using upload_large for files > 10MB
    const tempPdfResult: any = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_large(filePath, {
        folder: `${folder}/temp_pdf`,
        resource_type: 'auto',
        access_mode: 'public',
        chunk_size: 6000000, // 6MB chunks
        format: 'pdf'
      }, (error: any, result: any) => {
        if (error) reject(error);
        else resolve(result);
      });
    });

    console.log('📋 Upload result public_id:', tempPdfResult.public_id);
    tempPdfPublicId = tempPdfResult.public_id;
    
    if (!tempPdfPublicId) {
      throw new Error('Failed to get public_id from Cloudinary upload result');
    }
    
    console.log(`✅ Temp PDF uploaded: ${tempPdfPublicId}`);

    // Step 2: Get page count from the PDF
    let pageCount = 1;
    try {
      const pdfInfo = await cloudinary.api.resource(tempPdfPublicId, {
        resource_type: 'image',
        pages: true
      });
      pageCount = pdfInfo.pages || 1;
      console.log(`📊 PDF has ${pageCount} page(s)`);
    } catch (error) {
      console.warn('⚠️  Could not get page count, assuming 1 page:', error);
    }

    // Step 3: Extract each page as a separate authenticated asset
    const pages = [];
    for (let i = 1; i <= pageCount; i++) {
      try {
        // Generate URL for this specific page from the public PDF
        const pageUrl = cloudinary.url(tempPdfPublicId, {
          resource_type: 'image',
          format: 'jpg',
          page: i,
          secure: true
        });

        // Upload this page as an authenticated asset for security
        const uploadedPage = await cloudinary.uploader.upload(pageUrl, {
          folder: folder,
          resource_type: 'image',
          format: 'jpg',
          type: 'authenticated', // Authenticated access - requires signed URLs
          public_id: `page_${i}_${Date.now()}`
        });

        console.log(`✅ Page ${i}/${pageCount} converted: ${uploadedPage.public_id}`);

        pages.push({
          url: uploadedPage.url,
          secureUrl: uploadedPage.secure_url,
          publicId: uploadedPage.public_id,
          pageNumber: i
        });
      } catch (pageError) {
        console.error(`❌ Failed to convert page ${i}:`, pageError);
        throw new Error(`Failed to convert page ${i} of PDF`);
      }
    }

    console.log(`✅ All ${pageCount} pages converted successfully`);

    // Step 4: Delete the temporary public PDF
    if (tempPdfPublicId) {
      try {
        await cloudinary.uploader.destroy(tempPdfPublicId, {
          resource_type: 'image'
        });
        console.log(`🗑️  Deleted temporary PDF: ${tempPdfPublicId}`);
      } catch (cleanupError) {
        console.warn('⚠️  Could not delete temporary PDF:', cleanupError);
        // Don't fail the whole operation if cleanup fails
      }
    }

    return { 
      pages,
      pdfPublicId: tempPdfPublicId || 'unknown' // Return the temp ID for reference even though it's deleted
    };
  } catch (error) {
    // Clean up temporary PDF on error
    if (tempPdfPublicId) {
      try {
        await cloudinary.uploader.destroy(tempPdfPublicId, {
          resource_type: 'image'
        });
        console.log(`🗑️  Cleaned up temporary PDF after error: ${tempPdfPublicId}`);
      } catch (cleanupError) {
        console.warn('⚠️  Could not clean up temporary PDF:', cleanupError);
      }
    }
    
    console.error('❌ PDF upload to Cloudinary failed:', error);
    throw new Error(`Failed to upload PDF to Cloudinary: ${(error as Error).message}`);
  }
};

// Generate watermarked URL for viewer access
export const generateWatermarkedUrl = (
  publicId: string,
  options: any = {}
): string => {
  return cloudinary.url(publicId, {
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
    ],
    secure: true,
    ...options
  });
};

// Delete resource from Cloudinary
export const deleteFromCloudinary = async (publicId: string): Promise<boolean> => {
  try {
    await cloudinary.uploader.destroy(publicId);
    console.log(`✅ Deleted from Cloudinary: ${publicId}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to delete from Cloudinary:', error);
    return false;
  }
};

// Generate organized folder path for uploads
export const generateFolderPath = (
  schoolName: string,
  schoolCode: string,
  category: 'yearbooks' | 'memories' | 'logo' | 'accreditation',
  year?: number
): string => {
  // Sanitize school name: remove spaces and special characters
  const safeSchoolName = schoolName.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '');
  
  // Build folder path
  let folderPath = `yearbuk_uploads/${safeSchoolName}_${schoolCode}/${category}`;
  
  // Add year if provided (for yearbooks and memories)
  if (year) {
    folderPath += `/${year}`;
  }
  
  return folderPath;
};

// Delete all assets for a school (when school is deleted)
export const deleteSchoolAssets = async (
  schoolName: string,
  schoolCode: string
): Promise<{ success: boolean; deletedCount: number; errors: string[] }> => {
  try {
    const safeSchoolName = schoolName.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '');
    const folderPrefix = `yearbuk_uploads/${safeSchoolName}_${schoolCode}`;
    
    console.log(`🗑️ Starting deletion of all assets for school: ${schoolName} (${schoolCode})`);
    console.log(`📁 Folder prefix: ${folderPrefix}`);
    
    let deletedCount = 0;
    const errors: string[] = [];
    
    // Search for all resources in the school's folder
    try {
      const result = await cloudinary.api.resources({
        type: 'upload',
        prefix: folderPrefix,
        max_results: 500 // Cloudinary max per request
      });
      
      if (result.resources && result.resources.length > 0) {
        console.log(`📦 Found ${result.resources.length} assets to delete`);
        
        // Delete each resource
        for (const resource of result.resources) {
          try {
            await cloudinary.uploader.destroy(resource.public_id, {
              resource_type: resource.resource_type || 'image'
            });
            deletedCount++;
          } catch (err) {
            const error = err as Error;
            errors.push(`Failed to delete ${resource.public_id}: ${error.message}`);
          }
        }
        
        // Delete the folder structure
        try {
          await cloudinary.api.delete_folder(folderPrefix);
        } catch (err) {
          // Folder deletion might fail if not empty, but that's okay
          const error = err as Error;
          console.log(`⚠️ Folder deletion skipped: ${error.message}`);
        }
      } else {
        console.log(`ℹ️ No assets found for school ${schoolName}`);
      }
      
      console.log(`✅ Cloudinary cleanup complete: ${deletedCount} assets deleted`);
      
      return {
        success: errors.length === 0,
        deletedCount,
        errors
      };
    } catch (apiError) {
      console.error(`❌ Cloudinary API error during cleanup:`, apiError);
      return {
        success: false,
        deletedCount,
        errors: [`API error: ${(apiError as Error).message}`]
      };
    }
  } catch (error) {
    console.error(`❌ Failed to delete school assets:`, error);
    return {
      success: false,
      deletedCount: 0,
      errors: [(error as Error).message]
    };
  }
};

// Generate signed URL with expiration for secure access
export const generateSignedUrl = (
  publicId: string,
  options: {
    expirySeconds?: number;
    transformation?: any[];
    width?: number;
    height?: number;
    crop?: string;
  } = {}
): string => {
  const expirySeconds = options.expirySeconds || parseInt(process.env.SIGNED_URL_EXPIRY || '300');
  const expiryTimestamp = Math.floor(Date.now() / 1000) + expirySeconds;
  
  return cloudinary.url(publicId, {
    sign_url: true,
    type: 'authenticated',
    secure: true,
    expires_at: expiryTimestamp,
    transformation: options.transformation,
    width: options.width,
    height: options.height,
    crop: options.crop
  });
};

// Generate multiple signed URLs for yearbook pages
export const generateSignedUrlsForPages = (
  publicIds: string[],
  expirySeconds?: number
): { publicId: string; signedUrl: string }[] => {
  return publicIds.map(publicId => ({
    publicId,
    signedUrl: generateSignedUrl(publicId, { expirySeconds })
  }));
};

export default cloudinary;
