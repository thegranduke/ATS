import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Upload, FileText, CheckCircle, AlertCircle } from "lucide-react";

// Enhanced form schema based on prototype
const enhancedApplicationFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  address: z.string().optional(),
  isLicensed: z.boolean().optional(),
  wantsLicense: z.boolean().optional(),
  agreedToMarketing: z.boolean().default(false),
});

type EnhancedApplicationFormData = z.infer<typeof enhancedApplicationFormSchema>;

interface Job {
  id: number;
  title: string;
  company?: { name: string; logoUrl?: string };
  formHeaderText?: string;
  formDescription?: string;
  requirePhone?: boolean;
  requireAddress?: boolean;
  showLicenseOptions?: boolean;
  licenseStateName?: string;
  enableResumeUpload?: boolean;
  requireResume?: boolean;
  enablePhone?: boolean;
  enableAddress?: boolean;
}

interface EnhancedApplicationFormProps {
  job: Job;
  applicationLink: string;
  onSuccess: () => void;
  onBack: () => void;
}

export function EnhancedApplicationForm({ job, applicationLink, onSuccess, onBack }: EnhancedApplicationFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Form setup with dynamic validation based on job configuration
  const form = useForm<EnhancedApplicationFormData>({
    resolver: zodResolver(enhancedApplicationFormSchema.extend({
      phone: job.enablePhone && job.requirePhone ? z.string().min(1, "Phone number is required") : z.string().optional(),
      address: job.enableAddress && job.requireAddress ? z.string().min(1, "Address is required") : z.string().optional(),
    })),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      address: "",
      isLicensed: false,
      wantsLicense: false,
      agreedToMarketing: false,
    },
  });

  // File upload handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF or DOC file.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 5MB.",
        variant: "destructive",
      });
      return;
    }

    setResumeFile(file);
  };

  // Resume upload mutation
  const uploadResumeMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('resume', file);
      
      const response = await fetch('/api/upload/resume', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setIsUploading(false);
      setUploadProgress(100);
      toast({
        title: "Resume uploaded successfully",
        description: "Your resume has been attached to your application.",
      });
    },
    onError: () => {
      setIsUploading(false);
      setUploadProgress(0);
      toast({
        title: "Upload failed",
        description: "Please try uploading your resume again.",
        variant: "destructive",
      });
    },
  });

  // Form submission mutation
  const submitApplicationMutation = useMutation({
    mutationFn: async (data: EnhancedApplicationFormData & { resumeUrl?: string }) => {
      const applicationData = {
        ...data,
        fullName: `${data.firstName} ${data.lastName}`,
        applicationLink,
        sessionId: localStorage.getItem('recruitflow_session_id') || Math.random().toString(36).slice(2),
      };
      
      const response = await apiRequest("POST", "/api/applications", applicationData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/candidates'] });
      toast({
        title: "Application submitted!",
        description: "Thank you for your interest. We'll be in touch soon.",
      });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Submission failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: EnhancedApplicationFormData) => {
    let resumeUrl = "";
    
    // Upload resume if required and file selected
    if (resumeFile && job.enableResumeUpload) {
      setIsUploading(true);
      try {
        const uploadResult = await uploadResumeMutation.mutateAsync(resumeFile);
        resumeUrl = uploadResult.url;
      } catch (error) {
        return; // Upload failed, don't submit form
      }
    } else if (job.requireResume && !resumeFile) {
      toast({
        title: "Resume required",
        description: "Please upload your resume to continue.",
        variant: "destructive",
      });
      return;
    }

    submitApplicationMutation.mutate({ ...data, resumeUrl });
  };

  const headerText = job.formHeaderText || `${job.title} - Application`;
  const descriptionText = job.formDescription || `Please fill out the application as accurately as possible. After submitting we will review your application and get back to you as soon as possible.`;
  const stateName = job.licenseStateName || "STATE_NAME";

  return (
    <div className="bg-gray-50 flex items-center justify-center min-h-screen py-8">
      <div className="max-w-2xl w-full bg-white p-8 sm:p-12 rounded-xl shadow-lg mx-4">
        {/* Company Logo */}
        <div className="text-center mb-8">
          {job.company?.logoUrl ? (
            <img 
              src={job.company.logoUrl} 
              alt={`${job.company.name} Logo`} 
              className="mx-auto h-16 w-auto"
            />
          ) : (
            <div className="mx-auto">
              <div className="bg-primary text-white px-6 py-3 rounded text-xl font-bold">
                {job.company?.name || 'Company'}
              </div>
            </div>
          )}
        </div>

        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">{headerText}</h1>
          <p className="text-sm text-gray-600 leading-relaxed">
            {descriptionText}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          {/* Name Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                First Name <span className="text-red-500">*</span>
              </Label>
              <Input
                {...form.register("firstName")}
                type="text"
                id="firstName"
                placeholder="John"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {form.formState.errors.firstName && (
                <p className="mt-1 text-sm text-red-600">{form.formState.errors.firstName.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                Last Name <span className="text-red-500">*</span>
              </Label>
              <Input
                {...form.register("lastName")}
                type="text"
                id="lastName"
                placeholder="Doe"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {form.formState.errors.lastName && (
                <p className="mt-1 text-sm text-red-600">{form.formState.errors.lastName.message}</p>
              )}
            </div>
          </div>

          {/* Email */}
          <div>
            <Label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email <span className="text-red-500">*</span>
            </Label>
            <Input
              {...form.register("email")}
              type="email"
              id="email"
              placeholder="you@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {form.formState.errors.email && (
              <p className="mt-1 text-sm text-red-600">{form.formState.errors.email.message}</p>
            )}
          </div>

          {/* Phone Number */}
          {job.enablePhone && (
            <div>
              <Label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number {job.requirePhone && <span className="text-red-500">*</span>}
              </Label>
              <Input
                {...form.register("phone")}
                type="tel"
                id="phone"
                placeholder="(123) 456-7890"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {form.formState.errors.phone && (
                <p className="mt-1 text-sm text-red-600">{form.formState.errors.phone.message}</p>
              )}
            </div>
          )}

          {/* Address */}
          {job.enableAddress && (
            <div>
              <Label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
                Address {job.requireAddress && <span className="text-red-500">*</span>}
              </Label>
              <Input
                {...form.register("address")}
                type="text"
                id="address"
                placeholder="1234 Main St, City, State, 12345"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {form.formState.errors.address && (
                <p className="mt-1 text-sm text-red-600">{form.formState.errors.address.message}</p>
              )}
            </div>
          )}

          {/* Resume Upload */}
          <div>
            <Label className="block text-sm font-medium text-gray-700 mb-2">
              CV/Resume
            </Label>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                dragActive 
                  ? 'border-blue-400 bg-blue-50' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="flex flex-col items-center">
                {resumeFile ? (
                  <>
                    <FileText className="w-8 h-8 text-green-500 mb-2" />
                    <p className="text-sm text-gray-600">{resumeFile.name}</p>
                    <p className="text-xs text-gray-500">
                      {(resumeFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    {isUploading && (
                      <div className="w-full max-w-xs mt-2">
                        <div className="bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-gray-400 mb-3" />
                    <p className="text-sm text-gray-600 font-medium mb-1">
                      Drop your files here or <span className="text-blue-600">click to browse</span>
                    </p>
                    <p className="text-xs text-gray-500">PDF or DOC, max 2 files, max 5MB each</p>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="sr-only"
                accept=".pdf,.doc,.docx"
                onChange={handleFileSelect}
              />
            </div>
          </div>

          {/* Licensing Information */}
          {job.showLicenseOptions && (
            <div className="space-y-3 rounded-lg border p-4">
              <h3 className="text-base font-medium">
                Real Estate License Status {job.licenseStateName && `in ${job.licenseStateName}`}
              </h3>
              <div className="flex items-start space-x-3">
                <Checkbox id="isLicensed" {...form.register("isLicensed")} />
                <div className="grid gap-1.5 leading-none">
                  <label htmlFor="isLicensed" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    I AM currently a licensed real estate agent {job.licenseStateName && `in ${job.licenseStateName}`}
                  </label>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Checkbox id="wantsLicense" {...form.register("wantsLicense")} />
                <div className="grid gap-1.5 leading-none">
                  <label htmlFor="wantsLicense" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    I AM NOT currently a licensed real estate agent {job.licenseStateName && `in ${job.licenseStateName}`}, but would like assistance becoming one
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Terms and Conditions */}
          <div className="flex items-start space-x-3">
            <Checkbox
              id="agreedToMarketing"
              {...form.register("agreedToMarketing")}
              className="mt-0.5"
            />
            <Label
              htmlFor="agreedToMarketing"
              className="text-sm text-gray-600 leading-5 cursor-pointer"
            >
              I agree to receive marketing messaging at the phone number provided above. I understand I will receive messages; Message and data rates may apply; reply STOP to opt-out.{" "}
              <span className="font-medium text-blue-600 hover:underline cursor-pointer">
                Privacy Policy
              </span>
              {" / "}
              <span className="font-medium text-blue-600 hover:underline cursor-pointer">
                Terms of Service
              </span>
            </Label>
          </div>

          {/* Submit Button */}
          <div className="pt-4">
            <Button
              type="submit"
              disabled={submitApplicationMutation.isPending || isUploading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-md transition-colors duration-200"
            >
              {submitApplicationMutation.isPending ? "Submitting..." : "Submit Application"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}