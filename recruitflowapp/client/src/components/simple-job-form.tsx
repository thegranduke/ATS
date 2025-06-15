import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import ReactQuill from 'react-quill';

// Just importing for types
import { insertJobSchema, jobStatusValues, Job } from "@shared/schema";
import { z } from "zod";
type JobFormValues = z.infer<typeof insertJobSchema>;

export default function SimpleJobForm({ onSuccess }: { onSuccess?: (job: Job) => void }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    department: "",
    location: "",
    type: "full-time",
    status: "active",
    description: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDescriptionChange = (value: string) => {
    setFormData(prev => ({ ...prev, description: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log("[DIAG-SIMPLE] Form submission triggered");
    console.log("[DIAG-SIMPLE] Form values:", formData);
    
    // Validation
    if (!formData.title || !formData.department || !formData.location || !formData.description) {
      console.error("[DIAG-SIMPLE] Validation failed - missing required fields");
      toast({
        title: "Missing required fields",
        description: "Please fill out all required fields",
        variant: "destructive"
      });
      return;
    }
    
    if (!user?.companyId) {
      console.error("[DIAG-SIMPLE] Missing companyId in user data");
      toast({
        title: "Error",
        description: "User company information not found. Please try logging out and back in.",
        variant: "destructive"
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      console.log("[DIAG-SIMPLE] Attempting to submit job");
      
      const jobData = {
        ...formData,
        companyId: user.companyId
      };
      
      // Direct fetch implementation for debugging
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(jobData),
        credentials: "include"
      });
      
      console.log("[DIAG-SIMPLE] Response status:", response.status);
      
      if (!response.ok) {
        const responseText = await response.text();
        console.log("[DIAG-SIMPLE] Error response text:", responseText);
        throw new Error(`Server returned ${response.status}: ${responseText}`);
      }
      
      // Parse the response as JSON
      const createdJob = await response.json();
      console.log("[DIAG-SIMPLE] Created job:", createdJob);
      
      // Success path
      toast({
        title: "Job created",
        description: "Your job has been successfully created."
      });
      
      // Reset form
      setFormData({
        title: "",
        department: "",
        location: "",
        type: "full-time",
        status: "active",
        description: "",
      });
      
      // Call success callback with the created job
      if (onSuccess) {
        onSuccess(createdJob);
      }
      
    } catch (error) {
      console.error("[DIAG-SIMPLE] Form submission error:", error);
      toast({
        title: "Failed to create job",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Label htmlFor="title">Job Title*</Label>
        <Input 
          id="title"
          name="title"
          value={formData.title}
          onChange={handleChange}
          placeholder="e.g. Frontend Developer"
          required
          className="mt-1"
        />
      </div>
      
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="department">Department*</Label>
          <Input 
            id="department"
            name="department"
            value={formData.department}
            onChange={handleChange}
            placeholder="e.g. Engineering"
            required
            className="mt-1"
          />
        </div>
        
        <div>
          <Label htmlFor="location">Location*</Label>
          <Input 
            id="location"
            name="location"
            value={formData.location}
            onChange={handleChange}
            placeholder="e.g. Remote, New York, etc."
            required
            className="mt-1"
          />
        </div>
      </div>
      
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="type">Job Type*</Label>
          <select
            id="type"
            name="type"
            value={formData.type}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
            required
          >
            <option value="full-time">Full-time</option>
            <option value="part-time">Part-time</option>
            <option value="contract">Contract</option>
            <option value="internship">Internship</option>
          </select>
        </div>
        
        <div>
          <Label htmlFor="status">Status*</Label>
          <select
            id="status"
            name="status"
            value={formData.status}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
            required
          >
            {jobStatusValues.map((status) => (
              <option key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      <div>
        <Label htmlFor="description">Job Description*</Label>
        <div className="mt-1">
          <ReactQuill
            id="description"
            theme="snow"
            value={formData.description}
            onChange={handleDescriptionChange}
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
      </div>
      
      <Button 
        type="submit" 
        className="w-full"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Creating..." : "Create Job"}
      </Button>
    </form>
  );
}