import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, Eye, CheckCircle, Loader2, Search, Check, Mail } from "lucide-react";
import { countries, Country } from "@/lib/countries";
import { apiRequest } from "@/lib/queryClient";

export default function ViewerSignup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Multi-step state
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  
  // Registration state
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Terms agreement state
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  
  // Phone number state
  const [selectedPhoneCountry, setSelectedPhoneCountry] = useState<Country | null>(null);
  const [phoneCountrySearch, setPhoneCountrySearch] = useState("");
  const [isPhoneCountryOpen, setIsPhoneCountryOpen] = useState(false);
  
  // Ref for phone country dropdown
  const phoneCountryDropdownRef = useRef<HTMLDivElement>(null);

  // Form state - All steps combined
  const [form, setForm] = useState({
    // Step 1: Personal Info
    firstName: "",
    middleName: "",
    lastName: "",
    dateOfBirth: "",
    
    // Step 2: Contact Info
    phoneNumber: "",
    countryCode: "",
    email: "",
    
    // Step 3: Account Setup
    username: "",
    password: "",
    confirmPassword: "",
  });

  // Close phone country dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (phoneCountryDropdownRef.current && !phoneCountryDropdownRef.current.contains(event.target as Node)) {
        setIsPhoneCountryOpen(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Filter countries based on search
  const filteredPhoneCountries = countries.filter(country =>
    country.name.toLowerCase().includes(phoneCountrySearch.toLowerCase()) ||
    (country.dialCode && country.dialCode.includes(phoneCountrySearch))
  );

  // Form handlers
  const handleFormChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  // Validation functions for each step
  const validateStep = (step: number): boolean => {
    setError("");
    
    switch (step) {
      case 1: // Personal Info
        if (!form.firstName || !form.lastName) {
          setError("First name and last name are required");
          return false;
        }
        if (!form.dateOfBirth) {
          setError("Date of birth is required");
          return false;
        }
        // Validate date of birth is not in the future
        const dobDate = new Date(form.dateOfBirth);
        const today = new Date();
        if (dobDate > today) {
          setError("Date of birth cannot be in the future");
          return false;
        }
        break;
        
      case 2: // Contact Info
        if (!form.email || !/\S+@\S+\.\S+/.test(form.email)) {
          setError("Valid email is required");
          return false;
        }
        if (!form.phoneNumber || !/^\d{10}$/.test(form.phoneNumber)) {
          setError("Phone number is required and must be 10 digits");
          return false;
        }
        if (!form.countryCode) {
          setError("Country code is required for phone number");
          return false;
        }
        break;
        
      case 3: // Account Setup
        if (!form.username || form.username.length < 3) {
          setError("Username must be at least 3 characters");
          return false;
        }
        if (!form.password || form.password.length < 6) {
          setError("Password must be at least 6 characters");
          return false;
        }
        if (form.password !== form.confirmPassword) {
          setError("Passwords must match");
          return false;
        }
        if (!agreeToTerms) {
          setError("You must agree to the terms and conditions");
          return false;
        }
        break;
    }
    
    return true;
  };

  // Next step handler
  const handleNextStep = () => {
    if (validateStep(currentStep)) {
      // Mark current step as completed
      setCompletedSteps(prev => [...prev.filter(s => s !== currentStep), currentStep]);
      
      // Move to next step
      if (currentStep < 3) {
        setCurrentStep(currentStep + 1);
        setError("");
      }
    }
  };

  // Previous step handler
  const handlePreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setError("");
    }
  };

  // Final form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateStep(3)) {
      return;
    }
    
    setIsLoading(true);
    setError("");
    
    try {
      // Format phone number with country code
      const formattedPhoneNumber = `+${form.countryCode.replace(/^\+/, "")}${form.phoneNumber}`;
      
      // Create full name
      const fullName = `${form.firstName}${form.middleName ? ` ${form.middleName}` : ""} ${form.lastName}`;
      
      const response = await apiRequest("POST", "/api/auth/signup", {
        userType: "viewer",
        username: form.username,
        password: form.password,
        firstName: form.firstName,
        middleName: form.middleName || "",
        lastName: form.lastName,
        fullName,
        dateOfBirth: form.dateOfBirth,
        email: form.email,
        phoneNumber: formattedPhoneNumber,
      });

      if (response.ok) {
        setRegisteredEmail(form.email);
        setRegistrationSuccess(true);
        toast({
          className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
          title: "Account Created!",
          description: "Your viewer/alumni account has been created successfully.",
        });
      } else {
        const errorData = await response.json();
        setError(errorData.message || "Registration failed. Please try again.");
      }
    } catch (error: any) {
      setError("Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Step Progress Component
  const StepProgress = () => (
    <div className="mb-6 sm:mb-8">
      <div className="flex items-center justify-between">
        {[1, 2, 3].map((step) => (
          <div key={step} className="flex items-center">
            <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium transition-all duration-300 ${
              step === currentStep 
                ? "bg-blue-600 text-white shadow-lg scale-110" 
                : completedSteps.includes(step)
                ? "bg-green-600 text-white shadow-md"
                : "bg-white/20 text-white border-2 border-white/30"
            }`}>
              {completedSteps.includes(step) ? <Check className="w-4 h-4 sm:w-5 sm:h-5" /> : step}
            </div>
            {step < 3 && (
              <div className={`w-8 sm:w-16 h-1 mx-1 sm:mx-2 rounded-full transition-all duration-300 ${
                completedSteps.includes(step) ? "bg-green-600" : "bg-white/20"
              }`} />
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-2 sm:mt-3 text-xs sm:text-sm text-white/80 font-medium">
        <span className="text-center">Personal</span>
        <span className="text-center">Contact</span>
        <span className="text-center">Account</span>
      </div>
    </div>
  );

  // Success page
  if (registrationSuccess) {
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
        
        <div className="w-full max-w-md relative z-10">
          <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                  <Mail className="h-8 w-8 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">E-Mail Verification</h2>
                  <p className="text-sm text-white/80 mt-2">
                    A verification e-mail was sent to <span className="font-semibold text-white">{registeredEmail}</span> in order to complete your registration.
                  </p>
                </div>
                
                <Button 
                  onClick={() => setLocation("/")}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  data-testid="button-continue-login"
                >
                  Continue to Login
                </Button>
              </div>
            </CardContent>
          </Card>
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

      <div className="w-full max-w-2xl relative z-10">
        <Card className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
          <CardHeader className="text-center">
            <Button
              variant="ghost"
              onClick={() => setLocation("/signup")}
              className="mb-4 text-white hover:text-white/80 self-start hover:bg-white/10"
              data-testid="button-back-to-signup"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Account Selection
            </Button>
            <div className="w-16 h-16 bg-green-500/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Eye className="w-8 h-8 text-green-500" />
            </div>
            <CardTitle className="text-2xl text-white">
              Viewer/Alumni Registration
            </CardTitle>
            <CardDescription className="text-white/80">
              Step {currentStep} of 3: {
                currentStep === 1 ? "Personal Information" :
                currentStep === 2 ? "Contact Information" :
                "Account Setup"
              }
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <StepProgress />

            {error && (
              <Alert className="mb-4 bg-red-500/10 border-red-500/20 backdrop-blur-lg" variant="destructive">
                <AlertDescription className="text-red-200">{error}</AlertDescription>
              </Alert>
            )}
            
            <form onSubmit={handleSubmit}>
              {/* Step 1: Personal Info */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-white mb-2">Personal Information</h3>
                    <p className="text-sm text-white/80">Tell us about yourself</p>
                  </div>
                  
                  {/* Name Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-white">First Name *</Label>
                      <Input
                        type="text"
                        value={form.firstName}
                        onChange={(e) => handleFormChange("firstName", e.target.value)}
                        required
                        placeholder="First name"
                        className="mt-1 bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/60"
                        data-testid="input-first-name"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-white">Middle Name</Label>
                      <Input
                        type="text"
                        value={form.middleName}
                        onChange={(e) => handleFormChange("middleName", e.target.value)}
                        placeholder="Middle name (optional)"
                        className="mt-1 bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/60"
                        data-testid="input-middle-name"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-white">Last Name *</Label>
                      <Input
                        type="text"
                        value={form.lastName}
                        onChange={(e) => handleFormChange("lastName", e.target.value)}
                        required
                        placeholder="Last name"
                        className="mt-1 bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/60"
                        data-testid="input-last-name"
                      />
                    </div>
                  </div>

                  {/* Date of Birth */}
                  <div>
                    <Label className="text-sm font-medium text-white">Date of Birth *</Label>
                    <Input
                      type="date"
                      value={form.dateOfBirth}
                      onChange={(e) => handleFormChange("dateOfBirth", e.target.value)}
                      required
                      max={new Date().toISOString().split('T')[0]}
                      className="mt-1 bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/60"
                      data-testid="input-date-of-birth"
                    />
                  </div>
                </div>
              )}

              {/* Step 2: Contact Info */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-white mb-2">Contact Information</h3>
                    <p className="text-sm text-white/80">How can we reach you?</p>
                  </div>
                  
                  {/* Phone Number with Country Code */}
                  <div>
                    <Label className="text-sm font-medium text-white">Phone Number</Label><Label className="text-sm font-medium text-red-500"> *</Label>
                    <div className="flex gap-2 mt-1">
                      {/* Country Code Dropdown */}
                      <div className="relative w-24 sm:w-32" ref={phoneCountryDropdownRef}>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsPhoneCountryOpen(!isPhoneCountryOpen)}
                          className="w-full justify-between h-10 text-xs sm:text-sm bg-white/10 backdrop-blur-lg border border-white/20 text-white hover:bg-white/20"
                          data-testid="button-country-code"
                        >
                          {selectedPhoneCountry ? selectedPhoneCountry.dialCode : "Code"}
                          <Search className="h-3 w-3 sm:h-4 sm:w-4" />
                        </Button>
                        
                        {isPhoneCountryOpen && (
                          <div className="absolute top-full left-0 right-0 z-50 bg-blue-700/100 backdrop-blur-lg border border-white/20 rounded-md shadow-xl max-h-60 overflow-auto text-white">
                            <div className="p-2 border-b border-white/20 ">
                              <Input
                                type="text"
                                placeholder="Search"
                                value={phoneCountrySearch}
                                onChange={(e) => setPhoneCountrySearch(e.target.value)}
                                className="h-8 bg-white/10 backdrop-blur-lg border border-white/20 placeholder:text-white"
                              />
                            </div>
                            <div className="py-1">
                              {filteredPhoneCountries.map((country) => (
                                <button
                                  key={country.code}
                                  type="button"
                                  className="w-full text-left px-3 py-2 hover:bg-white/20 text-sm text-white"
                                  onClick={() => {
                                    setSelectedPhoneCountry(country);
                                    handleFormChange("countryCode", country.dialCode || "");
                                    setIsPhoneCountryOpen(false);
                                    setPhoneCountrySearch("");
                                  }}
                                >
                                  <span className="font-medium">{country.dialCode}</span> {country.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Phone Number Input */}
                      <Input
                        type="tel"
                        value={form.phoneNumber}
                        onChange={(e) => handleFormChange("phoneNumber", e.target.value.replace(/\D/g, ''))}
                        required
                        placeholder="XXXXXXXXXX"
                        maxLength={10}
                        className="flex-1 bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/60"
                        data-testid="input-phone-number"
                      />
                    </div>
                    <p className="text-xs text-white/60 mt-1">
                      Phone number must be 10 digits
                    </p>
                  </div>

                  {/* Email */}
                  <div>
                    <Label className="text-sm font-medium text-white">Email Address *</Label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => handleFormChange("email", e.target.value)}
                      required
                      placeholder="your.email@example.com"
                      className="mt-1 bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/60"
                      data-testid="input-email"
                    />
                  </div>
                </div>
              )}

              {/* Step 3: Account Setup */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-white mb-2">Account Setup</h3>
                    <p className="text-sm text-white/80">Create your login credentials</p>
                  </div>
                  
                  {/* Username */}
                  <div>
                    <Label className="text-sm font-medium text-white">Username *</Label>
                    <Input
                      type="text"
                      value={form.username}
                      onChange={(e) => handleFormChange("username", e.target.value)}
                      required
                      placeholder="Choose a unique username"
                      className="mt-1 bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/60"
                      data-testid="input-username"
                    />
                  </div>

                  {/* Password */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-white">Password *</Label>
                      <Input
                        type="password"
                        value={form.password}
                        onChange={(e) => handleFormChange("password", e.target.value)}
                        required
                        placeholder="Enter password"
                        className="mt-1 bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/60"
                        data-testid="input-password"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-white">Confirm Password *</Label>
                      <Input
                        type="password"
                        value={form.confirmPassword}
                        onChange={(e) => handleFormChange("confirmPassword", e.target.value)}
                        required
                        placeholder="Confirm password"
                        className="mt-1 bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/60"
                        data-testid="input-confirm-password"
                      />
                    </div>
                  </div>

                  {/* Terms and Conditions */}
                  <div className="flex items-start space-x-2 p-4 bg-white/10 backdrop-blur-lg rounded-lg border border-white/20">
                    <Checkbox
                      id="terms"
                      checked={agreeToTerms}
                      onCheckedChange={(checked) => setAgreeToTerms(checked as boolean)}
                      className="mt-0.5"
                      data-testid="checkbox-terms"
                    />
                    <div className="grid gap-1.5 leading-none">
                      <label
                        htmlFor="terms"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer text-white"
                      >
                        I agree to the terms and conditions
                      </label>
                      <p className="text-xs text-white/70">
                        By creating an account, you agree to our terms of service and privacy policy.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex justify-between mt-8">
                {currentStep > 1 ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePreviousStep}
                    className="bg-white/10 backdrop-blur-lg border border-white/20 text-white hover:bg-white/20"
                    data-testid="button-previous"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Previous
                  </Button>
                ) : (
                  <div></div>
                )}

                {currentStep < 3 ? (
                  <Button
                    type="button"
                    onClick={handleNextStep}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg"
                    data-testid="button-next"
                  >
                    Next
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button 
                    type="submit" 
                    disabled={isLoading || !agreeToTerms}
                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    data-testid="button-create-account"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating Account...
                      </>
                    ) : (
                      "Create Account"
                    )}
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}