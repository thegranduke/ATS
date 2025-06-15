import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest, queryClient } from "@/lib/queryClient";
import DashboardSidebar from "@/components/dashboard-sidebar";
import { 
  ChevronLeft, 
  ExternalLink,
  Link as LinkIcon,
  Copy
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Job, insertJobSchema } from "@shared/schema";
import { z } from "zod";
import ReactQuill from 'react-quill';

type JobFormValues = z.infer<typeof insertJobSchema>;

// Define the tab types
type TabType = "details" | "description" | "application" | "promotion";

export default function EditJob() {
  const { id } = useParams();
  const [_, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>("details");
  const [isRemoteJob, setIsRemoteJob] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const jobId = id ? parseInt(id) : 0;
  
  // Form state
  const [formData, setFormData] = useState<JobFormValues & {
    category?: string;
    education?: string;
    experience?: string;
    country?: string;
    state?: string;
    city?: string;
    salaryStart?: string;
    salaryEnd?: string;
    paymentType?: string;
    currency?: string;
    internalCode?: string;
    // Application form settings
    requireFirstName?: boolean;
    requireLastName?: boolean;
    requireEmail?: boolean;
    requirePhone?: boolean;
    enablePhone?: boolean;
    requireAddress?: boolean;
    enableAddress?: boolean;
    requireResume?: boolean;
    // For backward compatibility
    location?: string;
  }>({
    title: "",
    department: "",
    locationId: null,
    type: "full-time",
    status: "open",
    description: "",
    companyId: user?.companyId || 0,
    category: "real_estate",
    education: "",
    experience: "select_experience",
    country: "select_country",
    state: "select_state",
    city: "",
    salaryStart: "",
    salaryEnd: "",
    paymentType: "select_payment_type",
    currency: "select_currency",
    internalCode: "",
    
    // Application form settings with default values
    requireEmail: true,
    requirePhone: false,
    enablePhone: true,
    requireAddress: false,
    enableAddress: true,
    requireResume: true,
    enableResume: true,
  });
  
  // Query for company locations
  const {
    data: locations,
    isLoading: isLoadingLocations,
  } = useQuery({
    queryKey: ["/api/locations"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/locations`);
      return res.json();
    },
    enabled: !!user,
  });
  
  // Query for job details
  const {
    data: job,
    isLoading,
    isError,
    error,
    refetch
  } = useQuery({
    queryKey: ["/api/jobs", id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/jobs/${id}`);
      return res.json();
    },
    enabled: !!user && !!id,
  });
  
  // When job data is loaded, update the form state
  useEffect(() => {
    if (job) {
      console.log("[DIAG] Job data loaded from API:", JSON.stringify(job, null, 2));
      
      // Create form data with job data
      const newFormData = {
        ...job
      };
      
      console.log("[DIAG] Setting form data with:", JSON.stringify(newFormData, null, 2));
      setFormData(newFormData);
      
      // Legacy: Check if job has location info for remote status
      const location = job.location?.name || "";
      const isRemote = location.toLowerCase().includes("remote") || false;
      console.log("[DIAG] Setting remote job status:", isRemote);
      setIsRemoteJob(isRemote);
    }
  }, [job, id]);
  
  // Update job mutation
  const updateJobMutation = useMutation({
    mutationFn: async (data: JobFormValues) => {
      if (!jobId) {
        throw new Error("Job ID is required for updates");
      }
      
      console.log("[DIAG] Making API call to update job with data:", JSON.stringify(data, null, 2));
      
      const response = await apiRequest("PUT", `/api/jobs/${jobId}`, data);
      console.log("[DIAG] API response status:", response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("[DIAG] API error response:", errorText);
        throw new Error(`Failed to update job: ${errorText}`);
      }
      
      const responseData = await response.json();
      console.log("[DIAG] API success response:", JSON.stringify(responseData, null, 2));
      return responseData;
    },
    onSuccess: (updatedJob) => {
      console.log("[DIAG] Mutation success - updated job:", JSON.stringify(updatedJob, null, 2));
      
      // Completely invalidate all job-related queries to ensure fresh data on all screens
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/company/jobs"] });
      
      // Also update the individual job in the cache directly
      queryClient.setQueryData(["/api/jobs", id], updatedJob);
      
      // Refetch job data immediately to ensure we have the latest
      refetch();
      
      toast({
        title: "Success",
        description: "Job has been updated successfully",
      });
      setIsSubmitting(false);
    },
    onError: (error: Error) => {
      console.error("[DIAG] Mutation error:", error.message, error.stack);
      toast({
        title: "Error",
        description: error.message || "Failed to update job",
        variant: "destructive",
      });
      setIsSubmitting(false);
    },
  });
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    console.log(`[DIAG] Form field '${name}' changed to:`, value);
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleRemoteToggle = (checked: boolean) => {
    setIsRemoteJob(checked);
    // We no longer modify the location string directly since we use locationId
    // This is kept for backward compatibility but isn't needed with the new data model
  };
  
  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.title || !formData.department ||  !formData.description) {
      toast({
        title: "Missing required fields",
        description: "Please fill out all required fields",
        variant: "destructive"
      });
      return;
    }
    
    // Validate select fields with placeholder values - only if they've been changed from empty
    const invalidSelectFields = [];
    
    // For experience field (optional)
    if (formData.experience && formData.experience === "select_experience") {
      invalidSelectFields.push("Experience");
    }
    
    // For salary fields (if payment type is selected, currency should be too and vice versa)
    if (formData.paymentType && formData.paymentType === "select_payment_type") {
      invalidSelectFields.push("Payment Type");
    }
    if (formData.currency && formData.currency === "select_currency") {
      invalidSelectFields.push("Currency");
    }
    
    // Show toast if any invalid fields
    if (invalidSelectFields.length > 0) {
      toast({
        title: "Invalid selections",
        description: `Please make valid selections for: ${invalidSelectFields.join(", ")}`,
        variant: "destructive"
      });
      return;
    }
    
    // Making sure companyId is set
    if (!user?.companyId) {
      toast({
        title: "Error",
        description: "User company information not found. Please try logging out and back in.",
        variant: "destructive"
      });
      return;
    }
    
    setIsSubmitting(true);
    
    // Create a local storage entry for application form settings
    // for this specific job (identified by ID)
    const formSettings = {
      requireFirstName: formData.requireFirstName,
      requireLastName: formData.requireLastName,
      requireEmail: formData.requireEmail,
      requirePhone: formData.requirePhone,
      enablePhone: formData.enablePhone,
      requireAddress: formData.requireAddress,
      enableAddress: formData.enableAddress,
      requireResume: formData.requireResume
    };
    localStorage.setItem(`job_form_settings_${id}`, JSON.stringify(formSettings));
    
    // Only send the actual job data to the API
    // Convert placeholder values to empty strings
    const jobData: JobFormValues = {
      title: formData.title,
      department: formData.department,
      locationId: formData.locationId ? parseInt(String(formData.locationId)) : null,
      type: formData.type,
      status: formData.status,
      description: formData.description,
      companyId: user.companyId,
      category: formData.category,
      experience: formData.experience === "select_experience" ? "" : formData.experience,
      salaryStart: formData.salaryStart,
      salaryEnd: formData.salaryEnd,
      paymentType: formData.paymentType === "select_payment_type" ? "" : formData.paymentType,
      currency: formData.currency === "select_currency" ? "" : formData.currency,
      internalCode: formData.internalCode,
      education: formData.education,
      // Always include these required fields for server validation
      requireFirstName: true,
      requireLastName: true,
      requireEmail: true,
      // Include form settings in the job data (fix)
      requirePhone: formData.requirePhone,
      enablePhone: formData.enablePhone,
      requireAddress: formData.requireAddress,
      enableAddress: formData.enableAddress,
      requireResume: formData.requireResume,
      // Add missing required fields for schema
      formHeaderText: formData.formHeaderText || "",
      formDescription: formData.formDescription || "",
      showLicenseOptions: formData.showLicenseOptions ?? false,
      licenseStateName: formData.licenseStateName || ""
    };
    
    console.log("[DIAG] Prepared job data for submission:", JSON.stringify(jobData, null, 2));
    
    console.log("Submitting job data:", jobData);
    updateJobMutation.mutate(jobData);
  };
  
  // Handle changes to application form requirement and enable toggles
  const handleFormToggle = (field: string, value: boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCancel = () => {
    navigate("/jobs");
  };
  
  if (isLoading) {
    return (
      <DashboardSidebar>
        <div className="p-8 flex justify-center">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      </DashboardSidebar>
    );
  }
  
  if (isError) {
    return (
      <DashboardSidebar>
        <div className="p-8">
          <h1 className="text-xl font-bold text-red-600">Error</h1>
          <p className="text-gray-600">{error?.message || "Failed to load job details"}</p>
          <Button className="mt-4" onClick={() => navigate("/jobs")}>
            Back to Jobs
          </Button>
        </div>
      </DashboardSidebar>
    );
  }
  
  return (
    <DashboardSidebar>
      <div className="px-4 py-6 sm:px-6 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center">
            <button 
              onClick={() => navigate("/jobs")}
              className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Back to Jobs
            </button>
            <h1 className="text-2xl font-bold text-gray-900 ml-6">Edit Job</h1>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-primary text-sm font-medium inline-flex items-center hover:underline"
            onClick={() => {
              if (job && job.applicationLink) {
                window.open(`/apply/${job.applicationLink}`, '_blank');
              } else {
                toast({
                  title: "No application link yet",
                  description: "Save the job first to generate an application link.",
                  variant: "destructive"
                });
              }
            }}
          >
            Preview job posting <ExternalLink className="ml-1 h-3 w-3" />
          </Button>
        </div>
        
        {/* Tabs */}
        <Tabs 
          defaultValue="details" 
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as TabType)}
          className="w-full"
        >
          <TabsList className="mb-6 border-b w-full justify-start rounded-none h-auto p-0 bg-transparent">
            <TabsTrigger 
              value="details" 
              className={cn(
                "rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none py-2 px-4 text-sm font-medium",
                activeTab === "details" ? "text-primary" : "text-gray-600"
              )}
            >
              Job Details
            </TabsTrigger>
            <TabsTrigger 
              value="description" 
              className={cn(
                "rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none py-2 px-4 text-sm font-medium",
                activeTab === "description" ? "text-primary" : "text-gray-600"
              )}
            >
              Job Description
            </TabsTrigger>
            <TabsTrigger 
              value="application" 
              className={cn(
                "rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none py-2 px-4 text-sm font-medium",
                activeTab === "application" ? "text-primary" : "text-gray-600"
              )}
            >
              Application Form
            </TabsTrigger>
            <TabsTrigger 
              value="promotion" 
              className={cn(
                "rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none py-2 px-4 text-sm font-medium",
                activeTab === "promotion" ? "text-primary" : "text-gray-600"
              )}
            >
              Promotion
            </TabsTrigger>
          </TabsList>
          
          <form className="bg-white p-6 rounded-lg border border-gray-100">
            <TabsContent value="details" className="mt-0">
              <div className="space-y-6">
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    className="mt-2"
                  />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div>
                    <Label htmlFor="type">Job Type</Label>
                    <select
                      id="type"
                      name="type"
                      value={formData.type}
                      onChange={handleChange}
                      className="mt-2 w-full rounded-md border border-gray-300 h-10 px-3 focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="full-time">Full-time</option>
                      <option value="part-time">Part-time</option>
                      <option value="contract">Contract</option>
                      <option value="internship">Internship</option>
                    </select>
                  </div>
                  
                  <div>
                    <Label htmlFor="category">Category (Optional)</Label>
                    <select
                      id="category"
                      name="category"
                      value={formData.category}
                      onChange={handleChange}
                      className="mt-2 w-full rounded-md border border-gray-300 h-10 px-3 focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="real_estate">Real Estate</option>
                      <option value="sales">Sales</option>
                      <option value="marketing">Marketing</option>
                      <option value="engineering">Engineering</option>
                      <option value="design">Design</option>
                      <option value="finance">Finance</option>
                    </select>
                  </div>
                  
                  <div>
                    <Label htmlFor="experience">Experience (Optional)</Label>
                    <select
                      id="experience"
                      name="experience"
                      value={formData.experience}
                      onChange={handleChange}
                      className="mt-2 w-full rounded-md border border-gray-300 h-10 px-3 focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="select_experience">Select experience</option>
                      <option value="entry">Entry level</option>
                      <option value="mid">Mid level</option>
                      <option value="senior">Senior level</option>
                      <option value="executive">Executive level</option>
                    </select>
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    name="department"
                    value={formData.department}
                    onChange={handleChange}
                    className="mt-2"
                    placeholder="Ex: Recruiting"
                  />
                </div>
                
                <div>
                  <Label htmlFor="internalCode">Internal Code</Label>
                  <Input
                    id="internalCode"
                    name="internalCode"
                    value={formData.internalCode}
                    onChange={handleChange}
                    className="mt-2"
                    placeholder="Insert Code here"
                  />
                </div>
                
                <div>
                  <h3 className="text-base font-medium mb-3">Location</h3>
                  
                  <div className="flex items-center mb-4">
                    <Switch
                      id="remoteJob"
                      checked={isRemoteJob}
                      onCheckedChange={handleRemoteToggle}
                    />
                    <Label htmlFor="remoteJob" className="ml-2">
                      Remote Job
                    </Label>
                  </div>
                  
                  <p className="text-sm text-gray-500 mb-2">
                    Choose a location from the dropdown. For remote jobs, select a location with "Remote" in the name.
                  </p>
                  
                  <div className="grid grid-cols-1 gap-4 mb-4">
                    <div>
                      <Label htmlFor="locationId">Location</Label>
                      {isLoadingLocations ? (
                        <div className="mt-2 h-10 w-full rounded-md border border-gray-300 flex items-center justify-center">
                          <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                        </div>
                      ) : (
                        <select
                          id="locationId"
                          name="locationId"
                          value={formData.locationId || ""}
                          onChange={handleChange}
                          className="mt-2 w-full rounded-md border border-gray-300 h-10 px-3 focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="">Select location</option>
                          {locations && locations.map((location: any) => (
                            <option key={location.id} value={location.id}>
                              {location.name} - {location.city}, {location.state} {location.zipCode}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    
                    {!locations || locations.length === 0 && !isLoadingLocations && (
                      <div className="text-sm text-amber-600">
                        No locations found. Please add locations in the Locations management page first.
                      </div>
                    )}
                  </div>
                </div>
                
                <div>
                  <h3 className="text-base font-medium mb-3">Salary</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="salaryStart">Starts From</Label>
                      <Input
                        id="salaryStart"
                        name="salaryStart"
                        value={formData.salaryStart}
                        onChange={handleChange}
                        className="mt-2"
                        placeholder="Ex: $1,500"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="salaryEnd">To</Label>
                      <Input
                        id="salaryEnd"
                        name="salaryEnd"
                        value={formData.salaryEnd}
                        onChange={handleChange}
                        className="mt-2"
                        placeholder="Ex: $10,000"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="paymentType">Payment Type</Label>
                      <select
                        id="paymentType"
                        name="paymentType"
                        value={formData.paymentType}
                        onChange={handleChange}
                        className="mt-2 w-full rounded-md border border-gray-300 h-10 px-3 focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="select_payment_type">Select payment type</option>
                        <option value="hourly">Hourly</option>
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                    </div>
                    
                    <div>
                      <Label htmlFor="currency">Currency</Label>
                      <select
                        id="currency"
                        name="currency"
                        value={formData.currency}
                        onChange={handleChange}
                        className="mt-2 w-full rounded-md border border-gray-300 h-10 px-3 focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="select_currency">Select currency</option>
                        <option value="usd">USD</option>
                        <option value="cad">CAD</option>
                        <option value="eur">EUR</option>
                        <option value="gbp">GBP</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="description" className="mt-0">
              <div className="space-y-6">
                <div>
                  <Label htmlFor="description">Description</Label>
                  <div className="mt-2">
                    <ReactQuill
                      id="description"
                      theme="snow"
                      value={formData.description}
                      onChange={(value) => setFormData(prev => ({ ...prev, description: value }))}
                      className="quill-editor-container"
                      modules={{
                        toolbar: [
                          [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
                          ['bold', 'italic', 'underline', 'strike'],
                          [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                          [{ 'indent': '-1'}, { 'indent': '+1' }],
                          ['link'],
                          ['clean']
                        ]
                      }}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="application" className="mt-0">
              <div className="space-y-8">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <h4 className="font-medium text-blue-900 mb-2">Application Form Fields</h4>
                  <p className="text-sm text-blue-700">
                    Configure which fields candidates see when applying. First name, last name, and email are always required and cannot be disabled.
                  </p>
                </div>

                {/* Optional Fields */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Optional Fields</h3>
                  
                  <div className="flex items-center justify-between py-3 border-b">
                    <div>
                      <p className="font-medium">Phone Number</p>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">Required</span>
                        <Switch
                          id="requirePhone"
                          checked={formData.requirePhone}
                          disabled={!formData.enablePhone}
                          onCheckedChange={(checked) => handleFormToggle('requirePhone', checked)}
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">Enable</span>
                        <Switch
                          id="enablePhone"
                          checked={formData.enablePhone}
                          onCheckedChange={(checked) => {
                            handleFormToggle('enablePhone', checked);
                            if (!checked) {
                              handleFormToggle('requirePhone', false);
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b">
                    <div>
                      <p className="font-medium">Address</p>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">Required</span>
                        <Switch
                          id="requireAddress"
                          checked={formData.requireAddress}
                          disabled={!formData.enableAddress}
                          onCheckedChange={(checked) => handleFormToggle('requireAddress', checked)}
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">Enable</span>
                        <Switch
                          id="enableAddress"
                          checked={formData.enableAddress}
                          onCheckedChange={(checked) => {
                            handleFormToggle('enableAddress', checked);
                            if (!checked) {
                              handleFormToggle('requireAddress', false);
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Documents */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Documents</h3>
                  
                  <div className="flex items-center justify-between py-3 border-b">
                    <div>
                      <p className="font-medium">Resume/CV</p>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">Required</span>
                        <Switch
                          id="requireResume"
                          checked={formData.requireResume}
                          onCheckedChange={(checked) => handleFormToggle('requireResume', checked)}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* License Status */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">License Status</h3>
                  
                  <div className="flex items-center justify-between py-3 border-b">
                    <div>
                      <p className="font-medium">Enable License Status Section</p>
                      <p className="text-sm text-gray-500">
                        Ask candidates about their real estate license status.
                      </p>
                    </div>
                    <div className="flex items-center space-x-4">
                      <Switch
                        id="showLicenseOptions"
                        checked={formData.showLicenseOptions}
                        onCheckedChange={(checked) => handleFormToggle('showLicenseOptions', checked)}
                      />
                    </div>
                  </div>

                  {formData.showLicenseOptions && (
                    <div className="py-3">
                      <Label htmlFor="licenseStateName">License State Name</Label>
                      <Input
                        id="licenseStateName"
                        name="licenseStateName"
                        value={formData.licenseStateName || ""}
                        onChange={handleChange}
                        className="mt-2"
                        placeholder="e.g., California"
                      />
                      <p className="text-sm text-gray-500 mt-2">
                        Enter the state name to be displayed on the application form (e.g., "I am licensed in [State Name]").
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="promotion" className="mt-0">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-2">Application Preview</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Preview how your application form appears to candidates. This helps ensure a smooth candidate experience before sharing the job.
                  </p>
                  
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      className="flex items-center"
                      onClick={() => {
                        if (job && job.applicationLink) {
                          window.open(`/apply/${job.applicationLink}`, '_blank');
                        } else {
                          // If job is not saved or has no application link yet
                          toast({
                            title: "No application link yet",
                            description: "Save the job first to generate an application link.",
                            variant: "destructive"
                          });
                        }
                      }}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Preview Application Form
                    </Button>
                  </div>
                </div>
                
                <div className="border-t border-gray-200 pt-6 mt-6">
                  <h3 className="text-lg font-medium mb-2">Job Sharing</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Share this job posting on social media platforms and job boards to reach more candidates.
                  </p>
                  
                  {job && job.applicationLink ? (
                    <div className="bg-gray-100 p-3 rounded flex items-center mb-4">
                      <LinkIcon className="mr-2 h-4 w-4 text-gray-400" />
                      <span className="text-sm truncate flex-1">{`${window.location.origin}/apply/${job.applicationLink}`}</span>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          const url = `${window.location.origin}/apply/${job.applicationLink}`;
                          navigator.clipboard.writeText(url);
                          toast({
                            title: "Link copied",
                            description: "Application link copied to clipboard"
                          });
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="bg-amber-50 p-3 rounded border border-amber-200 text-amber-700 text-sm mb-4">
                      Save the job first to generate a shareable application link.
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
            
            <div className="mt-8 flex items-center justify-end space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSaveChanges}
                disabled={isSubmitting}
                className="bg-primary hover:bg-primary/90"
              >
                {isSubmitting ? (
                  <span className="flex items-center">
                    <span className="mr-2 h-4 w-4 animate-spin border-t-2 border-b-2 border-white rounded-full"></span>
                    Saving Changes...
                  </span>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </form>
        </Tabs>
      </div>
    </DashboardSidebar>
  );
}