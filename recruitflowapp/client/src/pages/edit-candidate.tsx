import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import DashboardSidebar from "@/components/dashboard-sidebar";
import CandidateForm from "@/components/candidate-form";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Candidate, Job } from "@shared/schema";

export default function EditCandidate() {
  const { id } = useParams<{ id: string }>();
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const candidateId = parseInt(id);
  
  // Query for candidate data
  const {
    data: candidate,
    isLoading: isLoadingCandidate,
    error: candidateError
  } = useQuery<Candidate>({
    queryKey: [`/api/candidates/${candidateId}`],
    enabled: !!candidateId && !!user,
  });
  
  // Query for jobs (for the form)
  const {
    data: jobs = [] as Job[],
    isLoading: isLoadingJobs
  } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
    enabled: !!user,
  });
  
  // Handle form submission success
  const handleSuccess = () => {
    toast({
      title: "Candidate updated",
      description: "The candidate has been successfully updated.",
    });
    navigate("/candidates");
  };
  
  // If there's an error fetching the candidate
  if (candidateError) {
    return (
      <DashboardSidebar>
        <div className="container mx-auto py-6 max-w-4xl">
          <div className="flex items-center mb-6">
            <Button
              variant="ghost"
              size="sm"
              className="mr-4"
              onClick={() => navigate("/candidates")}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <h1 className="text-2xl font-bold">Edit Candidate</h1>
          </div>
          
          <div className="bg-red-50 border border-red-200 p-4 rounded-md text-red-800">
            Error loading candidate data. Please try again later.
          </div>
        </div>
      </DashboardSidebar>
    );
  }
  
  return (
    <DashboardSidebar>
      <div className="container mx-auto py-6 max-w-4xl">
        <div className="flex items-center mb-6">
          <Button
            variant="ghost"
            size="sm"
            className="mr-4"
            onClick={() => navigate("/candidates")}
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          
          {isLoadingCandidate ? (
            <Skeleton className="h-8 w-48" />
          ) : (
            <h1 className="text-2xl font-bold">
              Edit {candidate ? candidate.fullName : "Candidate"}
            </h1>
          )}
        </div>
        
        <div className="bg-white rounded-lg shadow">
          <Tabs defaultValue="details" className="p-6">
            <TabsList className="mb-6 border-b w-full justify-start rounded-none h-auto p-0 bg-transparent">
              <TabsTrigger 
                value="details" 
                className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none py-2 px-4 text-sm font-medium data-[state=active]:text-primary text-gray-600"
              >
                Candidate Details
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="details">
              {isLoadingCandidate || isLoadingJobs ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <CandidateForm 
                  candidateData={candidate} 
                  isEdit={true} 
                  candidateId={candidateId} 
                  jobs={jobs}
                  onSuccess={handleSuccess}
                />
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </DashboardSidebar>
  );
}