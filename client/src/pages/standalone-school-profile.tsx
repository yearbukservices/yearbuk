import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BookOpen, Image as ImageIcon, MapPin, Globe, Calendar, Share2, Award } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import logoImage from "@assets/logo_background_null.png";

interface SchoolProfile {
  school: {
    id: string;
    name: string;
    logo: string | null;
    coverPhoto: string | null;
    motto: string | null;
    aboutDescription: string | null;
    city: string;
    country: string;
    yearFounded: number;
    website: string | null;
  };
  yearbooks: Array<{
    id: string;
    year: number;
    title: string;
    frontCoverUrl: string | null;
    isFree: boolean;
    price: string | null;
  }>;
  memories: Array<{
    id: string;
    title: string;
    imageUrl: string;
    eventDate: string;
    year: number;
  }>;
}

interface StandaloneSchoolProfileProps {
  schoolUsername: string;
}

export default function StandaloneSchoolProfile({ schoolUsername }: StandaloneSchoolProfileProps) {
  const [, setLocation] = useLocation();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const { toast } = useToast();

  const { data: profileData, isLoading } = useQuery<SchoolProfile>({
    queryKey: [`/api/schools/profile-by-username/${schoolUsername}`],
    enabled: !!schoolUsername,
  });

  const handleInteractiveAction = () => {
    setShowLoginModal(true);
  };

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    toast({
      title: "Link copied!",
      description: "School profile link copied to clipboard.",
    });
  };

  // Set SEO meta tags
  useEffect(() => {
    if (profileData) {
      const { school } = profileData;
      const title = `${school.name} — Yearbuk`;
      const description = `Explore ${school.name}'s yearbooks, alumni memories, and digital archives on Yearbuk.`;
      const imageUrl = school.logo || school.coverPhoto || '';

      document.title = title;

      const updateMeta = (name: string, content: string) => {
        let meta = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement;
        if (!meta) {
          meta = document.createElement('meta');
          meta.name = name;
          document.head.appendChild(meta);
        }
        meta.content = content;
      };

      const updateMetaProperty = (property: string, content: string) => {
        let meta = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement;
        if (!meta) {
          meta = document.createElement('meta');
          meta.setAttribute('property', property);
          document.head.appendChild(meta);
        }
        meta.content = content;
      };

      updateMeta('description', description);
      updateMetaProperty('og:title', title);
      updateMetaProperty('og:description', description);
      updateMetaProperty('og:type', 'website');
      updateMetaProperty('og:url', window.location.href);
      if (imageUrl) {
        updateMetaProperty('og:image', imageUrl);
      }

      updateMeta('twitter:card', 'summary_large_image');
      updateMeta('twitter:title', title);
      updateMeta('twitter:description', description);
      if (imageUrl) {
        updateMeta('twitter:image', imageUrl);
      }
    }
  }, [profileData]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-64 w-full mb-8 bg-white/10" />
          <Skeleton className="h-32 w-full mb-4 bg-white/10" />
          <Skeleton className="h-96 w-full bg-white/10" />
        </div>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center border border-white/20 shadow-2xl max-w-md">
          <h2 className="text-2xl font-bold mb-4 text-white">School Not Found</h2>
          <p className="text-blue-100 mb-4">The school profile you're looking for doesn't exist.</p>
          <Button 
            onClick={() => setLocation('/')}
            className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg hover:from-blue-600 hover:to-cyan-600 border-0"
          >
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  const { school, yearbooks, memories } = profileData;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
      {/* Public Header */}
      <div className="fixed top-0 left-0 right-0 bg-white/10 backdrop-blur-lg border-b border-white/20 shadow-2xl z-30">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <button 
            onClick={() => setLocation("/")}
            className="flex items-center space-x-3 hover:opacity-80 transition-opacity"
            data-testid="link-logo-public"
          >
            <img src={logoImage} alt="Yearbuk Logo" className="h-12 w-auto" />
            <span className="text-2xl font-bold text-white">Yearbuk</span>
          </button>
          
          <div className="flex items-center space-x-4">
            <Button 
              variant="outline"
              onClick={() => setLocation('/login')}
              className="bg-white/20 backdrop-blur-lg border border-white/30 text-white hover:bg-white/30"
              data-testid="button-public-login"
            >
              Login
            </Button>
            <Button 
              onClick={() => setLocation('/signup')}
              className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg hover:from-blue-600 hover:to-cyan-600 border-0"
              data-testid="button-public-signup"
            >
              Sign Up
            </Button>
          </div>
        </div>
      </div>

      <div className="pt-20">
        {/* Cover Photo Section */}
        <div className="relative h-64 bg-gradient-to-r from-blue-600 to-purple-600">
          {school.coverPhoto ? (
            <img 
              src={school.coverPhoto} 
              alt={`${school.name} cover`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <h1 className="text-4xl font-bold text-white">{school.name}</h1>
            </div>
          )}
          <div className="absolute top-4 right-4">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleShare}
              data-testid="button-share"
              className="bg-white/20 backdrop-blur-lg border border-white/30 text-white hover:bg-white/30"
            >
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
          </div>
        </div>

        {/* School Info Header */}
        <div className="container mx-auto px-4 -mt-16 relative z-10">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 shadow-2xl">
            <div className="flex flex-col md:flex-row gap-6">
              {school.logo && (
                <img 
                  src={school.logo} 
                  alt={`${school.name} logo`}
                  className="w-32 h-32 rounded-lg object-cover border-4 border-white shadow-lg"
                  data-testid="img-school-logo"
                />
              )}
              
              <div className="flex-1">
                <h1 className="text-3xl font-bold mb-2 text-white" data-testid="text-school-name">{school.name}</h1>
                {school.motto && (
                  <p className="text-lg text-blue-100 italic mb-2" data-testid="text-school-motto">
                    "{school.motto}"
                  </p>
                )}
                
                <div className="flex flex-wrap gap-4 text-sm text-blue-100">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span data-testid="text-location">{school.city}, {school.country}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>Founded {school.yearFounded}</span>
                  </div>
                  {school.website && (
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      <a 
                        href={school.website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-cyan-300 hover:text-cyan-200 hover:underline"
                        data-testid="link-website"
                      >
                        Visit Website
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {school.aboutDescription && (
              <div className="mt-6 pt-6 border-t border-white/20">
                <h2 className="text-xl font-semibold mb-3 text-white">About {school.name}</h2>
                <p className="text-blue-100 whitespace-pre-wrap" data-testid="text-about">
                  {school.aboutDescription}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="container mx-auto px-4 py-8">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Yearbooks Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold flex items-center gap-2 text-white">
                  <BookOpen className="h-6 w-6" />
                  Yearbooks
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleInteractiveAction}
                  data-testid="button-find-yearbooks"
                  className="bg-white/20 backdrop-blur-lg border border-white/30 text-white hover:bg-white/30"
                >
                  Find Yearbooks
                </Button>
              </div>
              
              {yearbooks.length === 0 ? (
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center border border-white/20 shadow-2xl">
                  <p className="text-blue-100">No yearbooks published yet</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {yearbooks.map((yearbook) => (
                    <div key={yearbook.id} className="bg-white/10 backdrop-blur-lg rounded-2xl overflow-hidden border border-white/20 shadow-2xl hover:bg-white/15 transition-all">
                      <div className="flex gap-4 p-4">
                        {yearbook.frontCoverUrl && (
                          <img 
                            src={yearbook.frontCoverUrl} 
                            alt={`${yearbook.title} cover`}
                            className="w-24 h-32 object-cover rounded"
                            data-testid={`img-yearbook-${yearbook.year}`}
                          />
                        )}
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg mb-1 text-white" data-testid={`text-yearbook-title-${yearbook.year}`}>
                            {yearbook.title}
                          </h3>
                          <p className="text-sm text-blue-100 mb-2">Year: {yearbook.year}</p>
                          <div className="flex items-center gap-2">
                            {yearbook.isFree ? (
                              <Badge variant="secondary" className="bg-green-500/60 backdrop-blur-lg border border-green-400/30 text-white" data-testid={`badge-free-${yearbook.year}`}>
                                Free
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-white/20 backdrop-blur-lg border border-white/30 text-white" data-testid={`badge-price-${yearbook.year}`}>
                                {yearbook.price}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Memories Section */}
            <div>
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-white">
                <ImageIcon className="h-6 w-4" />
                Memories
              </h2>
              
              {memories.length === 0 ? (
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-center border border-white/20 shadow-2xl">
                  <p className="text-blue-100">No memories shared yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {memories.map((memory) => (
                    <div key={memory.id} className="bg-white/10 backdrop-blur-lg rounded-2xl overflow-hidden border border-white/20 shadow-2xl hover:bg-white/15 transition-all cursor-pointer">
                      <img 
                        src={memory.imageUrl} 
                        alt={memory.title}
                        className="w-full h-48 object-cover"
                        data-testid={`img-memory-${memory.id}`}
                      />
                      <div className="p-3">
                        <h4 className="font-medium text-sm mb-1 line-clamp-1 text-white" data-testid={`text-memory-title-${memory.id}`}>
                          {memory.title}
                        </h4>
                        <p className="text-xs text-blue-100">
                          {new Date(memory.eventDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Request Alumni Status Section */}
          <div className="mt-8">
            <div className="bg-gradient-to-r from-cyan-500/20 to-purple-500/20 backdrop-blur-lg rounded-2xl p-6 border border-white/20 shadow-2xl">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold mb-2 flex items-center gap-2 text-white">
                    <Award className="h-5 w-5" />
                    Alumni of {school.name}?
                  </h3>
                  <p className="text-blue-100">
                    Request alumni status to connect with classmates and access exclusive features
                  </p>
                </div>
                <Button
                  onClick={handleInteractiveAction}
                  data-testid="button-request-alumni"
                  className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg hover:from-blue-600 hover:to-cyan-600 border-0 whitespace-nowrap"
                >
                  Request Alumni Status
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Login/Signup Modal */}
      <Dialog open={showLoginModal} onOpenChange={setShowLoginModal}>
        <DialogContent data-testid="dialog-login-prompt">
          <DialogHeader>
            <DialogTitle>Please log in or sign up</DialogTitle>
            <DialogDescription>
              Please log in or sign up to access this feature.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-4">
            <Button
              onClick={() => setLocation('/login')}
              className="w-full"
              data-testid="button-modal-login"
            >
              Login
            </Button>
            <Button
              onClick={() => setLocation('/signup')}
              variant="outline"
              className="w-full"
              data-testid="button-modal-signup"
            >
              Sign Up
            </Button>
            <p className="text-sm text-muted-foreground text-center mt-2">
              Creating an account takes less than a minute.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
