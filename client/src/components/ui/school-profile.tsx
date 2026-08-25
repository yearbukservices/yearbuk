import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { MapPin, Calendar, Users, Mail, Phone, Globe, Upload, Edit, Trash2, Plus, Image, GraduationCap } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import CircularGallery from "@/components/CircularGallery";
import type { School, SchoolGalleryImage } from "@shared/schema";

interface SchoolProfileProps {
  school: School;
  galleryImages?: { image: string }[];
}

const uploadSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
});

type UploadFormData = z.infer<typeof uploadSchema>;

export default function SchoolProfile({ school, galleryImages }: SchoolProfileProps) {
  const [user, setUser] = useState<any>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();

  // Check if user is school admin
  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  const isSchoolAdmin = user && (user.userType === 'school' || user.userType === 'school_admin') && user.schoolId === school.id;

  // Form for image upload
  const form = useForm<UploadFormData>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      title: "",
      description: "",
    }
  });

  // Query for alumni badges (to get alumni count)
  const { data: alumniBadges = [] } = useQuery({
    queryKey: [`/api/alumni-badges/school/${school.id}`],
    enabled: !!school.id,
  });

  // Query for gallery images
  const { data: apiGalleryImages = [], isLoading, refetch } = useQuery({
    queryKey: [`/api/schools/${school.id}/gallery`],
    queryFn: async () => {
      const response = await fetch(`/api/schools/${school.id}/gallery`, {
        headers: {
          'Authorization': `Bearer ${user?.id}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch gallery images');
      }
      
      return response.json();
    },
    enabled: !!isSchoolAdmin,
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (data: UploadFormData & { file: File }) => {
      const formData = new FormData();
      formData.append('galleryImage', data.file);
      formData.append('title', data.title || '');
      formData.append('description', data.description || '');

      const response = await fetch(`/api/schools/${school.id}/gallery`, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${user?.id}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Success", description: "Image uploaded successfully!" });
      setIsUploadDialogOpen(false);
      setSelectedFile(null);
      form.reset();
      queryClient.invalidateQueries({ queryKey: [`/api/schools/${school.id}/gallery`] });
    },
    onError: (error) => {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (imageId: string) => {
      return apiRequest('DELETE', `/api/schools/${school.id}/gallery/${imageId}`);
    },
    onSuccess: () => {
      toast({
        className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Success", description: "Image deleted successfully!" });
      queryClient.invalidateQueries({ queryKey: [`/api/schools/${school.id}/gallery`] });
    },
    onError: (error: any) => {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleUpload = (data: UploadFormData) => {
    if (!selectedFile) return;
    uploadMutation.mutate({ ...data, file: selectedFile });
  };

  const handleDelete = (imageId: string) => {
    if (confirm('Are you sure you want to delete this image?')) {
      deleteMutation.mutate(imageId);
    }
  };

  // Prepare gallery images for display
  const displayImages = apiGalleryImages.length > 0 
    ? apiGalleryImages.map((img: SchoolGalleryImage) => ({ image: img.imageUrl }))
    : galleryImages && galleryImages.length > 0 
      ? galleryImages 
      : Array.from({ length: 12 }, (_, i) => ({
          image: `/api/placeholder-image?seed=${i + 1}&width=800&height=450`
        }));

  return (
    <div className="space-y-8">
      {/* School Header */}
      <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
        <CardContent className="p-8">
          <div className="flex items-start gap-6">
            {/* School Logo */}
            <div className="w-24 h-24 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
              {school.logo ? (
                <img 
                  src={school.logo.startsWith('http') ? school.logo : (school.logo.startsWith('/') ? school.logo : `/${school.logo}`)}
                  alt={`${school.name} logo`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <GraduationCap className="w-12 h-12 text-primary" />
              )}
            </div>
            
            {/* School Info */}
            <div className="flex-1 space-y-4">
              <div>
                <h1 className="text-3xl font-bold mb-2 text-white" data-testid="text-school-name">
                  {school.name}
                </h1>
                <div className="flex items-center gap-4 text-muted-foreground text-white">
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    <span data-testid="text-school-location">
                      {school.address}, {school.city}, {school.state}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-white">
                    <Calendar className="w-4 h-4" />
                    <span data-testid="text-school-founded text-blue-50">Founded {school.yearFounded}</span>
                  </div>
                </div>
              </div>

              {/* School Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {school.website && (
                  <div className="flex items-center gap-2 text-sm">
                    <Globe className="w-4 h-4 text-muted-foreground text-white" />
                    <a 
                      href={school.website.startsWith('http') ? school.website : `https://${school.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                      data-testid="link-school-website"
                    >
                      {school.website}
                    </a>
                  </div>
                )}
                
                {school.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground text-white" />
                    <a 
                      href={`mailto:${school.email}`}
                      className="text-primary hover:underline"
                      data-testid="link-school-email"
                    >
                      {school.email}
                    </a>
                  </div>
                )}
                
                {school.phoneNumber && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground text-white" />
                    <a 
                      href={`tel:${school.phoneNumber}`}
                      className="text-primary hover:underline"
                      data-testid="link-school-phone"
                    >
                      {school.phoneNumber}
                    </a>
                  </div>
                )}
                
                <div className="flex items-center gap-2 text-sm text-blue-500">
                  <Users className="w-4 h-4 text-muted-foreground text-white" />
                  <span data-testid="text-school-type">
                    Educational Institution
                  </span>
                </div>
              </div>

              {/* Tags/Categories */}
              <div className="flex flex-wrap gap-3">
                <Badge variant="secondary" className="text-lg px-4 py-2">
                  Est. {school.yearFounded}
                </Badge>
                <Badge variant="outline" className="text-white text-lg px-4 py-2">
                  Educational Institution
                </Badge>
                <Badge variant="outline" className="text-white text-lg px-4 py-2">
                  {school.city}, {school.state}
                </Badge>
                <Badge variant="outline" className="text-white text-lg px-4 py-2 flex items-center gap-2">
                  <GraduationCap className="w-5 h-5" />
                  <span data-testid="text-alumni-count">{alumniBadges.length} Alumni</span>
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Display Images Management Section for School Admins */}
      {isSchoolAdmin && (
        <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-semibold">Display Images</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Manage your school's gallery images that visitors see
                </p>
              </div>
              <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="flex items-center gap-2" data-testid="button-upload-image">
                    <Plus className="w-4 h-4" />
                    Add Image
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Upload Gallery Image</DialogTitle>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleUpload)} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Select Image
                        </label>
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                          className="mb-2"
                          data-testid="input-image-file"
                        />
                        {selectedFile && (
                          <p className="text-xs text-muted-foreground">
                            Selected: {selectedFile.name}
                          </p>
                        )}
                      </div>
                      
                      <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Title (Optional)</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Enter image title..."
                                {...field}
                                data-testid="input-image-title"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description (Optional)</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Enter image description..."
                                rows={3}
                                {...field}
                                data-testid="input-image-description"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="flex justify-end gap-2 pt-4">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => setIsUploadDialogOpen(false)}
                          data-testid="button-cancel-upload"
                        >
                          Cancel
                        </Button>
                        <Button 
                          type="submit" 
                          disabled={!selectedFile || uploadMutation.isPending}
                          data-testid="button-confirm-upload"
                        >
                          {uploadMutation.isPending ? "Uploading..." : "Upload"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <p className="text-muted-foreground">Loading images...</p>
              </div>
            ) : apiGalleryImages.length === 0 ? (
              <div className="text-center py-8">
                <Image className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-2">No images uploaded yet</p>
                <p className="text-sm text-muted-foreground">
                  Upload your first image to get started
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {apiGalleryImages.map((image: SchoolGalleryImage) => (
                  <div
                    key={image.id}
                    className="relative group bg-white/5 rounded-lg overflow-hidden border border-white/10"
                  >
                    <img
                      src={image.imageUrl}
                      alt={image.title || 'Gallery image'}
                      className="w-full h-32 object-cover"
                      data-testid={`img-gallery-${image.id}`}
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                          onClick={() => handleDelete(image.id)}
                          data-testid={`button-delete-${image.id}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    {image.title && (
                      <div className="p-2">
                        <p className="text-xs text-white/80 truncate" data-testid={`text-title-${image.id}`}>
                          {image.title}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      
    </div>
  );
}