import { useState, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useEffect } from "react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { applicationFormSchema } from "@shared/schema";
import { Briefcase, Building, FileText, MapPin, AlertCircle, Check, DollarSign, Calendar, Upload } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { EnhancedApplicationForm } from "@/components/enhanced-application-form";
import { Checkbox } from "@/components/ui/checkbox";

export default function ApplicationForm() {
  // Get URL parameters - now handling both URL formats
  // 1. /apply/:applicationLink (legacy)
  // 2. /j/:jobId/:shortCode (new format)
  const params = useParams();
  const { applicationLink, jobId, shortCode } = params;
  const { toast } = useToast();
  const [_, navigate] = useLocation();
  const [submitted, setSubmitted] = useState(false);
  const [showApplicationForm, setShowApplicationForm] = useState(true);
  const [viewTracked, setViewTracked] = useState(false);
  
  // Determine the API endpoint based on the URL format
  const getApiEndpoint = () => {
    if (applicationLink) {
      // Legacy format
      return `/api/application/${applicationLink}`;
    } else if (jobId && shortCode) {
      // New format - server will handle the lookup
      return `/api/application/job/${jobId}/${shortCode}`;
    }
    // Fallback (shouldn't happen with proper routing)
    return null;
  };
  
  // Get the application link for form submission
  const getFormLink = () => {
    if (applicationLink) {
      return applicationLink;
    } else if (jobId && shortCode) {
      return `${jobId}-${shortCode}`;
    }
    return '';
  };
  
  // Job view tracking mutation
  const trackJobViewMutation = useMutation({
    mutationFn: async (data: { jobId: number; companyId: number, ipAddress: string; sessionId: string }) => {
      const response = await apiRequest("POST", "/api/job-views", data);
      return response.json();
    }
  });
  
  // Get API endpoint based on URL format
  const apiEndpoint = getApiEndpoint();
  
  // Query for job information using the appropriate API endpoint
  const {
    data: job,
    isLoading,
    isError,
    error
  } = useQuery({
    queryKey: [apiEndpoint],
    enabled: !!apiEndpoint, // Only run if we have a valid endpoint
    queryFn: async () => {
      if (!apiEndpoint) {
        throw new Error("Invalid application link");
      }
      
      const res = await fetch(apiEndpoint);
      if (!res.ok) {
        throw new Error("Failed to load job information");
      }
      return res.json();
    },
  });

  // Effect to track job view when job data is loaded
  useEffect(() => {
    if (job?.id && job?.company?.id && !viewTracked && !isLoading) {
      const sessionId =
        localStorage.getItem("recruitflow_session_id") || Math.random().toString(36).slice(2);
      localStorage.setItem("recruitflow_session_id", sessionId);

      trackJobViewMutation.mutate({
        jobId: job.id,
        companyId: job.company.id, // Correctly access the nested company ID
        ipAddress: window.location.hostname,
        sessionId,
      });
      setViewTracked(true);
    }
  }, [job, isLoading, viewTracked]);

  // State for resume file
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Create application form
  const form = useForm<z.infer<typeof applicationFormSchema>>({
    resolver: zodResolver(applicationFormSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      coverLetter: "",
    },
  });

  // Resume upload mutation
  const uploadResumeMutation = useMutation({
    mutationFn: async (file: File) => {
      console.log("uploadResumeMutation - Starting file upload:", file.name, file.type, file.size);
      setIsUploading(true);
      setUploadProgress(10);
      
      const formData = new FormData();
      formData.append('document', file);
      console.log("uploadResumeMutation - FormData created with file");
      
      // Get the appropriate form link
      const formLink = getFormLink();
      if (!formLink) {
        throw new Error("Invalid application link");
      }
      
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 300);
      
      try {
        // Use either the legacy or new URL format for document upload
        const uploadEndpoint = jobId && shortCode
          ? `/api/application/job/${jobId}/${shortCode}/document`
          : `/api/application/${formLink}/document`;
          
        console.log(`uploadResumeMutation - Sending POST request to ${uploadEndpoint}`);
        const response = await fetch(uploadEndpoint, {
          method: 'POST',
          body: formData,
        });
        
        clearInterval(progressInterval);
        setUploadProgress(100);
        
        console.log("uploadResumeMutation - Response received:", response.status, response.statusText);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error("uploadResumeMutation - Error response:", errorText);
          throw new Error(`Failed to upload resume: ${response.status} ${response.statusText} - ${errorText}`);
        }
        
        try {
          const responseText = await response.text();
          console.log("uploadResumeMutation - Response body:", responseText);
          
          if (!responseText) {
            console.error("uploadResumeMutation - Empty response body");
            throw new Error("Empty response from server");
          }
          
          const result = JSON.parse(responseText);
          console.log("uploadResumeMutation - Parsed result:", result);
          
          if (!result.documentId) {
            console.error("uploadResumeMutation - Missing documentId in response");
            throw new Error("Missing documentId in response");
          }
          
          return result.documentId;
        } catch (parseError: any) {
          console.error("uploadResumeMutation - Error parsing response:", parseError);
          throw new Error(`Failed to parse server response: ${parseError && (parseError as Error).message || 'Unknown parsing error'}`);
        }
      } catch (error) {
        console.error("uploadResumeMutation - Error:", error);
        throw error;
      } finally {
        console.log("uploadResumeMutation - Upload process completed");
        setIsUploading(false);
      }
    }
  });

  // Submit application mutation
  const submitApplicationMutation = useMutation({
    mutationFn: async (data: z.infer<typeof applicationFormSchema> & { documentId?: number }) => {
      console.log("submitApplicationMutation - Starting with data:", data);
      
      // Get the appropriate form link
      const formLink = getFormLink();
      if (!formLink) {
        throw new Error("Invalid application link");
      }
      
      try {
        // Use either the legacy or new URL format for application submission
        const submitEndpoint = jobId && shortCode
          ? `/api/application/job/${jobId}/${shortCode}`
          : `/api/application/${formLink}`;
          
        console.log(`submitApplicationMutation - Sending POST request to ${submitEndpoint}`);
        const response = await fetch(submitEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });
        
        console.log("submitApplicationMutation - Response received:", response.status, response.statusText);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error("submitApplicationMutation - Error response:", errorText);
          throw new Error(`Failed to submit application: ${response.status} ${response.statusText} - ${errorText}`);
        }
        
        try {
          const responseText = await response.text();
          console.log("submitApplicationMutation - Response body:", responseText);
          
          if (!responseText) {
            console.error("submitApplicationMutation - Empty response body");
            throw new Error("Empty response from server");
          }
          
          const result = JSON.parse(responseText);
          console.log("submitApplicationMutation - Parsed result:", result);
          return result;
        } catch (parseError: any) {
          console.error("submitApplicationMutation - Error parsing response:", parseError);
          throw new Error(`Failed to parse server response: ${parseError && (parseError as Error).message || 'Unknown parsing error'}`);
        }
      } catch (error) {
        console.error("submitApplicationMutation - Error:", error);
        throw error;
      }
    },
    onSuccess: () => {
      console.log("submitApplicationMutation - SUCCESS: Application submitted successfully");
      setSubmitted(true);
      toast({
        title: "Application submitted",
        description: "Your application has been successfully submitted.",
      });
      // Scroll to top after submission
      window.scrollTo(0, 0);
    },
    onError: (error: Error) => {
      console.error("submitApplicationMutation - FAILURE: Application submission error:", error);
      toast({
        title: "Failed to submit application",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  async function onSubmit(values: z.infer<typeof applicationFormSchema>) {
    console.log("Application form submission started:", values);
    
    if (!resumeFile) {
      toast({
        title: "Resume required",
        description: "Please upload your resume to complete your application",
        variant: "destructive",
      });
      return;
    }
    
    console.log("Resume file ready for upload:", resumeFile.name);
    
    try {
      // First upload the resume
      console.log("Starting resume upload...");
      const documentId = await uploadResumeMutation.mutateAsync(resumeFile);
      console.log("Resume upload successful, document ID:", documentId);
      
      // Then submit the application with the document ID
      console.log("Submitting application with document ID:", documentId);
      await submitApplicationMutation.mutateAsync({
        ...values,
        documentId
      });
      console.log("Application submission completed");
    } catch (error) {
      console.error("Application submission error:", error);
      // Error is handled by the mutations
    }
  }

  // If the page is loading
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="flex justify-center">
          <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        </div>
        <h2 className="mt-6 text-center text-xl font-medium text-gray-900">
          Loading job details...
        </h2>
      </div>
    );
  }

  // If there was an error loading the job
  if (isError) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {error?.message || "We couldn't load this job application. The link may be invalid or the job posting has been removed."}
            </AlertDescription>
          </Alert>
          <div className="mt-6 text-center">
            <Button variant="outline" onClick={() => navigate("/")}>
              Return to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // If the application was successfully submitted
  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center">
            <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center">
              <Check className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Application Submitted
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Thank you for applying to {job.title} at {job.company.name}. We'll review your application and get back to you soon.
          </p>
          <div className="mt-6 text-center">
            <Button 
              variant="outline" 
              onClick={() => {
                // Reset form state and show the application form again
                setSubmitted(false);
                // Scroll to top
                window.scrollTo(0, 0);
              }}
            >
              Return to Application Form
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Job preview page
  if (!showApplicationForm) {
    // Format salary range if available
    const formatSalary = () => {
      if (job.salaryStart && job.salaryEnd) {
        const currency = job.currency ? job.currency.toUpperCase() : '$';
        const frequency = job.paymentType ? 
          (job.paymentType === 'hourly' ? '/hr' : 
           job.paymentType === 'monthly' ? '/month' : '/year') : '';
        return `${currency}${job.salaryStart} - ${currency}${job.salaryEnd}${frequency}`;
      }
      return null;
    };

    // No longer needed map location function after removing Google Maps

    const formattedDate = (dateString: string | Date) => {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }).format(date);
    };

    return (
      <div className="min-h-screen flex flex-col">
        {/* Header banner */}
        <div className="bg-primary text-white py-16 px-4 text-center">
          <div className="max-w-5xl mx-auto">
            <h1 className="text-4xl font-bold mb-4">{job.title}</h1>
            <div className="flex flex-wrap justify-center gap-4 mt-4">
              <div className="flex items-center">
                <MapPin className="h-5 w-5 mr-1" />
                <span>{job.location}</span>
              </div>
              <div className="flex items-center">
                <Briefcase className="h-5 w-5 mr-1" />
                <span>{job.category || "Real Estate"}</span>
              </div>
              {formatSalary() && (
                <div className="flex items-center">
                  <DollarSign className="h-5 w-5 mr-1" />
                  <span>{formatSalary()}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto w-full px-0 md:px-4 py-8">
          <div className="flex flex-col md:flex-row md:justify-between mb-8">
            <div>
              <div className="text-gray-500 mb-2">
                <a href="#" className="hover:underline">Job Openings</a> &gt; {job.title}
              </div>
              <h2 className="text-2xl font-bold mb-2">About the {job.title} position</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 px-4">
            <div className="md:col-span-8 pl-0">
              <div className="prose max-w-none mb-8">
                <div dangerouslySetInnerHTML={{ __html: job.description }} />
              </div>

              {job.experience && (
                <div className="mb-8">
                  <h3 className="text-xl font-semibold mb-4">Requirements</h3>
                  <ul className="list-disc list-inside space-y-2">
                    <li>Experience: {job.experience.charAt(0).toUpperCase() + job.experience.slice(1)} level</li>
                    {job.education && <li>Education: {job.education}</li>}
                  </ul>
                </div>
              )}

              <div className="mb-8">
                <h3 className="text-xl font-semibold mb-4">Job Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="font-medium">Job Type:</span> {job.type.charAt(0).toUpperCase() + job.type.slice(1)}
                  </div>
                  <div>
                    <span className="font-medium">Department:</span> {job.department}
                  </div>
                  {job.createdAt && (
                    <div>
                      <span className="font-medium">Posted on:</span> {formattedDate(job.createdAt)}
                    </div>
                  )}
                </div>
              </div>

            </div>

            <div className="md:col-span-4 pl-0">
              <div className="mt-4">
                <Button 
                  className="bg-primary hover:bg-primary/90"
                  onClick={() => setShowApplicationForm(true)}
                >
                  Apply To Position
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-auto py-4 bg-gray-800 text-center text-gray-400 text-sm">
          <p>Powered by RecruitFlow</p>
        </div>
      </div>
    );
  }

  // Application form page - using enhanced form
  return (
    <EnhancedApplicationForm
      job={job}
      applicationLink={getFormLink()}
      onSuccess={() => setSubmitted(true)}
      onBack={() => setShowApplicationForm(false)}
    />
  );

  // Keep the old form as fallback (this code won't be reached with current logic)
  const LegacyForm = () => (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-primary text-white py-8 px-4">
        <div className="max-w-5xl mx-auto">
          <button 
            onClick={() => setShowApplicationForm(false)}
            className="text-white flex items-center mb-4 hover:underline"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to job details
          </button>
          <h1 className="text-3xl font-bold mb-2">Apply for {job.title}</h1>
          <p className="text-xl">at {job.company?.name || "Company"}</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Application Form</CardTitle>
            <CardDescription>
              Fill out the form below to apply for this position. Fields marked with an asterisk (*) are required.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Your full name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address *</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="Your email address" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Your phone number (optional)" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="space-y-2">
                  <FormLabel className="flex items-center">
                    Resume *
                    <FileText className="ml-2 h-4 w-4 text-gray-400" />
                  </FormLabel>
                  
                  <div className="border border-gray-200 rounded-md p-4">
                    <div className="flex flex-col space-y-4">
                      {resumeFile ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <FileText className="h-5 w-5 text-primary" />
                              <span className="text-sm font-medium">{resumeFile.name}</span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setResumeFile(null)}
                            >
                              Remove
                            </Button>
                          </div>
                          
                          <div className="text-xs text-gray-500">
                            {resumeFile.type} • {(resumeFile.size / 1024 / 1024).toFixed(2)} MB
                          </div>
                          
                          {isUploading && (
                            <div className="space-y-1">
                              <Progress value={uploadProgress} className="h-2" />
                              <div className="text-xs text-gray-500 text-right">{uploadProgress}%</div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                          <div 
                            className="border-2 border-dashed border-gray-300 rounded-md py-8 px-4 text-center hover:border-gray-400 transition-colors cursor-pointer"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <Upload className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                            <p className="text-sm font-medium text-gray-700">Click to upload your resume</p>
                            <p className="text-xs text-gray-500 mt-1">
                              PDF, DOC, DOCX up to 10MB
                            </p>
                          </div>
                          <div className="text-center">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => fileInputRef.current?.click()}
                            >
                              Select File
                            </Button>
                          </div>
                        </>
                      )}
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept=".pdf,.doc,.docx,.txt,.rtf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setResumeFile(file);
                          }
                        }}
                      />
                    </div>
                  </div>
                  
                  {!resumeFile && (
                    <p className="text-sm text-rose-500">
                      Please upload your resume to complete your application
                    </p>
                  )}
                </div>
                
                <FormField
                  control={form.control}
                  name="coverLetter"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cover Letter</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Tell us why you're interested in this position and why you'd be a good fit"
                          className="min-h-[150px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {job.showLicenseOptions && (
                  <div className="space-y-4 rounded-lg border p-4">
                    <h3 className="text-base font-medium">
                      Real Estate License Status
                      {job.licenseStateName && ` in ${job.licenseStateName}`}
                    </h3>
                    <FormField
                      control={form.control}
                      name="isLicensed"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>
                              I <span className="font-bold">AM</span> currently a licensed real estate agent
                              {job.licenseStateName && ` in ${job.licenseStateName}`}
                            </FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="wantsLicense"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>
                              I <span className="font-bold">AM NOT</span> currently a licensed real estate agent
                              {job.licenseStateName && ` in ${job.licenseStateName}`}, but would like assistance becoming one
                            </FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>
                )}
                
                <div className="pt-4">
                  <Button 
                    type="submit" 
                    className="w-full bg-primary hover:bg-primary/90"
                    disabled={submitApplicationMutation.isPending}
                  >
                    {submitApplicationMutation.isPending ? (
                      <span className="flex items-center justify-center">
                        <span className="mr-2 h-4 w-4 animate-spin border-t-2 border-b-2 border-white rounded-full"></span>
                        Submitting Application...
                      </span>
                    ) : (
                      "Submit Application"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
