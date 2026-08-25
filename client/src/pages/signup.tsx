import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, GraduationCap, Eye, School, Users, Building, CheckCircle, Loader2, Search } from "lucide-react";
import { z } from "zod";
import { countries, statesByCountry, getCountryByCode, Country, State } from "@/lib/countries";
import { apiRequest } from "@/lib/queryClient";

const signupSchema = z.object({
  userType: z.enum(["viewer", "school"]),
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(1, "Confirm password is required"),
  firstName: z.string().min(1, "First name is required"),
  middleName: z.string().optional(),
  lastName: z.string().min(1, "Last name is required"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  email: z.string().email("Valid email is required"),
  countryCode: z.string().optional(),
  phoneNumber: z.string().optional(),
}).refine((data) => {
  // Phone number validation based on user type
  if (data.userType === "viewer") {
    if (!data.phoneNumber || data.phoneNumber === "") {
      return false;
    }
    return /^\d{10}$/.test(data.phoneNumber);
  }
  // For other user types, if phone is provided, validate format
  if (data.phoneNumber && data.phoneNumber !== "") {
    return /^\d{10}$/.test(data.phoneNumber);
  }
  return true;
}, {
  message: "Phone number is required for viewer accounts and must be 10 digits",
  path: ["phoneNumber"],
}).refine((data) => {
  return data.password === data.confirmPassword;
}, {
  message: "Passwords must match",
  path: ["confirmPassword"],
});

type SignupForm = z.infer<typeof signupSchema>;

export default function Signup() {
  const [, setLocation] = useLocation();
  const [selectedAccountType, setSelectedAccountType] = useState<string | null>(null);
  const { toast } = useToast();
  
  // Phone number state
  const [selectedPhoneCountry, setSelectedPhoneCountry] = useState<Country | null>(null);
  const [phoneCountrySearch, setPhoneCountrySearch] = useState("");
  const [isPhoneCountryOpen, setIsPhoneCountryOpen] = useState(false);
  
  // Ref for phone country dropdown
  const phoneCountryDropdownRef = useRef<HTMLDivElement>(null);

  // Close phone country dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (phoneCountryDropdownRef.current && !phoneCountryDropdownRef.current.contains(event.target as Node)) {
        setIsPhoneCountryOpen(false);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const form = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      username: "",
      password: "",
      confirmPassword: "",
      firstName: "",
      middleName: "",
      lastName: "",
      dateOfBirth: "",
      email: "",
      countryCode: "",
      phoneNumber: "",
    },
  });

  const signupMutation = useMutation({
    mutationFn: async (data: SignupForm) => {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Signup failed");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Account created successfully!",
        description: "Please verify your email before logging in.",
      });
      
      setLocation(
        `/email-verification?email=${encodeURIComponent(data.user.email)}&userId=${encodeURIComponent(data.user.id)}`
      );
    },
    onError: (error: Error) => {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Signup failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SignupForm) => {
    // Combine country code and phone number if both are provided
    let formattedData = { ...data };
    if (data.countryCode && data.phoneNumber) {
      // Convert to the expected format +countrycodeXXXXXXXXXX
      const countryCodeClean = data.countryCode.replace(/^\+/, ""); // Remove + if present
      formattedData.phoneNumber = `+${countryCodeClean}${data.phoneNumber}`;
    } else if (!data.phoneNumber) {
      formattedData.phoneNumber = "";
    }
    
    // Remove countryCode from the final data as backend expects phoneNumber in the combined format
    delete formattedData.countryCode;
    
    signupMutation.mutate(formattedData);
  };

  if (!selectedAccountType) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Animated Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-full h-full">
            <div className="absolute top-20 left-20 w-32 h-32 bg-white rounded-full opacity-5 animate-float"></div>
            <div className="absolute top-60 right-40 w-24 h-24 bg-white rounded-full opacity-5 animate-float-delayed"></div>
            <div className="absolute bottom-40 left-40 w-20 h-20 bg-white rounded-full opacity-5 animate-float"></div>
            <div className="absolute bottom-20 right-20 w-16 h-16 bg-white rounded-full opacity-5 animate-float-delayed"></div>
          </div>
        </div>
        
        <div className="w-full max-w-2xl space-y-8 relative z-10">
          {/* Header */}
          <div className="text-center">
            <Button
              variant="ghost"
              onClick={() => setLocation("/")}
              className="mb-6 text-blue-600 hover:text-blue-800"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Login
            </Button>
            <h1 className="text-4xl font-bold text-white mb-2">Create Your Account</h1>
            <p className="text-lg text-blue-100">Choose the type of account you'd like to create</p>
          </div>

          {/* Account Type Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

            {/* Viewer/Alumni Account */}
            <Card 
              className="bg-green-500/20 backdrop-blur-lg border border-green-200 shadow-2xl cursor-pointer transition-all hover:bg-white/15 hover:scale-105 hover:border-green-400 hover:shadow-green-500/50 hover:shadow-lg hover:scale-105 transition-all duration-200"
              onClick={() => setLocation("/viewer-signup")}
            >
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 bg-green-500/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4">
                  <Eye className="w-8 h-8 text-green-500" />
                </div>
                <CardTitle className="text-xl text-green-500">Viewer/Alumni</CardTitle>
                <CardDescription className="text-sm text-green-50">
                  Browse school yearbooks and memories as a parent, alumni, or external viewer
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="text-sm text-green-50 space-y-2">
                  <li>• Browse multiple schoolss</li>
                  <li>• View yearbook memories</li>
                  <li>• Access public galleries</li>
                  <li>• Cross-year navigation</li>
                </ul>
              </CardContent>
            </Card>

            {/* School Registration */}
            <Card 
              className="bg-orange-500/20 backdrop-blur-lg border border-orange-200 shadow-2xl cursor-pointer transition-all hover:bg-orange-310 hover:scale-105 hover:border-orange-400 hover:shadow-orange-500/50 hover:shadow-lg hover:scale-105 transition-all duration-200"
              onClick={() => setLocation("/school-signup")}
            >
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 bg-orange-100 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4">
                  <School className="w-8 h-8 text-orange-500" />
                </div>
                <CardTitle className="text-xl text-orange-500">School Administrator</CardTitle>
                <CardDescription className="text-sm text-orange-50">
                  Register your school and manage yearbooks, and memories
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="text-sm text-orange-50 space-y-2">
                  <li>• Manage school profile</li>
                  <li>• Approve alumni</li>
                  <li>• Upload school memories</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-20 left-20 w-32 h-32 bg-white rounded-full opacity-5 animate-float"></div>
          <div className="absolute top-60 right-40 w-24 h-24 bg-white rounded-full opacity-5 animate-float-delayed"></div>
          <div className="absolute bottom-40 left-40 w-20 h-20 bg-white rounded-full opacity-5 animate-float"></div>
          <div className="absolute bottom-20 right-20 w-16 h-16 bg-white rounded-full opacity-5 animate-float-delayed"></div>
        </div>
      </div>

      <Card className="w-full max-w-md relative z-10 bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
        <CardHeader className="text-center">
          <Button
            variant="ghost"
            onClick={() => setSelectedAccountType(null)}
            className="mb-4 text-blue-200 hover:text-white hover:bg-white/20 self-start"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Account Types
          </Button>
          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4">
            {selectedAccountType === "viewer" && <Eye className="text-white text-lg" />}
            {selectedAccountType === "school" && <School className="text-white text-lg" />}
          </div>
          <CardTitle className="text-2xl font-bold text-white">
            Create {selectedAccountType === "viewer" ? "Viewer/Alumni" : "School Administrator"} Account
          </CardTitle>
          <CardDescription className="text-blue-100">
            Fill in the details below to create your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Username */}
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter username" {...field} data-testid="input-username" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Password */}
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password *</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Enter password" {...field} data-testid="input-password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Confirm Password - Required for viewer */}
              {selectedAccountType === "viewer" && (
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password *</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Confirm password" {...field} data-testid="input-confirm-password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              
              {/* Personal Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="First name" {...field} data-testid="input-first-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Last name" {...field} data-testid="input-last-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              {/* Middle Name (Optional) */}
              <FormField
                control={form.control}
                name="middleName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Middle Name (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Middle name" {...field} data-testid="input-middle-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Date of Birth */}
              <FormField
                control={form.control}
                name="dateOfBirth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Birth *</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        {...field} 
                        max={new Date().toISOString().split('T')[0]}
                        data-testid="input-date-of-birth" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Email */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address *</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="Enter email" {...field} data-testid="input-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Phone Number with Country Code */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Phone Number {selectedAccountType === "viewer" ? "*" : "(Optional)"}
                </Label>
                <div className="flex space-x-2">
                  {/* Country Code Dropdown */}
                  <div className="w-24 sm:w-32 relative" ref={phoneCountryDropdownRef}>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-between h-10 px-2 sm:px-3 text-xs sm:text-sm"
                      onClick={() => setIsPhoneCountryOpen(!isPhoneCountryOpen)}
                      data-testid="button-country-code"
                    >
                      <span className="flex items-center space-x-1">
                        {selectedPhoneCountry ? (
                          <>
                            <span className="text-xs hidden sm:inline">{selectedPhoneCountry.flag}</span>
                            <span className="text-xs">{selectedPhoneCountry.dialCode}</span>
                          </>
                        ) : (
                          <span className="text-xs text-gray-500">Code</span>
                        )}
                      </span>
                    </Button>
                    
                    {isPhoneCountryOpen && (
                      <div className="absolute z-50 w-64 mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-hidden">
                        <div className="p-2 border-b border-gray-200">
                          <Input
                            type="text"
                            placeholder="Search countries..."
                            value={phoneCountrySearch}
                            onChange={(e) => setPhoneCountrySearch(e.target.value)}
                            className="w-full h-8"
                            data-testid="input-country-search"
                          />
                        </div>
                        <div className="max-h-40 overflow-y-auto">
                          {countries
                            .filter(country => 
                              country.name.toLowerCase().includes(phoneCountrySearch.toLowerCase()) ||
                              (country.dialCode && country.dialCode.includes(phoneCountrySearch))
                            )
                            .map((country) => (
                              <button
                                key={country.code}
                                type="button"
                                className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center space-x-2 text-xs"
                                onClick={() => {
                                  setSelectedPhoneCountry(country);
                                  form.setValue("countryCode", country.dialCode?.replace(/^\+/, ""));
                                  setIsPhoneCountryOpen(false);
                                  setPhoneCountrySearch("");
                                }}
                                data-testid={`option-country-${country.code}`}
                              >
                                <span>{country.flag}</span>
                                <span>{country.dialCode}</span>
                                <span className="truncate">{country.name}</span>
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Phone Number Input */}
                  <FormField
                    control={form.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input 
                            placeholder="Phone number" 
                            maxLength={10}
                            type="tel"
                            {...field} 
                            data-testid="input-phone-number"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              
              <Button 
                type="submit" 
                className="w-full" 
                disabled={signupMutation.isPending}
                data-testid="button-create-account"
              >
                {signupMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}