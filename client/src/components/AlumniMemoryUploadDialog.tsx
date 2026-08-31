import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import ImageCropDialog from "@/components/ImageCropDialog";
import { useToast } from "@/hooks/use-toast";
import type { AlumniBadge, School } from "@shared/schema";
import { CURRENT_YEAR } from "@shared/constants";

interface AlumniMemoryUploadDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  verifiedBadges: AlumniBadge[];
  schools: School[];
  onUploaded: () => void;
}

const categories = [
  { value: "graduation", label: "Graduation" },
  { value: "sports", label: "Sports" },
  { value: "arts", label: "Arts" },
  { value: "field_trips", label: "Field Trips" },
  { value: "academic", label: "Academic" },
];

export function AlumniMemoryUploadDialog({
  open,
  onClose,
  userId,
  verifiedBadges,
  schools,
  onUploaded,
}: AlumniMemoryUploadDialogProps) {
  const { toast } = useToast();
  const [schoolId, setSchoolId] = useState("");
  const [year, setYear] = useState("");
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [cropTarget, setCropTarget] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const verifiedSchools = useMemo(() => {
    return verifiedBadges
      .filter((badge) => badge.status === "verified")
      .reduce<Array<{ school: School; graduationYear: string }>>((options, badge) => {
        const school = schools.find((candidate) => candidate.name.trim().toLowerCase() === badge.school.trim().toLowerCase());
        if (school && !options.some((option) => option.school.id === school.id)) {
          options.push({ school, graduationYear: badge.graduationYear });
        }
        return options;
      }, []);
  }, [verifiedBadges, schools]);

  const selectedSchool = verifiedSchools.find((option) => option.school.id === schoolId)?.school;
  const availableYears = useMemo(() => {
    const foundingYear = Math.min(Number(selectedSchool?.yearFounded) || CURRENT_YEAR, CURRENT_YEAR);
    return Array.from(
      { length: CURRENT_YEAR - foundingYear + 1 },
      (_, index) => String(CURRENT_YEAR - index),
    );
  }, [selectedSchool]);

  useEffect(() => {
    if (!open) return;
    setSchoolId("");
    setYear("");
    setCategory("");
    setTitle("");
    setDescription("");
    setSelectedFile(null);
    setCropTarget(null);
    setErrorMessage("");
  }, [open]);

  useEffect(() => {
    setYear("");
  }, [schoolId]);

  const createCroppedFile = (originalFile: File, croppedBlob: Blob) => {
    const baseName = originalFile.name.replace(/\.[^/.]+$/, "");
    const extension = croppedBlob.type === "image/png" ? "png" : "jpg";
    return new File([croppedBlob], baseName + "-cropped." + extension, {
      type: croppedBlob.type || "image/jpeg",
      lastModified: Date.now(),
    });
  };

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please choose an image file.");
      return;
    }

    setErrorMessage("");
    setCropTarget(file);
  };

  const handleCropSave = (croppedBlob: Blob) => {
    if (!cropTarget) return;
    setSelectedFile(createCroppedFile(cropTarget, croppedBlob));
    setCropTarget(null);
  };

  const handleCropClose = () => {
    setCropTarget(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    if (!selectedFile) {
      setErrorMessage("Please choose an image to upload.");
      return;
    }
    if (!schoolId || !year || !category) {
      setErrorMessage("Please complete the school, year, and category fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("memoryFile", selectedFile);
      formData.append("schoolId", schoolId);
      formData.append("year", year);
      formData.append("category", category);
      formData.append("title", title.trim());
      formData.append("description", description.trim());

      const response = await fetch("/api/alumni-uploads", {
        method: "POST",
        headers: { Authorization: "Bearer " + userId },
        body: formData,
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.message || "Failed to upload memory");
      }

      onUploaded();
      toast({
        title: "Memory sent to school",
        description: "Your memory is pending approval by the school.",
      });
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to upload memory";
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="w-[calc(100%-1rem)] max-w-lg max-h-[90vh] overflow-y-auto bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl p-4 sm:w-full sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-white">Upload a memory</DialogTitle>
          <DialogDescription className="text-blue-50">
            Share a memory with a school where you are a verified alumnus. The school will review it before it appears publicly.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label htmlFor="alumni-upload-school" className="text-sm font-medium text-white">School</label>
            <select
              id="alumni-upload-school"
              value={schoolId}
              onChange={(event) => setSchoolId(event.target.value)}
              className="flex h-10 w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-base sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
              required
            >
              <option value="" className="text-gray-900">Select a school</option>
              {verifiedSchools.map(({ school, graduationYear }) => (
                <option key={school.id} value={school.id} className="text-gray-900">
                  {school.name} (Class of {graduationYear})
                </option>
              ))}
            </select>
            {verifiedSchools.length === 0 && (
              <p className="text-xs text-amber-200">No verified alumni schools are available.</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="alumni-upload-year" className="text-sm font-medium text-white">Year</label>
              <select
                id="alumni-upload-year"
                value={year}
                onChange={(event) => setYear(event.target.value)}
                disabled={!schoolId}
                className="flex h-10 w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-base sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                required
              >
                <option value="" className="text-gray-900">Select a year</option>
                {availableYears.map((availableYear) => (
                  <option key={availableYear} value={availableYear} className="text-gray-900">{availableYear}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="alumni-upload-category" className="text-sm font-medium text-white">Category</label>
              <select
                id="alumni-upload-category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="flex h-10 w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-base sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                required
              >
                <option value="" className="text-gray-900">Select a category</option>
                {categories.map((option) => (
                  <option key={option.value} value={option.value} className="text-gray-900">{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="alumni-upload-title" className="text-sm font-medium text-white">Title</label>
            <input
              id="alumni-upload-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Give your memory a title"
              className="flex h-10 w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-base sm:text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="alumni-upload-description" className="text-sm font-medium text-white">Description <span className="font-normal text-white/60">(optional)</span></label>
            <textarea
              id="alumni-upload-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Add some context about this memory"
              rows={3}
              className="flex w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-base sm:text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />
          </div>



          {errorMessage && <p className="text-sm text-red-200">{errorMessage}</p>}

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting} className="w-full sm:w-auto">Cancel</Button>
            <Button type="submit" disabled={isSubmitting || !!cropTarget || verifiedSchools.length === 0} className="w-full bg-cyan-600 hover:bg-cyan-700 sm:w-auto">
              {isSubmitting ? "Sending..." : "Send to school"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>

      <ImageCropDialog
        isOpen={!!cropTarget}
        imageFile={cropTarget}
        onClose={handleCropClose}
        onSave={handleCropSave}
        aspectRatio={1}
        cropLabel="memory image"
        saveButtonText="Use Cropped Image"
      />
    </>
  );
}
