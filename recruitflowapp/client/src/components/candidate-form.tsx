import { useAuth } from "@/hooks/use-auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { insertCandidateSchema } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Extended schema with required fields
const candidateFormSchema = insertCandidateSchema.extend({
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Valid email address is required"),
});

type CandidateFormValues = z.infer<typeof candidateFormSchema>;

interface CandidateFormProps {
  candidateData?: CandidateFormValues;
  isEdit?: boolean;
  candidateId?: number;
  jobs?: any[];
  onSuccess?: (candidate: any) => void;
}

export default function CandidateForm({ candidateData, isEdit = false, candidateId, jobs = [], onSuccess }: CandidateFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Default values
  const defaultValues: Partial<CandidateFormValues> = {
    fullName: "",
    email: "",
    phone: "",
    resumeUrl: "",
    status: "new",
    notes: "",
    companyId: user?.companyId,
    jobId: undefined,
    ...candidateData
  };
  
  // Helper function to handle null values in form fields
  const handleNullableString = (value: string | null | undefined): string => {
    return value ?? "";
  };
  
  const form = useForm<CandidateFormValues>({
    resolver: zodResolver(candidateFormSchema),
    defaultValues,
  });
  
  // Create candidate mutation
  const createCandidateMutation = useMutation({
    mutationFn: async (data: CandidateFormValues) => {
      const response = await apiRequest("POST", "/api/candidates", data);
      return response.json();
    },
    onSuccess: (newCandidate) => {
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      toast({
        title: "Candidate created",
        description: "The candidate has been successfully added.",
      });
      
      if (onSuccess) {
        onSuccess(newCandidate);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create candidate",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Update candidate mutation
  const updateCandidateMutation = useMutation({
    mutationFn: async (data: CandidateFormValues) => {
      const response = await apiRequest("PUT", `/api/candidates/${candidateId}`, data);
      return response.json();
    },
    onSuccess: (updatedCandidate) => {
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/candidates", candidateId?.toString()] });
      toast({
        title: "Candidate updated",
        description: "The candidate has been successfully updated.",
      });
      
      if (onSuccess) {
        onSuccess(updatedCandidate);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update candidate",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  function onSubmit(values: CandidateFormValues) {
    // Make sure companyId is always set
    if (!user?.companyId) {
      toast({
        title: "Error",
        description: "Company ID is required",
        variant: "destructive",
      });
      return;
    }
    
    // Process the form values to ensure optional fields are correctly handled
    const submissionData = {
      ...values,
      companyId: user.companyId,
      // Handle empty strings as null for optional fields
      phone: values.phone?.trim() || null,
      resumeUrl: values.resumeUrl?.trim() || null,
      notes: values.notes?.trim() || null,
      // Make sure status is set
      status: values.status || 'new',
      // Keep jobId as is (should be null or a number at this point)
    };
    
    console.log("Submitting candidate data:", submissionData);
    
    if (isEdit && candidateId) {
      updateCandidateMutation.mutate(submissionData);
    } else {
      createCandidateMutation.mutate(submissionData);
    }
  }
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name</FormLabel>
              <FormControl>
                <Input placeholder="Candidate's full name" {...field} />
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
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="Email address" type="email" {...field} />
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
              <FormLabel>Phone (Optional)</FormLabel>
              <FormControl>
                <Input 
                  placeholder="Phone number" 
                  value={handleNullableString(field.value)}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="resumeUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Resume URL (Optional)</FormLabel>
              <FormControl>
                <Input 
                  placeholder="Link to resume" 
                  value={handleNullableString(field.value)}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="jobId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Job (Optional)</FormLabel>
                <Select
                  onValueChange={(value) => {
                    // Convert to integer if it's a job id, or set to null if "none"
                    const newValue = value && value !== "none" ? parseInt(value) : null;
                    console.log("Job selection changed to:", value, "converted to:", newValue);
                    field.onChange(newValue);
                  }}
                  value={field.value?.toString() || "none"}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a job" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">No job selected</SelectItem>
                    {jobs.map((job) => (
                      <SelectItem key={job.id} value={job.id.toString()}>
                        {job.title}
                      </SelectItem>
                    ))}
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
                <Select 
                  onValueChange={field.onChange} 
                  value={field.value || "new"} // Use value instead of defaultValue for controlled component
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="screening">Screening</SelectItem>
                    <SelectItem value="interview">Interview</SelectItem>
                    <SelectItem value="offer">Offer</SelectItem>
                    <SelectItem value="hired">Hired</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (Optional)</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Additional notes about the candidate" 
                  className="min-h-[100px]"
                  value={handleNullableString(field.value)}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <Button 
          type="submit" 
          className="w-full"
          disabled={createCandidateMutation.isPending || updateCandidateMutation.isPending}
        >
          {(createCandidateMutation.isPending || updateCandidateMutation.isPending) ? (
            <span className="flex items-center">
              <span className="mr-2 h-4 w-4 animate-spin border-t-2 border-b-2 border-white rounded-full"></span>
              {isEdit ? "Updating..." : "Creating..."}
            </span>
          ) : (
            isEdit ? "Update Candidate" : "Add Candidate"
          )}
        </Button>
      </form>
    </Form>
  );
}
