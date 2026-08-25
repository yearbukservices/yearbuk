import { useState, useEffect, useRef } from "react";
import { useRoute, Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import ReCAPTCHA from "react-google-recaptcha";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileImage, X, CheckCircle, AlertCircle, Clock, Users, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { BETA_VERSION } from "@shared/constants";

// Form schema for guest upload
const guestUploadSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  uploadedBy: z.string().min(1, "Your name is required"),
  file: z.instanceof(File).refine((file) => file.size <= 20 * 1024 * 1024, "File must be less than 20MB")
});

type GuestUploadForm = z.infer<typeof guestUploadSchema>;

// Multiple upload form interface
interface MultipleUploadFile {
  file: File;
  title: string;
  description: string;
  id: string;
}

// Multiple upload form schema
const multipleUploadFormSchema = z.object({
  uploadedBy: z.string().min(1, "Your name is required"),
  files: z.array(z.object({
    file: z.instanceof(File),
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    id: z.string()
  })).min(1, "At least one file is required")
    .refine((files) => {
      const totalSize = files.reduce((sum, item) => sum + item.file.size, 0);
      return totalSize <= 10 * 1024 * 1024;
    }, "Total file size must not exceed 10MB")
});

type MultipleUploadForm = z.infer<typeof multipleUploadFormSchema>;

interface UploadLinkInfo {
  id: string;
  schoolId: string;
  schoolName: string | null;
  year: number;
  category: string;
  isValid: boolean;
}

export default function GuestUpload() {
  const [match, params] = useRoute("/guest-upload/:code?"); // Make code optional
  const urlCode = params?.code; // Code from URL if provided
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [linkInfo, setLinkInfo] = useState<UploadLinkInfo | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [enteredCode, setEnteredCode] = useState<string>("");
  const [verifiedCode, setVerifiedCode] = useState<string>(""); // The actual verified code to use for upload
  const [codeVerified, setCodeVerified] = useState<boolean>(false);
  const [codeValidating, setCodeValidating] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>("single");
  const [recaptchaToken, setRecaptchaToken] = useState<string>(""); // reCAPTCHA token
  const recaptchaRef = useRef<ReCAPTCHA>(null);

  // Set custom page title
  useEffect(() => {
    document.title = "Upload - Yearbuk";
  }, []);
  
  // Multiple upload state
  const [multipleFiles, setMultipleFiles] = useState<MultipleUploadFile[]>([]);
  const [uploaderName, setUploaderName] = useState<string>("");
  
  // Add local submission tracking to prevent rapid clicks
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMultipleSubmitting, setIsMultipleSubmitting] = useState(false);
  
  const { toast } = useToast();

  // Smart redirect logic for logged-in viewer/alumni users
  useEffect(() => {
    const checkUserAndRedirect = () => {
      try {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          const user = JSON.parse(storedUser);
          // Redirect viewer/alumni users to their dashboard with memory upload tab
          if (user.userType === 'viewer') {
            // Redirect to viewer dashboard with memory upload tab
            const dashboardUrl = urlCode 
              ? `/?tab=memory_upload&code=${urlCode}`
              : '/?tab=memory_upload';
            window.location.href = dashboardUrl;
            return;
          }
        }
      } catch (error) {
        console.error('Error checking user for redirect:', error);
        // Continue with guest upload flow if there's an error
      }
    };

    checkUserAndRedirect();
  }, [urlCode]);

  const form = useForm<GuestUploadForm>({
    resolver: zodResolver(guestUploadSchema),
    defaultValues: {
      title: "",
      description: "",
      uploadedBy: ""
    }
  });

  // Validate upload link when code is provided
  const validateCode = async (codeToValidate: string) => {
    if (!codeToValidate) return;
    
    setCodeValidating(true);
    setLinkError(null);
    
    try {
      // Don't use reCAPTCHA token for code validation - save it for upload
      const url = `/api/public-upload-links/${codeToValidate}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const error = await response.json();
        setLinkError(error.message || "Invalid upload code");
        setCodeVerified(false);
        return;
      }
      
      const linkData = await response.json();
      setLinkInfo(linkData);
      setVerifiedCode(codeToValidate); // Store the verified code
      setCodeVerified(true);
      toast({
        className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Code verified!",
        description: "You can now upload your photos."
      });
    } catch (error) {
      setLinkError("Failed to validate upload code");
      setVerifiedCode(""); // Clear verified code on error
      setCodeVerified(false);
    } finally {
      setCodeValidating(false);
    }
  };

  // Don't auto-validate URL codes - require manual verification
  // useEffect(() => {
  //   if (urlCode) {
  //     validateCode(urlCode);
  //   }
  // }, [urlCode]);

  // Handle manual code submission
  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // reCAPTCHA is only needed for actual upload, not code validation
    if (enteredCode.trim()) {
      validateCode(enteredCode.trim());
    }
  };
  
  // Check if user is logged in to determine verification visibility
  const isUserLoggedIn = () => {
    try {
      const storedUser = localStorage.getItem('user');
      return !!storedUser;
    } catch {
      return false;
    }
  };

  // File selection handler
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      
      // Create preview URL
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      
      // Update form with file
      form.setValue('file', file);
    }
  };

  // Remove selected file
  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl("");
    }
    form.setValue('file', undefined as any);
  };

  // Multiple file selection handler
  const handleMultipleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    // Generate default title based on category and year
    const defaultTitle = linkInfo ? `${getCategoryDisplayName(linkInfo.category)} ${linkInfo.year}` : "Memory";
    
    // Generate unique IDs and create upload items
    const newUploadFiles: MultipleUploadFile[] = files.map(file => ({
      file,
      title: defaultTitle,
      description: "",
      id: Math.random().toString(36).substr(2, 9)
    }));
    
    // Check total size including existing files
    const existingSize = multipleFiles.reduce((sum, item) => sum + item.file.size, 0);
    const newSize = newUploadFiles.reduce((sum, item) => sum + item.file.size, 0);
    const totalSize = existingSize + newSize;
    
    if (totalSize > 10 * 1024 * 1024) {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "File size limit exceeded",
        description: "Total file size cannot exceed 10MB",
        variant: "destructive"
      });
      return;
    }
    
    setMultipleFiles(prev => [...prev, ...newUploadFiles]);
    
    // Clear the input
    event.target.value = '';
  };

  // Remove file from multiple upload
  const handleRemoveMultipleFile = (id: string) => {
    setMultipleFiles(prev => prev.filter(item => item.id !== id));
  };

  // Update file details in multiple upload
  const updateMultipleFileDetails = (id: string, field: 'title' | 'description', value: string) => {
    setMultipleFiles(prev => prev.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  // Get total size of multiple files
  const getTotalSize = () => {
    return multipleFiles.reduce((sum, item) => sum + item.file.size, 0);
  };

  // Get formatted size
  const formatSize = (bytes: number) => {
    return (bytes / (1024 * 1024)).toFixed(2);
  };

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (data: GuestUploadForm) => {
      if (!verifiedCode) throw new Error('No verified upload code provided');
      
      // Check if user is logged in
      const storedUser = localStorage.getItem('user');
      const isLoggedIn = !!storedUser;
      const userId = storedUser ? JSON.parse(storedUser).id : null;
      
      // For unregistered users, get a fresh reCAPTCHA token (skipped in beta mode)
      let freshToken = recaptchaToken;
      if (!isLoggedIn && !BETA_VERSION) {
        if (recaptchaRef.current) {
          // Reset and execute reCAPTCHA to get a fresh token
          recaptchaRef.current.reset();
          freshToken = await recaptchaRef.current.executeAsync() || "";
          setRecaptchaToken(freshToken);
        }
        
        if (!freshToken) {
          throw new Error('Please complete the reCAPTCHA verification');
        }
      }
      
      const formData = new FormData();
      formData.append('memoryFile', data.file);
      formData.append('title', data.title);
      formData.append('description', data.description || '');
      formData.append('uploadedBy', data.uploadedBy);
      
      // Add fresh reCAPTCHA token for unregistered users (skipped in beta mode)
      if (!isLoggedIn && !BETA_VERSION) {
        formData.append('recaptchaToken', freshToken);
      }

      // Prepare headers for logged-in users
      const headers: HeadersInit = {};
      if (isLoggedIn && userId) {
        headers['Authorization'] = `Bearer ${userId}`;
      }

      const response = await fetch(`/api/public-uploads/${verifiedCode}`, {
        method: 'POST',
        headers,
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }
      
      return response.json();
    },
    onMutate: () => {
      setIsSubmitting(true);
    },
    onSuccess: (data) => {
      setUploadSuccess(true);
      setIsSubmitting(false);
      toast({
        className: "bg-green-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "✅ Upload successful!",
        description: "Your photo has been submitted and is pending school approval. You can upload another one if you'd like.",
        duration: 8000
      });
      
      // Reset form
      form.reset();
      handleRemoveFile();
      
      // Reset reCAPTCHA for next upload
      if (recaptchaRef.current) {
        recaptchaRef.current.reset();
        setRecaptchaToken("");
      }
    },
    onError: (error) => {
      setIsSubmitting(false);
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive"
      });
      
      // Reset reCAPTCHA on error so user can try again
      if (recaptchaRef.current) {
        recaptchaRef.current.reset();
        setRecaptchaToken("");
      }
    }
  });

  // Multiple upload mutation
  const multipleUploadMutation = useMutation({
    mutationFn: async () => {
      if (!verifiedCode) throw new Error('No verified upload code provided');
      if (multipleFiles.length === 0) throw new Error('No files selected');
      if (!uploaderName.trim()) throw new Error('Uploader name is required');
      
      // Validate all files have titles
      const missingTitles = multipleFiles.filter(item => !item.title.trim());
      if (missingTitles.length > 0) {
        throw new Error('All files must have titles');
      }
      
      // Check if user is logged in
      const storedUser = localStorage.getItem('user');
      const isLoggedIn = !!storedUser;
      const userId = storedUser ? JSON.parse(storedUser).id : null;
      
      const results: any[] = [];
      
      // Upload each file individually
      for (const fileItem of multipleFiles) {
        // For unregistered users, get a fresh reCAPTCHA token for each upload (skipped in beta mode)
        let freshToken = recaptchaToken;
        if (!isLoggedIn && !BETA_VERSION) {
          if (recaptchaRef.current) {
            recaptchaRef.current.reset();
            freshToken = await recaptchaRef.current.executeAsync() || "";
            setRecaptchaToken(freshToken);
          }
          
          if (!freshToken) {
            throw new Error('Please complete the reCAPTCHA verification');
          }
        }
        
        const formData = new FormData();
        formData.append('memoryFile', fileItem.file);
        formData.append('title', fileItem.title);
        formData.append('description', fileItem.description || '');
        formData.append('uploadedBy', uploaderName);
        
        // Add fresh reCAPTCHA token for unregistered users (skipped in beta mode)
        if (!isLoggedIn && !BETA_VERSION) {
          formData.append('recaptchaToken', freshToken);
        }

        // Prepare headers for logged-in users
        const headers: HeadersInit = {};
        if (isLoggedIn && userId) {
          headers['Authorization'] = `Bearer ${userId}`;
        }

        const response = await fetch(`/api/public-uploads/${verifiedCode}`, {
          method: 'POST',
          headers,
          body: formData
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(`Failed to upload ${fileItem.title}: ${error.message}`);
        }
        
        const result = await response.json();
        results.push(result);
      }
      
      return results;
    },
    onMutate: () => {
      setIsMultipleSubmitting(true);
    },
    onSuccess: (data) => {
      setUploadSuccess(true);
      setIsMultipleSubmitting(false);
      toast({
        className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Upload successful",
        description: `${multipleFiles.length} files have been submitted and are pending approval.`
      });
      
      // Reset multiple upload state
      setMultipleFiles([]);
      setUploaderName("");
      
      // Reset reCAPTCHA for next upload
      if (recaptchaRef.current) {
        recaptchaRef.current.reset();
        setRecaptchaToken("");
      }
    },
    onError: (error) => {
      setIsMultipleSubmitting(false);
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive"
      });
      
      // Reset reCAPTCHA on error so user can try again
      if (recaptchaRef.current) {
        recaptchaRef.current.reset();
        setRecaptchaToken("");
      }
    }
  });

  const onSubmit = (data: GuestUploadForm) => {
    // Prevent multiple submissions
    if (isSubmitting || uploadMutation.isPending) {
      return;
    }
    uploadMutation.mutate(data);
  };

  const handleMultipleUpload = () => {
    // Prevent multiple submissions
    if (isMultipleSubmitting || multipleUploadMutation.isPending) {
      return;
    }
    multipleUploadMutation.mutate();
  };

  const getCategoryDisplayName = (category: string) => {
    const categoryMap: Record<string, string> = {
      'graduation': 'Graduation',
      'sports': 'Sports',
      'arts': 'Arts',
      'field_trips': 'Field Trips',
      'academic': 'Academic'
    };
    return categoryMap[category] || category;
  };

  // Show code entry form if no code verified yet
  if (!codeVerified) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center text-white text-2xl">
              <Upload className="h-6 w-6 mr-2" />
              Enter Upload Code
            </CardTitle>
            <p className="text-blue-100">
              Please enter the upload code provided by your school to access the upload form.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCodeSubmit} className="space-y-4">
              <div>
                <Input
                  type="text"
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  value={enteredCode}
                  onChange={(e) => {
                    // Format input as XXXX-XXXX-XXXX-XXXX (allow alphanumeric characters)
                    let value = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 16);
                    if (value.length > 4 && value.length <= 8) {
                      value = value.slice(0, 4) + '-' + value.slice(4);
                    } else if (value.length > 8 && value.length <= 12) {
                      value = value.slice(0, 4) + '-' + value.slice(4, 8) + '-' + value.slice(8);
                    } else if (value.length > 12) {
                      value = value.slice(0, 4) + '-' + value.slice(4, 8) + '-' + value.slice(8, 12) + '-' + value.slice(12);
                    }
                    setEnteredCode(value);
                  }}
                  className="bg-white/10 backdrop-blur-lg text-white placeholder-white/60 border-white/20 focus-visible:ring-white/30 focus-visible:ring-offset-0 placeholder:text-white"
                  disabled={codeValidating}
                  data-testid="input-upload-code"
                  maxLength={19}
                />
              </div>
              
              {/* reCAPTCHA verification - only for unregistered users and non-beta mode */}
              {!isUserLoggedIn() && !BETA_VERSION && (
                <div className="flex justify-center">
                  <ReCAPTCHA
                    ref={recaptchaRef}
                    sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY || ""}
                    onChange={(token) => setRecaptchaToken(token || "")}
                    onExpired={() => setRecaptchaToken("")}
                    theme="dark"
                    data-testid="recaptcha-widget"
                  />
                </div>
              )}
              
              {linkError && (
                <div className="text-red-400 text-sm text-center bg-red-400/10 p-3 rounded-lg border border-red-400/20">
                  {linkError}
                </div>
              )}
              
              <Button
                type="submit"
                disabled={!enteredCode.trim() || codeValidating}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 backdrop-blur-lg border border-blue-200 shadow-2xl transition-all hover:bg-white/15 hover:scale-105 hover:shadow-blue-500/50 hover:shadow-lg duration-200"
                data-testid="button-verify-code"
              >
                {codeValidating ? "Verifying..." : "Verify Code"}
              </Button>
            </form>
            
            <div className="mt-6 text-center">
              <p className="text-sm text-blue-200">
                Don't have an upload code? Contact your school administration.
              </p>
              <p className="text-sm text-blue-200 mt-2">
                Have an account?{" "}
                <Link href="/" data-testid="link-login">
                  <span className="text-blue-300 hover:text-white underline cursor-pointer transition-colors">
                    Login
                  </span>
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }



  if (uploadSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
          <CardContent className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-white mb-2">Upload Successful!</h1>
            <p className="text-blue-100 mb-4">
              Your photo has been submitted and is pending approval by the school.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setUploadSuccess(false);
                setMultipleFiles([]);
                setUploaderName("");
                setActiveTab("single");
              }}
              className="text-white border-white/50 hover:bg-white/10 hover:text-white bg-white/10"
              data-testid="button-upload-another"
            >
              Upload Another
            </Button>
            <p className="text-sm text-blue-200 mt-4">
              want to access your school memories and yearbooks?{" "}
              <Link href="/viewer-signup" data-testid="link-create-account">
                <span className="text-blue-300 hover:text-white underline cursor-pointer transition-colors">
                  create an account
                </span>
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 relative overflow-hidden">
      {/* Main Animated Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-20 left-20 w-32 h-32 bg-white rounded-full opacity-20 animate-float"></div>
          <div className="absolute top-60 right-40 w-24 h-24 bg-white rounded-full opacity-20 animate-float-delayed"></div>
          <div className="absolute bottom-40 left-40 w-20 h-20 bg-white rounded-full opacity-20 animate-float"></div>
          <div className="absolute bottom-20 right-20 w-16 h-16 bg-white rounded-full opacity-20 animate-float-delayed"></div>
        </div>
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          {/* Header Card */}
          <Card className="mb-6 bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center text-white text-2xl">
                <Users className="h-6 w-6 mr-2" />
                Upload to {linkInfo?.schoolName || 'Yearbook'}
              </CardTitle>
              <div className="space-y-2">
                <p className="text-blue-100">
                  Category: <span className="font-medium text-white">{linkInfo ? getCategoryDisplayName(linkInfo.category) : 'Loading...'}</span>
                </p>
                <p className="text-blue-100">
                  Year: <span className="font-medium text-white">{linkInfo ? linkInfo.year : 'Loading...'}</span>
                </p>
                <p className="text-sm text-blue-200">
                  Share your memories! Your uploads will be reviewed by the school before appearing in the yearbook.
                </p>
              </div>
            </CardHeader>
          </Card>

          {/* Upload Form */}
          <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
            <CardHeader>
              <CardTitle className="flex items-center text-white">
                <Upload className="h-5 w-5 mr-2" />
                Upload Photos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
                <TabsList className="grid w-full grid-cols-2 bg-white/5 border border-white/20">
                  <TabsTrigger 
                    value="single" 
                    className="data-[state=active]:bg-white/20 data-[state=active]:text-white text-white/70"
                    data-testid="tab-single-upload"
                  >
                    Single Upload
                  </TabsTrigger>
                  <TabsTrigger 
                    value="multiple" 
                    className="data-[state=active]:bg-white/20 data-[state=active]:text-white text-white/70"
                    data-testid="tab-multiple-upload"
                  >
                    Multiple Upload
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="single" className="mt-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* File Upload Section */}
                  <div className="border-2 border-dashed border-white/30 bg-white/5 backdrop-blur-lg rounded-lg p-6">
                    {!selectedFile ? (
                      <div className="text-center">
                        <Upload className="h-12 w-12 text-blue-200 mx-auto mb-4" />
                        <div className="mb-4">
                          <label htmlFor="file-upload" className="cursor-pointer">
                            <span className="text-lg font-medium text-white">Choose photo</span>
                            <br />
                            <span className="text-sm text-blue-100">
                              Click to select a file (Max 20MB)
                            </span>
                          </label>
                          <input
                            id="file-upload"
                            type="file"
                            accept="image/*"
                            onChange={handleFileSelect}
                            className="hidden"
                            data-testid="input-guest-file"
                          />
                        </div>
                        <p className="text-xs text-blue-100">
                          Supported formats: JPG, PNG, MP4, MOV, etc.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <FileImage className="h-8 w-8 text-blue-600" />
                            <div>
                              <p className="font-medium text-white">{selectedFile.name}</p>
                              <p className="text-sm text-blue-100">
                                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                              </p>
                            </div>
                          </div>
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm" 
                            onClick={handleRemoveFile}
                            data-testid="button-remove-guest-file"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        {selectedFile.type.startsWith('image/') && (
                          <img 
                            src={previewUrl} 
                            alt="Preview" 
                            className="max-h-48 rounded-lg mx-auto" 
                          />
                        )}
                        
                        {selectedFile.type.startsWith('video/') && (
                          <video 
                            src={previewUrl} 
                            controls 
                            className="max-h-48 rounded-lg mx-auto" 
                          />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Your Name Field */}
                  <FormField
                    control={form.control}
                    name="uploadedBy"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">Your Full Name</FormLabel>
                        <FormLabel className="text-red-500"> *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="" 
                            className="bg-white/10 backdrop-blur-lg text-white placeholder-white/60 border-white/20 focus-visible:ring-white/30 focus-visible:ring-offset-0"
                            {...field} 
                            data-testid="input-uploaded-by"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Title Field */}
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">Title</FormLabel>
                        <FormLabel className="text-red-500"> *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="" 
                            className="bg-white/10 backdrop-blur-lg text-white placeholder-white/60 border-white/20 focus-visible:ring-white/30 focus-visible:ring-offset-0"
                            {...field} 
                            data-testid="input-guest-title"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Description Field */}
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">Description (Optional)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="" 
                            className="resize-none bg-white/10 backdrop-blur-lg text-white placeholder-white/60 border-white/20 focus-visible:ring-white/30 focus-visible:ring-offset-0" 
                            rows={3} 
                            {...field} 
                            data-testid="textarea-guest-description"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Submit Button */}
                  <div className="flex justify-center">
                    <Button 
                      type="submit"
                      disabled={uploadMutation.isPending || isSubmitting || !codeVerified || !verifiedCode || !selectedFile}
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 backdrop-blur-lg border border-blue-200 shadow-2xl transition-all hover:bg-white/15 hover:scale-105 hover:shadow-blue-500/50 hover:shadow-lg duration-200 px-8 disabled:opacity-50 disabled:cursor-not-allowed"
                      data-testid="button-submit-guest-upload"
                    >
                      {(uploadMutation.isPending || isSubmitting) ? "⏳ Uploading... Please wait" : 
                       !codeVerified ? "Verify upload code first" : "Upload"}
                    </Button>
                  </div>
                </form>
              </Form>
                </TabsContent>

                <TabsContent value="multiple" className="mt-6">
                  <div className="space-y-6">
                    {/* Your Name Field for Multiple Upload */}
                    <div>
                      <label className="text-white font-medium">Your Full Name <span className="text-red-500">*</span></label>
                      <Input 
                        placeholder="" 
                        value={uploaderName}
                        onChange={(e) => setUploaderName(e.target.value)}
                        className="mt-2 bg-white/10 backdrop-blur-lg text-white placeholder-white/60 border-white/20 focus-visible:ring-white/30 focus-visible:ring-offset-0"
                        data-testid="input-multiple-uploader-name"
                      />
                    </div>

                    {/* File Selection Area */}
                    <div className="border-2 border-dashed border-white/30 bg-white/5 backdrop-blur-lg rounded-lg p-6">
                      <div className="text-center">
                        <Upload className="h-12 w-12 text-blue-200 mx-auto mb-4" />
                        <div className="mb-4">
                          <label htmlFor="multiple-file-upload" className="cursor-pointer">
                            <span className="text-lg font-medium text-white">Add photos</span>
                            <br />
                            <span className="text-sm text-blue-100">
                              Click to select multiple files (Total max 10MB)
                            </span>
                          </label>
                          <input
                            id="multiple-file-upload"
                            type="file"
                            accept="image/*"
                            onChange={handleMultipleFileSelect}
                            className="hidden"
                            multiple
                            data-testid="input-multiple-files"
                          />
                        </div>
                        <p className="text-xs text-blue-100">
                          Total size: {formatSize(getTotalSize())} MB / 10 MB
                        </p>
                      </div>
                    </div>

                    {/* Selected Files List */}
                    {multipleFiles.length > 0 && (
                      <div className="space-y-4">
                        <h3 className="text-white font-medium">Selected Files ({multipleFiles.length})</h3>
                        {multipleFiles.map((fileItem) => (
                          <Card key={fileItem.id} className="bg-white/5 border-white/10">
                            <CardContent className="p-4">
                              <div className="flex items-start space-x-4">
                                <div className="flex-shrink-0">
                                  <div className="relative">
                                    <img 
                                      src={URL.createObjectURL(fileItem.file)} 
                                      alt="Preview" 
                                      className="w-16 h-16 object-cover rounded-lg border border-white/20" 
                                    />
                                    <FileImage className="absolute -bottom-1 -right-1 h-4 w-4 text-blue-600 bg-white rounded-full p-0.5" />
                                  </div>
                                </div>
                                
                                <div className="flex-1 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="font-medium text-white">{fileItem.file.name}</p>
                                      <p className="text-sm text-blue-100">
                                        {formatSize(fileItem.file.size)} MB
                                      </p>
                                    </div>
                                    <Button 
                                      type="button" 
                                      variant="outline" 
                                      size="sm" 
                                      onClick={() => handleRemoveMultipleFile(fileItem.id)}
                                      data-testid={`button-remove-file-${fileItem.id}`}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                  
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                      <label className="text-white text-sm">Title <span className="text-red-500">*</span></label>
                                      <Input 
                                        placeholder="Enter title" 
                                        value={fileItem.title}
                                        onChange={(e) => updateMultipleFileDetails(fileItem.id, 'title', e.target.value)}
                                        className="mt-1 bg-white/10 backdrop-blur-lg text-white placeholder-white/60 border-white/20 focus-visible:ring-white/30 focus-visible:ring-offset-0"
                                        data-testid={`input-title-${fileItem.id}`}
                                      />
                                    </div>
                                    <div>
                                      <label className="text-white text-sm">Description (Optional)</label>
                                      <Input 
                                        placeholder="" 
                                        value={fileItem.description}
                                        onChange={(e) => updateMultipleFileDetails(fileItem.id, 'description', e.target.value)}
                                        className="mt-1 bg-white/10 backdrop-blur-lg text-white placeholder-white/60 border-white/20 focus-visible:ring-white/30 focus-visible:ring-offset-0"
                                        data-testid={`input-description-${fileItem.id}`}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}

                    {/* Upload Button for Multiple */}
                    <div className="flex justify-center">
                      <Button 
                        onClick={handleMultipleUpload}
                        disabled={
                          multipleUploadMutation.isPending || 
                          isMultipleSubmitting ||
                          !codeVerified || 
                          !verifiedCode || 
                          multipleFiles.length === 0 || 
                          !uploaderName.trim() ||
                          multipleFiles.some(item => !item.title.trim()) ||
                          getTotalSize() > 10 * 1024 * 1024
                        }
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 backdrop-blur-lg border border-blue-200 shadow-2xl transition-all hover:bg-white/15 hover:scale-105 hover:shadow-blue-500/50 hover:shadow-lg duration-200 px-8"
                        data-testid="button-submit-multiple-upload"
                      >
                        {(multipleUploadMutation.isPending || isMultipleSubmitting) ? "Uploading..." : 
                         !codeVerified ? "Verify upload code first" : 
                         multipleFiles.length === 0 ? "Select files first" :
                         !uploaderName.trim() ? "Enter your name" :
                         multipleFiles.some(item => !item.title.trim()) ? "Add titles to all files" :
                         getTotalSize() > 10 * 1024 * 1024 ? "File size exceeds 10MB" :
                         `Upload ${multipleFiles.length} Memories`}
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card className="mt-6 bg-white/5 backdrop-blur-lg border border-white/10 shadow-xl">
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <p className="text-sm text-blue-200">
                  Your upload will be reviewed by the school administration
                </p>
                <p className="text-sm text-blue-200">
                  Only approved photos will appear in the memories section
                </p>
                <p className="text-sm text-blue-200">
                  Thank you for contributing to the school's memories!
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Login Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-white/80">
              Already have an account?{" "}
              <Link
                href="/login"
                className="text-blue-300 hover:text-blue-200 font-semibold underline transition-colors"
                data-testid="link-login"
              >
                Login here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}