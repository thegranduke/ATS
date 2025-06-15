import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { insertJobSchema, jobStatusValues } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import ReactQuill from 'react-quill';

// Extended schema with required fields
const jobFormSchema = insertJobSchema.extend({
  title: z.string().min(1, "Job title is required"),
  department: z.string().min(1, "Department is required"),
  location: z.string().min(1, "Location is required"),
  type: z.string().min(1, "Job type is required"),
  description: z.string().min(1, "Job description is required"),
});

type JobFormValues = z.infer<typeof jobFormSchema>;

interface JobFormProps {
  jobData?: JobFormValues;
  isEdit?: boolean;
  jobId?: number;
  onSuccess?: () => void;
}

export default function JobForm({ jobData, isEdit = false, jobId, onSuccess }: JobFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Default values
  const defaultValues: Partial<JobFormValues> = {
    title: "",
    department: "",
    location: "",
    type: "full-time",
    status: "active",
    description: "",
    ...jobData
  };

  const form = useForm<JobFormValues>({
    resolver: zodResolver(jobFormSchema),
    defaultValues,
  });

  // Create job mutation
  const createJobMutation = useMutation({
    mutationFn: async (data: JobFormValues) => {
      console.log("Creating job with data:", data);
      try {
        if (!user?.companyId) {
          throw new Error("Company ID not found");
        }

        // Include the company ID in the request
        const jobWithCompany = {
          ...data,
          companyId: user.companyId
        };

        const response = await apiRequest("POST", "/api/jobs", jobWithCompany);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to create job: ${errorText}`);
        }

        return await response.json();
      } catch (error) {
        console.error("Error in job creation:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({
        title: "Job created",
        description: "Your job has been successfully created.",
      });

      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create job",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update job mutation
  const updateJobMutation = useMutation({
    mutationFn: async (data: JobFormValues) => {
      if (!jobId) {
        throw new Error("Job ID is required for updates");
      }

      const response = await apiRequest("PUT", `/api/jobs/${jobId}`, data);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update job: ${errorText}`);
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId?.toString()] });
      toast({
        title: "Job updated",
        description: "Your job has been successfully updated.",
      });

      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update job",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  async function onSubmit(values: JobFormValues) {
    console.log("[DIAG] Form submission triggered with values:", JSON.stringify(values, null, 2));
    console.log("[DIAG] Form validation state:", JSON.stringify({
      isValid: form.formState.isValid,
      isDirty: form.formState.isDirty,
      errors: Object.keys(form.formState.errors).length > 0 ? form.formState.errors : "No errors"
    }, null, 2));
    console.log("[DIAG] User data:", user);

    // Always set the company ID from the authenticated user
    if (user?.companyId) {
      values.companyId = user.companyId;
    } else {
      console.error("[DIAG] Missing companyId in user data");
      toast({
        title: "Error",
        description: "User company information not found. Please try logging out and back in.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      console.log("[DIAG] Attempting to submit job with final data:", JSON.stringify(values, null, 2));

      if (isEdit && jobId) {
        console.log("[DIAG] Update job flow triggered");
        await updateJobMutation.mutateAsync(values);
      } else {
        console.log("[DIAG] Create job flow triggered");

        // Make sure all required fields are present
        const jobData = {
          title: values.title,
          department: values.department,
          location: values.location,
          type: values.type || "full-time",
          status: values.status || "active",
          description: values.description,
          companyId: user.companyId
        };

        console.log("[DIAG] Sanitized job data:", JSON.stringify(jobData, null, 2));

        // Use apiRequest instead of direct fetch for consistency
        console.log("[DIAG] Using apiRequest to submit job data");

        try {
          const response = await apiRequest("POST", "/api/jobs", jobData);
          console.log("[DIAG] apiRequest response status:", response.status);

          // Parse response
          const responseData = await response.json();
          console.log("[DIAG] apiRequest response data:", responseData);

          // Success path
          toast({
            title: "Job created",
            description: "Your job has been successfully created."
          });

          // Refresh job list
          queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });

          // Call success callback
          if (onSuccess) {
            onSuccess();
          }
        } catch (parseError) {
          console.error("[DIAG] Error parsing server response:", parseError);
          throw parseError;
        }
      }
    } catch (error) {
      console.error("[DIAG] Form submission error:", error);
      toast({
        title: "Failed to create job",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  // Simple submit handler for direct diagnostic
  const handleFormSubmitDirectly = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("[DIAG] Direct form submission triggered");
    console.log("[DIAG] Form values:", form.getValues());
    console.log("[DIAG] Will attempt to trigger real submission");
    form.handleSubmit(onSubmit)(e);
  };

  return (
    <Form {...form}>
      <form onSubmit={handleFormSubmitDirectly} className="space-y-6">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Job Title</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Frontend Developer" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="department"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Department</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Engineering" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>City</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. San Francisco, New York, etc." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Job Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Select job type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="full-time">Full-time</SelectItem>
                    <SelectItem value="part-time">Part-time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="internship">Internship</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {jobStatusValues.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Job Description</FormLabel>
              <FormControl>
                <div className="mt-2">
                  <ReactQuill
                    theme="snow"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Describe the job role, responsibilities, etc."
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
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />



        <Button 
          type="submit" 
          className="w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <span className="flex items-center">
              <span className="mr-2 h-4 w-4 animate-spin border-t-2 border-b-2 border-white rounded-full"></span>
              {isEdit ? "Updating..." : "Creating..."}
            </span>
          ) : (
            isEdit ? "Update Job" : "Create Job"
          )}
        </Button>
      </form>
    </Form>
  );
}