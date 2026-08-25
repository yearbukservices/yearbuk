import { getSecureImageUrl } from '@/lib/secure-image';

interface YearbookPageImageProps {
  imageUrl: string | null;
  alt: string;
  className?: string;
  useBackgroundMode?: boolean;
  children?: React.ReactNode;
}

/**
 * YearbookPageImage Component
 * Renders yearbook pages with enhanced security
 * 
 * @param useBackgroundMode - If true, renders as background-image div (more secure)
 *                           If false, renders as img tag with protection classes
 */
export function YearbookPageImage({ 
  imageUrl, 
  alt, 
  className = '', 
  useBackgroundMode = true,
  children 
}: YearbookPageImageProps) {
  const secureUrl = getSecureImageUrl(imageUrl);

  if (!secureUrl) {
    return (
      <div className={`bg-gray-100 flex items-center justify-center ${className}`}>
        <span className="text-gray-400">No image available</span>
      </div>
    );
  }

  if (useBackgroundMode) {
    // Background mode - harder to download
    return (
      <div
        className={`yearbook-page-bg ${className}`}
        style={{
          backgroundImage: `url(${secureUrl})`,
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
        }}
        role="img"
        aria-label={alt}
      >
        {children}
      </div>
    );
  } else {
    // Traditional img tag mode with protection
    return (
      <div className={className} style={{ position: 'relative' }}>
        <img 
          src={secureUrl} 
          alt={alt}
          className="yearbook-page-image w-full h-full object-cover"
          draggable="false"
        />
        {children}
      </div>
    );
  }
}
