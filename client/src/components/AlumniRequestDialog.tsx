import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSchoolSelect } from "@/components/ui/searchable-school-select";
import { GraduationCap, Send } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CURRENT_YEAR } from "@shared/constants";

interface School {
  id: string;
  name: string;
  country: string;
  state?: string;
  city: string;
  yearFounded: number;
}

interface AlumniRequestDialogProps {
  open: boolean;
  onClose: () => void;
  initialSchoolId?: string;
}

const EMPTY_FORM = {
  selectedSchool: "",
  firstName: "",
  middleName: "",
  lastName: "",
  noNameChange: false,
  admissionYear: "",
  graduationYear: "",
  didNotGraduate: false,
  postHeld: "",
  studentName: "",
  studentAdmissionYear: "",
  additionalInfo: ""
};

export default function AlumniRequestDialog({ open, onClose, initialSchoolId }: AlumniRequestDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);

  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem("alumni-request-form");
    return saved ? JSON.parse(saved) : { ...EMPTY_FORM };
  });

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) setUser(JSON.parse(userData));
  }, []);

  // Pre-select school when initialSchoolId is provided
  useEffect(() => {
    if (initialSchoolId && open) {
      setFormData((prev: typeof EMPTY_FORM) => {
        if (prev.selectedSchool !== initialSchoolId) {
          const next = { ...EMPTY_FORM, selectedSchool: initialSchoolId };
          localStorage.setItem("alumni-request-form", JSON.stringify(next));
          return next;
        }
        return prev;
      });
    }
  }, [initialSchoolId, open]);

  const { data: schools = [] } = useQuery<School[]>({
    queryKey: ["/api/schools"],
    enabled: !!user,
  });

  const currentYear = CURRENT_YEAR;
  const selectedSchool = schools.find((s: School) => s.id === formData.selectedSchool);
  const schoolFoundingYear = selectedSchool?.yearFounded || 1980;

  const years = Array.from({ length: currentYear - schoolFoundingYear + 1 }, (_, i) =>
    (currentYear - i).toString()
  );

  const graduationYears = formData.admissionYear
    ? years.filter(y => parseInt(y) >= parseInt(formData.admissionYear))
    : years;

  const selectedSchoolName = selectedSchool?.name || "this school";

  const handleInputChange = (field: string, value: string | boolean) => {
    let next: any = { ...formData, [field]: value };

    if (field === "selectedSchool") {
      next = { ...next, admissionYear: "", graduationYear: "", didNotGraduate: false, studentAdmissionYear: "" };
    }
    if (field === "admissionYear" && next.graduationYear && !next.didNotGraduate) {
      if (parseInt(next.graduationYear) < parseInt(value as string)) {
        next.graduationYear = "";
      }
    }
    if (field === "didNotGraduate" && value === true) {
      next.graduationYear = "did-not-graduate";
    }
    if (field === "graduationYear" && value !== "did-not-graduate") {
      next.didNotGraduate = false;
    }

    setFormData(next);
    localStorage.setItem("alumni-request-form", JSON.stringify(next));
  };

  const createAlumniRequestMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/alumni-requests", data);
    },
    onMutate: async (requestData) => {
      await queryClient.cancelQueries({ queryKey: ["/api/alumni-badges", user?.id] });

      const previousBadges = queryClient.getQueryData(["/api/alumni-badges", user?.id]);

      const optimisticBadge = {
        id: `temp-${Date.now()}`,
        userId: user?.id,
        school: schools.find((s: School) => s.id === requestData.schoolId)?.name || "Unknown School",
        fullName: requestData.fullName,
        graduationYear: requestData.graduationYear,
        admissionYear: requestData.admissionYear,
        status: "pending"
      };

      queryClient.setQueryData(["/api/alumni-badges", user?.id], (old: any = []) => [...old, optimisticBadge]);

      toast({
        className: "bg-blue-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Request Submitted",
        description: "Your alumni status request has been submitted. You will receive a response within 3-5 business days.",
      });

      localStorage.removeItem("alumni-request-form");
      setFormData({ ...EMPTY_FORM });
      onClose();

      return { previousBadges };
    },
    onError: (error: any, _data, context: any) => {
      queryClient.setQueryData(["/api/alumni-badges", user?.id], context?.previousBadges || []);
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Submission Failed",
        description: error.message || "Unknown error occurred. Please try again.",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alumni-badges", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications", user?.id] });
    },
  });

  const handleSubmit = () => {
    if (!formData.selectedSchool || !formData.admissionYear || (!formData.graduationYear && !formData.didNotGraduate)) {
      toast({
        className: "bg-red-600/60 backdrop-blur-lg border border-white/20 shadow-2xl text-white",
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const requestData = {
      userId: user?.id,
      schoolId: formData.selectedSchool,
      fullName: user?.fullName,
      admissionYear: formData.admissionYear,
      graduationYear: formData.graduationYear,
      postHeld: formData.postHeld || null,
      studentName: formData.studentName || null,
      studentAdmissionYear: formData.studentAdmissionYear || null,
      additionalInfo: formData.additionalInfo || null,
      status: "pending"
    };

    createAlumniRequestMutation.mutate(requestData);
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 border border-white/20 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-white">
            <GraduationCap className="h-5 w-5 text-green-400" />
            <span>Alumni Verification Form</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* School Selection */}
          <div>
            <Label className="block text-sm font-medium text-white mb-2">
              Select School <span className="text-red-400">*</span>
            </Label>
            <SearchableSchoolSelect
              schools={schools}
              value={formData.selectedSchool}
              onValueChange={(value) => handleInputChange("selectedSchool", value)}
              placeholder="Search for the school you attended..."
              className="w-full"
            />
          </div>

          {/* Name Information */}
          <div className="space-y-4 border-t border-white/20 pt-6">
            <h3 className="text-lg font-semibold text-white">Name Information</h3>
            <p className="text-sm text-white/80">
              If your name has changed since graduation (e.g., due to marriage), provide your name as it was during school.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <Label className="block text-sm font-medium text-white mb-2">
                  First Name <span className="text-red-400">*</span>
                </Label>
                <Input
                  type="text"
                  placeholder="First name"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange("firstName", e.target.value)}
                  disabled={formData.noNameChange}
                  className={`bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:border-white/40 ${formData.noNameChange ? 'opacity-50' : ''}`}
                  data-testid="input-first-name"
                />
              </div>
              <div>
                <Label className="block text-sm font-medium text-white mb-2">Middle Name</Label>
                <Input
                  type="text"
                  placeholder="Middle name (if any)"
                  value={formData.middleName}
                  onChange={(e) => handleInputChange("middleName", e.target.value)}
                  disabled={formData.noNameChange}
                  className={`bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:border-white/40 ${formData.noNameChange ? 'opacity-50' : ''}`}
                  data-testid="input-middle-name"
                />
              </div>
              <div>
                <Label className="block text-sm font-medium text-white mb-2">
                  Last Name <span className="text-red-400">*</span>
                </Label>
                <Input
                  type="text"
                  placeholder="Last name"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange("lastName", e.target.value)}
                  disabled={formData.noNameChange}
                  className={`bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:border-white/40 ${formData.noNameChange ? 'opacity-50' : ''}`}
                  data-testid="input-last-name"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="noNameChange"
                checked={formData.noNameChange}
                onChange={(e) => {
                  const checked = e.target.checked;
                  if (checked) {
                    handleInputChange("firstName", user?.firstName || "");
                    handleInputChange("middleName", user?.middleName || "");
                    handleInputChange("lastName", user?.lastName || "");
                  }
                  handleInputChange("noNameChange", checked);
                }}
                className="rounded border-gray-300"
              />
              <Label htmlFor="noNameChange" className="text-sm text-white">
                I have not had any name change since graduation
              </Label>
            </div>
          </div>

          {/* Admission and Graduation Years */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <Label className="block text-sm font-medium text-white mb-2">
                Admission Year <span className="text-red-400">*</span>
              </Label>
              <Select
                value={formData.admissionYear}
                onValueChange={(value) => handleInputChange("admissionYear", value)}
                disabled={!formData.selectedSchool}
              >
                <SelectTrigger className="w-full bg-white/10 backdrop-blur-lg border border-white/20 text-[#d6cbcb]" data-testid="select-admission-year">
                  <SelectValue placeholder={!formData.selectedSchool ? "Select school first" : "Select admission year"} />
                </SelectTrigger>
                <SelectContent className="bg-blue-600/60 backdrop-blur-lg border border-white/20 text-white">
                  {years.map((year) => (
                    <SelectItem key={year} value={year}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="block text-sm font-medium text-white mb-2">
                Graduation Year <span className="text-red-400">*</span>
              </Label>
              <Select
                value={formData.didNotGraduate ? "" : formData.graduationYear}
                onValueChange={(value) => handleInputChange("graduationYear", value)}
                disabled={!formData.selectedSchool || formData.didNotGraduate || !formData.admissionYear}
              >
                <SelectTrigger className="w-full bg-white/10 backdrop-blur-lg border border-white/20 text-[#d6cbcb]" data-testid="select-graduation-year">
                  <SelectValue placeholder={
                    !formData.selectedSchool ? "Select school first" :
                    !formData.admissionYear ? "Select admission year first" :
                    formData.didNotGraduate ? "Graduation year not applicable" :
                    "Select graduation year"
                  } />
                </SelectTrigger>
                <SelectContent className="bg-blue-600/60 backdrop-blur-lg border border-white/20 text-white">
                  {graduationYears.map((year) => (
                    <SelectItem key={year} value={year}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center space-x-2 mt-3">
                <Checkbox
                  id="did-not-graduate"
                  checked={formData.didNotGraduate}
                  onCheckedChange={(checked) => handleInputChange("didNotGraduate", checked === true)}
                  disabled={!formData.selectedSchool}
                />
                <label
                  htmlFor="did-not-graduate"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer text-white"
                >
                  I did not graduate from {selectedSchoolName}
                </label>
              </div>
            </div>
          </div>

          {/* Post Held */}
          <div>
            <Label className="block text-sm font-medium text-white mb-2">Post Held (Optional)</Label>
            <Input
              type="text"
              placeholder="e.g., Head Boy, Class Captain, Sports Captain, etc."
              value={formData.postHeld}
              onChange={(e) => handleInputChange("postHeld", e.target.value)}
              className="w-full bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:border-white/40"
              data-testid="input-post-held"
            />
          </div>

          {/* Student Reference */}
          <div className="bg-white/5 backdrop-blur-lg border border-white/10 p-4 sm:p-6 rounded-lg">
            <h4 className="text-md font-medium text-white mb-4">Student Reference (Optional)</h4>
            <p className="text-sm text-white/80 mb-4">
              Providing a student reference can help us verify your attendance at the school.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <Label className="block text-sm font-medium text-white mb-2">Name of Student You Remember</Label>
                <Input
                  type="text"
                  placeholder="Full name of a fellow student"
                  value={formData.studentName}
                  onChange={(e) => handleInputChange("studentName", e.target.value)}
                  className="w-full bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:border-white/40"
                  data-testid="input-student-name"
                />
              </div>
              <div>
                <Label className="block text-sm font-medium text-white mb-2">Their Admission Year</Label>
                <Select
                  value={formData.studentAdmissionYear}
                  onValueChange={(value) => handleInputChange("studentAdmissionYear", value)}
                  disabled={!formData.selectedSchool || !formData.studentName.trim()}
                >
                  <SelectTrigger className="w-full bg-white/10 backdrop-blur-lg border border-white/20 text-[#d6cbcb]" data-testid="select-student-admission-year">
                    <SelectValue placeholder={
                      !formData.selectedSchool ? "Select school first" :
                      !formData.studentName.trim() ? "Enter student name first" :
                      "Select their admission year"
                    } />
                  </SelectTrigger>
                  <SelectContent className="bg-blue-600/60 backdrop-blur-lg border border-white/20 text-white">
                    {years.map((year) => (
                      <SelectItem key={year} value={year}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Additional Information */}
          <div>
            <Label className="block text-sm font-medium text-white mb-2">Additional Information (Optional)</Label>
            <Textarea
              placeholder="Any additional information that might help verify your attendance (e.g., house you belonged to, favorite teacher, memorable events, etc.)"
              value={formData.additionalInfo}
              onChange={(e) => handleInputChange("additionalInfo", e.target.value)}
              className="w-full h-24 bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder:text-white/50 focus:border-white/40"
              data-testid="textarea-additional-info"
            />
          </div>

          {/* Submit */}
          <div className="pt-4 border-t border-white/20 flex flex-col gap-3">
            <p className="text-sm text-white/70">* Required fields. Your request will be reviewed within 3-5 business days.</p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={handleClose}
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createAlumniRequestMutation.isPending}
                className="bg-blue-500 hover:bg-blue-600 flex items-center space-x-2 disabled:opacity-50"
                data-testid="button-submit-alumni-request"
              >
                <Send className="h-4 w-4" />
                <span>{createAlumniRequestMutation.isPending ? "Submitting..." : "Submit Request"}</span>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
