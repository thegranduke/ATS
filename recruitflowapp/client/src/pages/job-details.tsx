import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import DashboardSidebar from "@/components/dashboard-sidebar";
import JobForm from "@/components/job-form";
import { Briefcase, Building, Clock, Edit, Link as LinkIcon, MapPin, Trash, Users, Copy, ExternalLink } from "lucide-react";

export default function JobDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [_, navigate] = useLocation();
  const jobId = id ? parseInt(id) : 0;

  // Query for job details
  const {
    data: job,
    isLoading,
    isError,
    error
  } = useQuery({
    queryKey: ["/api/jobs", id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/jobs/${id}`);
      return res.json();
    },
    enabled: !!user && !!id,
  });

  // Query for candidates associated with this job
  const {
    data: candidates = [],
    isLoading: isLoadingCandidates,
    refetch
  } = useQuery<any[]>({
    queryKey: ["/api/candidates"],
    enabled: !!user,
    select: (data) => {
      // Filter candidates for this job
      const jobCandidates = data.filter((candidate: any) => candidate.jobId === jobId);
      
      // Sort by creation date (most recent first)
      return jobCandidates.sort((a: any, b: any) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    }
  });

  // Delete job mutation
  const deleteJobMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/jobs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({
        title: "Job deleted",
        description: "The job has been successfully deleted.",
      });
      navigate("/jobs");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete job",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Get the application link with replit domain or custom domain
  const getApplicationLink = () => {
    if (!job?.applicationLink) return '';
    
    // Use deployed domain if available (RecruitFlow.replit.app) or custom domain
    const productionDomain = 'RecruitFlow.replit.app';
    
    // Check if we're in development or production
    const isDevelopment = window.location.hostname.includes('replit.dev') || 
                           window.location.hostname === 'localhost' ||
                           window.location.hostname.includes('127.0.0.1');
    
    // In development, use the current origin
    // In production, use the production domain
    const baseUrl = isDevelopment ? window.location.origin : `https://${productionDomain}`;
    
    // Return shorter URL: /{job-id}/{random-string} instead of /apply/{random-string}
    return `${baseUrl}/j/${job.id}/${job.applicationLink.substring(0, 8)}`;
  };
  
  // Copy application link to clipboard
  const copyApplicationLink = () => {
    const url = getApplicationLink();
    if (url) {
      navigator.clipboard.writeText(url);
      toast({
        title: "Application link copied",
        description: "The application link has been copied to clipboard.",
      });
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  };

  if (isLoading) {
    return (
      <DashboardSidebar>
        <div className="flex justify-center items-center h-96">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      </DashboardSidebar>
    );
  }

  if (isError) {
    return (
      <DashboardSidebar>
        <div className="px-4 sm:px-6 md:px-8 mt-6 md:mt-16">
          <Card className="bg-destructive/10 border-destructive">
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold text-destructive mb-2">Error loading job details</h2>
              <p className="text-destructive">{error?.message || "Please try again later."}</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => navigate("/jobs")}
              >
                Return to Jobs
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardSidebar>
    );
  }

  return (
    <DashboardSidebar>
      <div className="px-4 sm:px-6 md:px-8 mt-6 md:mt-16">
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 flex items-center">
              {job.title}
              <Badge className="ml-3" variant={job.status === "open" ? "default" : job.status === "closed" ? "destructive" : "secondary"}>
                {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
              </Badge>
            </h2>
            <div className="mt-1 flex flex-col sm:flex-row sm:flex-wrap sm:mt-0 sm:space-x-6">
              <div className="mt-2 flex items-center text-sm text-gray-500">
                <Building className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" />
                {job.department}
              </div>
              <div className="mt-2 flex items-center text-sm text-gray-500">
                <MapPin className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" />
                {job.location}
              </div>
              <div className="mt-2 flex items-center text-sm text-gray-500">
                <Briefcase className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" />
                {job.type.charAt(0).toUpperCase() + job.type.slice(1)}
              </div>
              <div className="mt-2 flex items-center text-sm text-gray-500">
                <Clock className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" />
                Posted on {formatDate(job.createdAt)}
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-shrink-0 md:mt-0 md:ml-4 space-x-2">
            <Button 
              variant="outline" 
              className="inline-flex items-center"
              onClick={() => navigate(`/jobs/${job.id}/edit`)}
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="inline-flex items-center">
                  <Trash className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the job
                    and all associated candidate applications.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => deleteJobMutation.mutate()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleteJobMutation.isPending ? 
                      <span className="flex items-center">
                        <span className="mr-2 h-4 w-4 animate-spin border-t-2 border-b-2 border-white rounded-full"></span>
                        Deleting...
                      </span> 
                      : "Delete"
                    }
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        
        <Tabs defaultValue="details" className="mt-6">
          <TabsList className="mb-4">
            <TabsTrigger value="details">Job Details</TabsTrigger>
            <TabsTrigger value="description">Job Description</TabsTrigger>
            <TabsTrigger value="applications">
              Applications
              {candidates.length > 0 && (
                <Badge variant="secondary" className="ml-2">{candidates.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="promotion">Promotion</TabsTrigger>
          </TabsList>
          
          <TabsContent value="details" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Job Information</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                  <div className="sm:col-span-1">
                    <dt className="text-sm font-medium text-gray-500">Job Title</dt>
                    <dd className="mt-1 text-sm text-gray-900">{job.title}</dd>
                  </div>
                  <div className="sm:col-span-1">
                    <dt className="text-sm font-medium text-gray-500">Status</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      <Badge variant={job.status === "open" ? "default" : job.status === "closed" ? "destructive" : "secondary"}>
                        {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                      </Badge>
                    </dd>
                  </div>
                  <div className="sm:col-span-1">
                    <dt className="text-sm font-medium text-gray-500">Department</dt>
                    <dd className="mt-1 text-sm text-gray-900">{job.department}</dd>
                  </div>
                  <div className="sm:col-span-1">
                    <dt className="text-sm font-medium text-gray-500">Location</dt>
                    <dd className="mt-1 text-sm text-gray-900">{job.location}</dd>
                  </div>
                  <div className="sm:col-span-1">
                    <dt className="text-sm font-medium text-gray-500">Job Type</dt>
                    <dd className="mt-1 text-sm text-gray-900">{job.type.charAt(0).toUpperCase() + job.type.slice(1)}</dd>
                  </div>
                  <div className="sm:col-span-1">
                    <dt className="text-sm font-medium text-gray-500">Posted Date</dt>
                    <dd className="mt-1 text-sm text-gray-900">{formatDate(job.createdAt)}</dd>
                  </div>
                  <div className="sm:col-span-1">
                    <dt className="text-sm font-medium text-gray-500">Applications</dt>
                    <dd className="mt-1 text-sm text-gray-900 flex items-center">
                      <Users className="mr-1 h-4 w-4 text-gray-400" />
                      {isLoadingCandidates ? 
                        <span className="h-4 w-4 animate-spin border-t-2 border-b-2 border-gray-500 rounded-full"></span> 
                        : candidates.length
                      }
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
            
            {job.requirements && (
              <Card>
                <CardHeader>
                  <CardTitle>Requirements</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose max-w-none">
                    <p className="whitespace-pre-line">{job.requirements}</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="description">
            <Card>
              <CardHeader>
                <CardTitle>Job Description</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose max-w-none">
                  <div dangerouslySetInnerHTML={{ __html: job.description }} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="applications">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Applications</CardTitle>
                <Button size="sm" onClick={() => navigate(`/candidates?jobId=${jobId}`)}>
                  View All
                </Button>
              </CardHeader>
              <CardContent>
                {isLoadingCandidates ? (
                  <div className="flex justify-center py-8">
                    <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  </div>
                ) : candidates.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Name
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Applied
                          </th>
                          <th scope="col" className="relative px-6 py-3">
                            <span className="sr-only">View</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {candidates.map((candidate: any) => (
                          <tr key={candidate.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-10 w-10">
                                  <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary font-medium">
                                    {candidate.fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                                  </div>
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-gray-900">
                                    {candidate.fullName}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {candidate.email}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Select
                                defaultValue={candidate.status}
                                onValueChange={(value) => {
                                  // Create the mutation to update the candidate status
                                  fetch(`/api/candidates/${candidate.id}/status`, {
                                    method: 'PATCH',
                                    headers: {
                                      'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify({ status: value }),
                                  })
                                    .then(res => {
                                      if (res.ok) {
                                        // Refresh the list of candidates
                                        refetch();
                                        
                                        // Show success toast
                                        toast({
                                          title: "Status updated",
                                          description: `Candidate status changed to ${value.charAt(0).toUpperCase() + value.slice(1)}`,
                                          variant: "default",
                                        });
                                      } else {
                                        // Show error toast
                                        toast({
                                          title: "Error",
                                          description: "Failed to update candidate status",
                                          variant: "destructive",
                                        });
                                      }
                                    })
                                    .catch(err => {
                                      console.error("Error updating candidate status:", err);
                                      toast({
                                        title: "Error",
                                        description: "Failed to update candidate status",
                                        variant: "destructive",
                                      });
                                    });
                                }}
                              >
                                <SelectTrigger className="w-[140px]">
                                  <SelectValue>
                                    <div className="flex items-center">
                                      <Badge variant={
                                        candidate.status === "new" ? "default" :
                                        candidate.status === "screening" ? "secondary" :
                                        candidate.status === "interview" ? "secondary" :
                                        candidate.status === "offer" ? "secondary" :
                                        candidate.status === "hired" ? "default" :
                                        "destructive"
                                      }>
                                        {candidate.status.charAt(0).toUpperCase() + candidate.status.slice(1)}
                                      </Badge>
                                    </div>
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="new">
                                    <Badge variant="default">New</Badge>
                                  </SelectItem>
                                  <SelectItem value="screening">
                                    <Badge variant="secondary">Screening</Badge>
                                  </SelectItem>
                                  <SelectItem value="interview">
                                    <Badge variant="secondary">Interview</Badge>
                                  </SelectItem>
                                  <SelectItem value="offer">
                                    <Badge variant="secondary">Offer</Badge>
                                  </SelectItem>
                                  <SelectItem value="hired">
                                    <Badge variant="default">Hired</Badge>
                                  </SelectItem>
                                  <SelectItem value="rejected">
                                    <Badge variant="destructive">Rejected</Badge>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatDate(candidate.createdAt)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(`/candidates/${candidate.id}`)}
                              >
                                View
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No applications have been submitted for this job yet.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="promotion">
            <Card>
              <CardHeader>
                <CardTitle>Promotion</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-2">Application Link</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Share this unique link for candidates to apply directly to this job.
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="bg-gray-100 p-2 px-3 rounded flex-1 flex items-center overflow-hidden">
                      <LinkIcon className="mr-2 h-4 w-4 text-gray-400 flex-shrink-0" />
                      <span className="truncate text-sm">{getApplicationLink()}</span>
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="icon" onClick={copyApplicationLink}>
                            <Copy className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Copy link</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={() => window.open(getApplicationLink(), '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <h3 className="text-lg font-medium mb-2">Promotion Tips</h3>
                  <ul className="list-disc pl-5 space-y-2">
                    <li className="text-sm text-gray-700">Share the application link on job boards like Indeed, LinkedIn, and Glassdoor</li>
                    <li className="text-sm text-gray-700">Post the job opening on your company's social media channels</li>
                    <li className="text-sm text-gray-700">Include the link in email campaigns to potential candidates</li>
                    <li className="text-sm text-gray-700">Add the position to your company website's careers page</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardSidebar>
  );
}
