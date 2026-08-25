import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, School, CheckCircle, Loader2, Search, Copy, Download, Upload, Check, Mail } from "lucide-react";
import { countries, statesByCountry, getCountryByCode, Country, State } from "@/lib/countries";
import { apiRequest } from "@/lib/queryClient";
import { CURRENT_YEAR, BETA_VERSION } from "@shared/constants";

export default function SchoolSignup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Multi-step state
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  
  // Registration state
  const [registrationSuccess, setRegistrationSuccess] = useState<{user: any, school: any} | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [selectedState, setSelectedState] = useState<State | null>(null);
  const [countrySearch, setCountrySearch] = useState("");
  const [stateSearch, setStateSearch] = useState("");
  const [isCountryOpen, setIsCountryOpen] = useState(false);
  const [isStateOpen, setIsStateOpen] = useState(false);
  
  // Phone number state
  const [selectedPhoneCountry, setSelectedPhoneCountry] = useState<Country | null>(null);
  const [phoneCountrySearch, setPhoneCountrySearch] = useState("");
  const [isPhoneCountryOpen, setIsPhoneCountryOpen] = useState(false);
  
  // For copy functionality
  const [copySuccess, setCopySuccess] = useState(false);
  
  // Form state - All steps combined
  const [form, setForm] = useState({
    // Step 1: School Info
    schoolName: "",
    yearFounded: "",
    website: "",
    
    // Step 2: Location
    country: "",
    state: "",
    city: "",
    address: "",
    
    // Step 3: Contact Info
    email: "",
    phoneNumber: "",
    countryCode: "",
    
    // Step 4: Verification Info
    registrationNumber: "",
    accreditationDocument: null as File | null,
    
    // Step 5: Account Setup
    adminUsername: "",
    adminPassword: "",
    confirmPassword: "",
  });

  // Ref for phone country dropdown
  const phoneCountryDropdownRef = useRef<HTMLDivElement>(null);

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

  // Filter countries based on search for phone
  const filteredPhoneCountries = countries.filter(country =>
    country.name.toLowerCase().includes(phoneCountrySearch.toLowerCase()) ||
    (country.dialCode && country.dialCode.includes(phoneCountrySearch))
  );

  // Form handlers
  const handleFormChange = (field: string, value: string | File | null) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  

  // Validation functions for each step
  const validateStep = (step: number): boolean => {
    setError("");
    
    switch (step) {
      case 1: // School Info
        if (!form.schoolName || !form.yearFounded) {
          setError("Please fill in all required fields for school information");
          return false;
        }
        const yearFounded = parseInt(form.yearFounded);
        if (yearFounded > CURRENT_YEAR) {
          setError(`Founding year cannot be in the future (current year is ${CURRENT_YEAR})`);
          return false;
        }
        if (yearFounded < 1800) {
          setError("Please enter a valid founding year");
          return false;
        }
        break;
        
      case 2: // Location
        if (!selectedCountry || !form.city) {
          setError("Please fill in all required location fields");
          return false;
        }
        // Validate state if required
        if (selectedCountry && statesByCountry[selectedCountry.code] && !selectedState) {
          setError("Please select a state/province");
          return false;
        }
        break;
        
      case 3: // Contact Info
        if (!form.email || !form.phoneNumber || !form.countryCode) {
          setError("Please fill in all required contact information");
          return false;
        }
        if (form.phoneNumber && !/^\d{10}$/.test(form.phoneNumber)) {
          setError("Phone number must be 10 digits");
          return false;
        }
        break;
        
      case 4: // Verification Info
        if (!form.registrationNumber) {
          setError("Please enter the registration number");
          return false;
        }
        break;
        
      case 5: // Account Setup
        if (!form.adminUsername || !form.adminPassword || !form.confirmPassword) {
          setError("Please fill in all required account setup fields");
          return false;
        }
        if (form.adminPassword !== form.confirmPassword) {
          setError("Passwords do not match");
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
      
      // Move to next step (skip step 4 in beta)
      if (currentStep < 5) {
        const nextStep = (BETA_VERSION && currentStep === 3) ? 5 : currentStep + 1;
        setCurrentStep(nextStep);
        setError("");
        
        // Auto-select phone country code when moving to Step 3 based on Step 2 country selection
        if (nextStep === 3 && selectedCountry && !selectedPhoneCountry) {
          setSelectedPhoneCountry(selectedCountry);
          handleFormChange("countryCode", selectedCountry.dialCode || "");
        }
      }
    }
  };

  // Previous step handler
  const handlePreviousStep = () => {
    if (currentStep > 1) {
      // Skip step 4 going backwards in beta
      const prevStep = (BETA_VERSION && currentStep === 5) ? 3 : currentStep - 1;
      setCurrentStep(prevStep);
      setError("");
    }
  };

  // Final form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateStep(5)) {
      return;
    }
    
    setIsLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append('username', form.adminUsername);
      formData.append('password', form.adminPassword);
      formData.append('schoolName', form.schoolName);
      formData.append('country', selectedCountry?.name || "");
      formData.append('state', selectedState?.name || "");
      formData.append('city', form.city);
      formData.append('email', form.email);
      // Format phone number with country code like in viewer signup
      const formattedPhoneNumber = `+${form.countryCode.replace(/^\+/, "")}${form.phoneNumber}`;
      formData.append('phoneNumber', formattedPhoneNumber);
      formData.append('website', form.website);
      formData.append('address', form.address);
      formData.append('yearFounded', form.yearFounded);
      formData.append('registrationNumber', form.registrationNumber);
      
      // Add file if selected
      if (form.accreditationDocument) {
        formData.append('accreditationDocument', form.accreditationDocument);
      }

      const response = await fetch("/api/auth/school-register", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setRegistrationSuccess({
          user: null,
          school: data.school
        });
        
        toast({
          className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
          title: "Registration Submitted!",
          description: "Your school registration has been submitted for approval.",
        });
      } else {
        setError(data.message || "Registration failed");
      }
    } catch (error) {
      setError("Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Load initial search state for countries
  useEffect(() => {
    if (selectedCountry && !countrySearch) {
      setCountrySearch(selectedCountry.name);
    }
  }, [selectedCountry, countrySearch]);

  useEffect(() => {
    if (selectedState && !stateSearch) {
      setStateSearch(selectedState.name);
    }
  }, [selectedState, stateSearch]);

  // Filtered countries and states
  const filteredCountries = countries.filter(country =>
    country.name.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const availableStates = selectedCountry ? statesByCountry[selectedCountry.code] || [] : [];
  const filteredStates = availableStates.filter(state =>
    state.name.toLowerCase().includes(stateSearch.toLowerCase())
  );

  // Step Progress Component
  const steps = BETA_VERSION ? [1, 2, 3, 5] : [1, 2, 3, 4, 5];
  const totalSteps = steps.length;
  const displayStep = steps.indexOf(currentStep) + 1;
  const StepProgress = () => (
    <div className="mb-6 sm:mb-8">
      <div className="flex items-center justify-between">
        {steps.map((step, idx) => (
          <div key={step} className="flex items-center">
            <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium ${
              step === currentStep 
                ? "bg-blue-500/70 backdrop-blur-lg text-white border border-blue-400/30" 
                : completedSteps.includes(step)
                ? "bg-green-500/70 backdrop-blur-lg text-white border border-green-400/30"
                : "bg-white/20 backdrop-blur-lg text-white/70 border border-white/30"
            }`}>
              {completedSteps.includes(step) ? <Check className="w-3 h-3 sm:w-4 sm:h-4" /> : idx + 1}
            </div>
            {idx < steps.length - 1 && (
              <div className={`w-4 sm:w-12 h-1 ${
                completedSteps.includes(step) ? "bg-green-500/70 backdrop-blur-lg" : "bg-white/20 backdrop-blur-lg"
              }`} />
            )}
          </div>
        ))}
      </div>
      <div className="hidden sm:flex justify-between mt-2 text-xs text-white">
        <span>School Info</span>
        <span>Location</span>
        <span>Contact</span>
        {!BETA_VERSION && <span>Verification</span>}
        <span>Account</span>
      </div>
      <div className="flex sm:hidden justify-center mt-2 text-xs text-white">
        <span>Step {displayStep} of {totalSteps}</span>
      </div>
    </div>
  );

  // If registration was successful, show success page
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
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mb-4 backdrop-blur-sm border-2 border-blue-400/50">
              <Mail className="w-8 h-8 text-blue-400" />
            </div>
            <CardTitle className="text-2xl text-white">Verify Your Email</CardTitle>
            <CardDescription className="text-white">
              We've sent a verification link to <span className="font-semibold text-blue-300">{form.email}</span>
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <Alert className="bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl">
              <AlertDescription className="text-blue-50">
                Please check your email and click the verification link to complete your registration. After verification, your school registration will be reviewed by our administrators (3-5 business days).
              </AlertDescription>
            </Alert>

            <div className="text-center">
              <Button 
                onClick={() => setLocation("/")}
                variant="outline"
                className="w-full"
                data-testid="button-return-home"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Return to Home
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
          <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
            <School className="w-8 h-8 text-orange-600" />
          </div>
          <CardTitle className="text-2xl text-white">School Registration</CardTitle>
          <CardDescription
            className="text-white">
            Step {displayStep} of {totalSteps}: {
              currentStep === 1 ? "School Information" :
              currentStep === 2 ? "Location Details" :
              currentStep === 3 ? "Contact Information" :
              currentStep === 4 ? "Verification Documents" :
              "Account Setup"
            }
          </CardDescription>
        </CardHeader>

        <CardContent>
          <StepProgress />

          {error && (
            <Alert className="mb-4" variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            {/* Step 1: School Info */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white border-b border-white/20 pb-2">School Information</h3>
                
                <div>
                  <Label className="text-sm font-medium text-white">School Name</Label><Label className="text-sm font-medium text-red-500"> *</Label>
                  <Input
                    type="text"
                    value={form.schoolName}
                    onChange={(e) => handleFormChange('schoolName', e.target.value)}
                    required
                    placeholder=""
                    className="mt-1 bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20"
                    data-testid="input-school-name"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium text-white">Year founded</Label><Label className="text-sm font-medium text-red-500"> *</Label>
                  <Input
                    type="number"
                    value={form.yearFounded}
                    onChange={(e) => handleFormChange('yearFounded', e.target.value)}
                    required
                    placeholder=""
                    min="1800"
                    max={CURRENT_YEAR}
                    className="mt-1 bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20"
                    data-testid="input-year-founded"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium text-white">School Website (Optional)</Label>
                  <Input
                    type="url"
                    value={form.website}
                    onChange={(e) => handleFormChange('website', e.target.value)}
                    placeholder=""
                    className="mt-1 bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20"
                    data-testid="input-website"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Location */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white border-b pb-2">Location Details</h3>
                
                {/* Country Selection */}
                <div>
                  <Label className="text-sm font-medium text-white">Country</Label><Label className="text-sm font-medium text-red-500"> *</Label>
                  <div className="relative mt-1">
                    <div
                      className="flex items-center w-full px-3 py-2 bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20 rounded-md cursor-pointer hover:border-white/40"
                      onClick={() => setIsCountryOpen(!isCountryOpen)}
                      data-testid="select-country"
                    >
                      <Search className="w-4 h-4 text-gray-400 mr-2" />
                      <input
                        type="text"
                        value={countrySearch}
                        onChange={(e) => setCountrySearch(e.target.value)}
                        placeholder="Search countries..."
                        className="flex-1 outline-none bg-transparent"
                        onFocus={() => setIsCountryOpen(true)}
                      />
                    </div>
                    
                    {isCountryOpen && (
                      <div className="absolute z-10 w-full mt-1 bg-blue-700/100 backdrop-blur-lg border border-white/20 rounded-md shadow-lg max-h-60 overflow-auto text-white">
                        {filteredCountries.map((country) => (
                          <div
                            key={country.code}
                            className="px-3 py-2 hover:bg-gray-100 hover:text-black cursor-pointer"
                            onClick={() => {
                              setSelectedCountry(country);
                              setCountrySearch(country.name);
                              setIsCountryOpen(false);
                              setSelectedState(null);
                              setStateSearch("");
                              handleFormChange('country', country.name);
                            }}
                          >
                            {country.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* State Selection */}
                {selectedCountry && availableStates.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium text-white">State/Province</Label><Label className="text-sm font-medium text-red-500"> *</Label>
                    <div className="relative mt-1">
                      <div
                        className="flex items-center w-full px-3 py-2 bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20 rounded-md cursor-pointer hover:border-white/40"
                        onClick={() => setIsStateOpen(!isStateOpen)}
                        data-testid="select-state"
                      >
                        <Search className="w-4 h-4 text-gray-400 mr-2" />
                        <input
                          type="text"
                          value={stateSearch}
                          onChange={(e) => setStateSearch(e.target.value)}
                          placeholder=""
                          className="flex-1 outline-none bg-transparent"
                          onFocus={() => setIsStateOpen(true)}
                        />
                      </div>
                      
                      {isStateOpen && (
                        <div className="absolute z-10 w-full mt-1 bg-blue-700/100 backdrop-blur-lg border border-white/20 text-white rounded-md shadow-lg max-h-60 overflow-auto">
                          {filteredStates.map((state) => (
                            <div
                              key={state.code}
                              className="px-3 py-2 hover:bg-gray-100 hover:text-black cursor-pointer"
                              onClick={() => {
                                setSelectedState(state);
                                setStateSearch(state.name);
                                setIsStateOpen(false);
                                handleFormChange('state', state.name);
                              }}
                            >
                              {state.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <Label className="text-sm font-medium text-white">City</Label><Label className="text-sm font-medium text-red-500"> *</Label>
                  <Input
                    type="text"
                    value={form.city}
                    onChange={(e) => handleFormChange('city', e.target.value)}
                    required
                    placeholder=""
                    className="mt-1 bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20 rounded-md cursor-pointer hover:border-white/40"
                    data-testid="input-city"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium text-white">Address (Optional)</Label>
                  <Input
                    type="text"
                    value={form.address}
                    onChange={(e) => handleFormChange('address', e.target.value)}
                    placeholder=""
                    className="mt-1 bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20 rounded-md cursor-pointer hover:border-white/40"
                    data-testid="input-address"
                  />
                </div>
              </div>
            )}

            {/* Step 3: Contact Info */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white border-b pb-2">Contact Information</h3>
                
                <div>
                  <Label className="text-sm font-medium text-white">School Email</Label><Label className="text-sm font-medium text-red-500"> *</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => handleFormChange('email', e.target.value)}
                    required
                    placeholder="school@example.com"
                    className="mt-1 placeholder:text-white/50 bg-white/10 backdrop-blur-lg border border-white/20 text-white focus:border-white/40 focus:ring-white/20"
                    data-testid="input-email"
                  />
                </div>

                {/* Phone Number with Country Code */}
                <div>
                  <Label className="text-sm font-medium text-white">School Phone Number</Label><Label className="text-sm font-medium text-red-500"> *</Label>
                  <div className="flex gap-2 mt-1">
                    {/* Country Code Dropdown */}
                    <div className="relative w-32" ref={phoneCountryDropdownRef}>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsPhoneCountryOpen(!isPhoneCountryOpen)}
                        className="w-full justify-between h-10 placeholder:text-white/50 bg-white/10 backdrop-blur-lg border border-white/20 text-white focus:border-white/40 focus:ring-white/20"
                        data-testid="button-country-code"
                      >
                        {selectedPhoneCountry ? selectedPhoneCountry.dialCode : "Code"}
                        <Search className="h-4 w-4" />
                      </Button>
                      
                      {isPhoneCountryOpen && (
                        <div className="absolute top-full left-0 right-0 z-50 bg-blue-700/100 text-white backdrop-blur-lg border border-white/20 border rounded-md shadow-lg max-h-60 overflow-auto">
                          <div className="p-2 border-b">
                            <Input
                              type="text"
                              placeholder="Search"
                              value={phoneCountrySearch}
                              onChange={(e) => setPhoneCountrySearch(e.target.value)}
                              className="h-8 bg-blue-400/60 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20 "
                            />
                          </div>
                          <div className="py-1">
                            {filteredPhoneCountries.map((country) => (
                              <button
                                key={country.code}
                                type="button"
                                className="w-full text-left px-3 py-2 hover:bg-gray-100 hover:text-black text-sm"
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
                      className="flex-1 placeholder:text-white/50 bg-white/10 backdrop-blur-lg border border-white/20 text-white focus:border-white/40 focus:ring-white/20"
                      data-testid="input-phone-number"
                    />
                  </div>
                  <p className="text-xs text-white/40 mt-1">
                   Ensure the phone number is correct
                  </p>
                </div>
              </div>
            )}

            {/* Step 4: Verification Info */}
            {currentStep === 4 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-blue-50 border-b pb-2">Verification Information</h3>
                
                <div>
                  <Label className="text-sm font-medium text-blue-50">Registration Number</Label><Label className="text-sm font-medium text-red-500"> *</Label>
                  <Input
                    type="text"
                    value={form.registrationNumber}
                    onChange={(e) => handleFormChange('registrationNumber', e.target.value)}
                    required
                    placeholder=""
                    className="mt-1 placeholder:text-white/50 bg-white/10 backdrop-blur-lg border border-white/20 text-white focus:border-white/40 focus:ring-white/20"
                    data-testid="input-registration-number"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium text-white">Proof of Accreditation (Optional)</Label>
                  <div className="mt-1">
                    <div className="flex items-center justify-center w-full">
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-white/10 hover:bg-gray-100 backdrop-blur-lg">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <Upload className="w-8 h-8 mb-2 text-white" />
                          <p className="mb-2 text-sm text-white">
                            <span className="font-semibold text-white">Click to upload</span> accreditation document
                          </p>
                          <p className="text-xs text-blue-50">PDF, PNG, JPG or JPEG (MAX. 10MB)</p>
                        </div>
                        <input
                          type="file"
                          className="hidden "
                          accept=".pdf,.png,.jpg,.jpeg"
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            handleFormChange('accreditationDocument', file);
                          }}
                          data-testid="input-accreditation-document"
                        />
                      </label>
                    </div>
                    {form.accreditationDocument && (
                      <p className="mt-2 text-sm text-green-600">
                        Selected: {form.accreditationDocument.name}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: Account Setup */}
            {currentStep === 5 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-blue-50 border-b pb-2">Account Setup</h3>
                
                <div>
                  <Label className="text-sm font-medium text-white">Administrator Username</Label><Label className="text-sm font-medium text-red-500"> *</Label>
                  <Input
                    type="text"
                    value={form.adminUsername}
                    onChange={(e) => handleFormChange('adminUsername', e.target.value)}
                    required
                    placeholder=""
                    className="mt-1 placeholder:text-white/50 bg-white/10 backdrop-blur-lg border border-white/20 text-white focus:border-white/40 focus:ring-white/20"
                    data-testid="input-admin-username"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium text-white">Administrator Password</Label><Label className="text-sm font-medium text-red-500"> *</Label>
                  <Input
                    type="password"
                    value={form.adminPassword}
                    onChange={(e) => handleFormChange('adminPassword', e.target.value)}
                    required
                    placeholder=""
                    className="mt-1 placeholder:text-white/50 bg-white/10 backdrop-blur-lg border border-white/20 text-white focus:border-white/40 focus:ring-white/20"
                    data-testid="input-admin-password"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium text-white">Confirm Password</Label><Label className="text-sm font-medium text-red-500"> *</Label>
                  <Input
                    type="password"
                    value={form.confirmPassword}
                    onChange={(e) => handleFormChange('confirmPassword', e.target.value)}
                    required
                    placeholder=""
                    className="mt-1 placeholder:text-white/50 bg-white/10 backdrop-blur-lg border border-white/20 text-white focus:border-white/40 focus:ring-white/20"
                    data-testid="input-confirm-password"
                  />
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8">
              <Button
                type="button"
                variant="outline"
                onClick={handlePreviousStep}
                disabled={currentStep === 1}
                data-testid="button-previous"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Previous
              </Button>

              {currentStep < 5 ? (
                <Button
                  type="button"
                  onClick={handleNextStep}
                  data-testid="button-next"
                >
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={isLoading}
                  data-testid="button-submit"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Registration"
                  )}
                </Button>
              )}
            </div>
          </form>

          {/* Navigation Links */}
          <div className="text-center mt-6 text-white">
            <Button 
              variant="ghost" 
              onClick={() => setLocation("/")}
              data-testid="button-back-home"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}