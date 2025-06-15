import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { apiRequest, queryClient } from "@/lib/queryClient";
import DashboardSidebar from "@/components/dashboard-sidebar";
import SimpleJobForm from "@/components/simple-job-form";
import { 
  Plus, 
  Search, 
  Pencil, 
  Trash2, 
  Filter,
  ChevronDown,
  ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Job, jobStatusValues, Location } from "@shared/schema";

export default function JobManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [_, navigate] = useLocation();
  const [openJobDialog, setOpenJobDialog] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [localJobs, setLocalJobs] = useState<Job[]>([]);
  
  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>("all_statuses");
  const [typeFilter, setTypeFilter] = useState<string>("all_types");
  const [experienceFilter, setExperienceFilter] = useState<string>("all_experience");
  const [dateRangeFilter, setDateRangeFilter] = useState<string>("all_time");
  
  // Query for jobs
  const { 
    data: jobsResponse,
    isLoading,
    refetch
  } = useQuery<{jobs: Job[], pagination: any}>({
    queryKey: ["/api/jobs"],
    enabled: !!user,
  });
  
  const serverJobs = jobsResponse?.jobs || [] as Job[];
  
  // Query for locations
  const { 
    data: locations = [] as Location[],
    isLoading: isLoadingLocations
  } = useQuery<Location[]>({
    queryKey: ["/api/company/locations"],
    queryFn: () => apiRequest("GET", "/api/company/locations", undefined).then(res => res.json()),
    enabled: !!user,
  });
  
  // Get location name by ID function
  const getLocationName = (locationId: number | null): string => {
    if (!locationId) return 'Remote';
    const location = locations.find(loc => loc.id === locationId);
    return location ? `${location.name} - ${location.city}, ${location.state}` : 'Remote';
  };
  
  // Update local state when server data changes
  useEffect(() => {
    setLocalJobs(serverJobs);
  }, [serverJobs]);
  
  // Update job status mutation
  const updateJobStatusMutation = useMutation({
    mutationFn: async ({ jobId, status }: { jobId: number; status: string }) => {
      // First update the status locally for instant UI update
      setLocalJobs(prevJobs => 
        prevJobs.map(job => 
          job.id === jobId ? { ...job, status } : job
        )
      );
      
      const response = await apiRequest("PATCH", `/api/jobs/${jobId}/status`, { status });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to update job status");
      }
      return { jobId, status };
    },
    onSuccess: ({ jobId, status }) => {
      toast({
        title: "Status updated",
        description: `Job status updated to ${status}`,
        variant: "default",
      });
      
      // Also update the query cache
      queryClient.setQueryData(["/api/jobs"], (oldData: {jobs: Job[], pagination: any} | undefined) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          jobs: oldData.jobs.map(job => 
            job.id === jobId ? { ...job, status } : job
          )
        };
      });
      
      // Quietly refetch in the background to ensure sync with server
      queryClient.invalidateQueries({ 
        queryKey: ["/api/jobs"],
        refetchType: 'none' // Don't automatically refetch
      });
    },
    onError: (error: Error, variables) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update job status",
        variant: "destructive",
      });
      
      // Restore original jobs data from the server on error
      refetch().then(({ data }) => {
        if (data?.jobs) {
          setLocalJobs(data.jobs);
        }
      });
    }
  });
  
  // Delete job mutation
  const deleteJobMutation = useMutation({
    mutationFn: async (jobId: number) => {
      // First update local state for optimistic UI update
      setLocalJobs(prevJobs => prevJobs.filter(job => job.id !== jobId));
      
      const response = await apiRequest("DELETE", `/api/jobs/${jobId}`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to delete job");
      }
      return jobId;
    },
    onSuccess: (jobId: number) => {
      toast({
        title: "Job deleted",
        description: "The job was successfully deleted",
        variant: "default",
      });
      
      // Also update the jobs list in the cache
      queryClient.setQueryData(["/api/jobs"], (oldData: Job[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.filter(job => job.id !== jobId);
      });
      
      // Quietly refetch in the background
      queryClient.invalidateQueries({ 
        queryKey: ["/api/jobs"],
        refetchType: 'none' // Don't automatically refetch
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete job",
        variant: "destructive",
      });
      
      // Restore original data from the server
      refetch().then(({ data }) => {
        if (data) {
          setLocalJobs(data);
        }
      });
    }
  });
  
  // Handle job deletion
  const deleteJob = (jobId: number) => {
    if(confirm('Are you sure you want to delete this job?')) {
      deleteJobMutation.mutate(jobId);
    }
  };
  
  // Handle form submission success
  const handleJobCreated = (newJob: Job) => {
    // Immediately update local state
    setLocalJobs(prevJobs => [...prevJobs, newJob]);
    
    // Also update the query cache
    queryClient.setQueryData(["/api/jobs"], (oldData: Job[] | undefined) => {
      if (!oldData) return [newJob];
      return [...oldData, newJob];
    });
    
    setOpenJobDialog(false);
  };
  
  // Filter options
  const jobTypeOptions = ["full-time", "part-time", "contract", "internship", "remote"];
  const experienceOptions = ["1+ years", "2+ years", "5+ years", "10+ years", "entry-level", "mid-level", "senior-level"];
  const dateRangeOptions = [
    { label: "All time", value: "all_time" },
    { label: "Last 24 hours", value: "24h" },
    { label: "Last 7 days", value: "7d" },
    { label: "Last 30 days", value: "30d" },
    { label: "Last 90 days", value: "90d" }
  ];
  
  // Helper for date filtering
  const isWithinDateRange = (dateStr: string | Date, rangeType: string): boolean => {
    if (!rangeType || rangeType === "all_time") return true; // No filter set or all time selected
    
    const jobDate = new Date(dateStr);
    const now = new Date();
    
    switch (rangeType) {
      case "24h":
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        return jobDate >= oneDayAgo;
      case "7d":
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return jobDate >= sevenDaysAgo;
      case "30d":
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return jobDate >= thirtyDaysAgo;
      case "90d":
        const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        return jobDate >= ninetyDaysAgo;
      default:
        return true;
    }
  };
  
  // Format date
  const formatDate = (dateInput: Date | string) => {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  };
  
  // Get the experience requirement from the job
  const getExperience = (job: Job) => {
    if (job.experience) return job.experience;
    
    // Fallback if experience field is not set
    const titleLower = job.title.toLowerCase();
    if (titleLower.includes('senior') || titleLower.includes('lead')) {
      return '5+ years';
    } else if (titleLower.includes('mid') || titleLower.includes('agent')) {
      return '2+ years';
    } else {
      return '1+ years';
    }
  };
  
  // Reset all filters
  const resetFilters = () => {
    setStatusFilter("all_statuses");
    setTypeFilter("all_types");
    setExperienceFilter("all_experience");
    setDateRangeFilter("all_time");
    setSearchValue("");
  };
  
  // Filter jobs based on all criteria
  const filteredJobs = localJobs.filter((job: Job) => {
    // Text search filter
    if (searchValue) {
      const searchLower = searchValue.toLowerCase();
      // Get location name for search
      const locationName = getLocationName(job.locationId);
      const matchesSearch = (
        job.title.toLowerCase().includes(searchLower) ||
        job.department.toLowerCase().includes(searchLower) ||
        locationName.toLowerCase().includes(searchLower)
      );
      if (!matchesSearch) return false;
    }
    
    // Status filter
    if (statusFilter && statusFilter !== "all_statuses" && job.status !== statusFilter) {
      return false;
    }
    
    // Type filter
    if (typeFilter && typeFilter !== "all_types" && job.type !== typeFilter) {
      return false;
    }
    
    // Experience filter
    if (experienceFilter && experienceFilter !== "all_experience") {
      const jobExperience = getExperience(job);
      if (jobExperience !== experienceFilter) {
        return false;
      }
    }
    
    // Date range filter
    if (dateRangeFilter && dateRangeFilter !== "all_time" && !isWithinDateRange(job.createdAt, dateRangeFilter)) {
      return false;
    }
    
    return true;
  });
  
  return (
    <DashboardSidebar>
      <div className="px-4 py-6 sm:px-6 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
          <Dialog open={openJobDialog} onOpenChange={setOpenJobDialog}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-primary flex items-center gap-1.5">
                <Plus className="h-4 w-4" /> Create Job
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Create New Job</DialogTitle>
                <DialogDescription>
                  Add a new job posting to your recruitment pipeline.
                </DialogDescription>
              </DialogHeader>
              <SimpleJobForm onSuccess={handleJobCreated} />
            </DialogContent>
          </Dialog>
        </div>
        
        {/* Search and Filter */}
        <div className="bg-white rounded-lg p-4 mb-6 border border-gray-100">
          <h2 className="text-base font-medium mb-3">Search and Filter</h2>
          <div className="flex gap-3 items-center">
            <div className="relative flex-grow">
              <Input
                type="text"
                placeholder="Search jobs..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="pl-10 h-10"
              />
              <Search className="h-4 w-4 text-gray-400 absolute left-3 top-3" />
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-10 gap-1"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4" /> Filters <ChevronDown className="h-3 w-3" />
            </Button>
          </div>
          
          {/* Filters (hidden by default) */}
          {showFilters && (
            <div className="mt-3 space-y-4">
              {/* Filter dropdowns grid */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                {/* Status filter */}
                <div>
                  <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    id="status-filter"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm"
                  >
                    <option value="all_statuses">All statuses</option>
                    {jobStatusValues.map((status) => (
                      <option key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Job type filter */}
                <div>
                  <label htmlFor="type-filter" className="block text-sm font-medium text-gray-700 mb-1">
                    Job Type
                  </label>
                  <select
                    id="type-filter"
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm"
                  >
                    <option value="all_types">All types</option>
                    {jobTypeOptions.map((type) => (
                      <option key={type} value={type}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Experience filter */}
                <div>
                  <label htmlFor="experience-filter" className="block text-sm font-medium text-gray-700 mb-1">
                    Experience
                  </label>
                  <select
                    id="experience-filter"
                    value={experienceFilter}
                    onChange={(e) => setExperienceFilter(e.target.value)}
                    className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm"
                  >
                    <option value="all_experience">All experience levels</option>
                    {experienceOptions.map((exp) => (
                      <option key={exp} value={exp}>
                        {exp}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Date filter */}
                <div>
                  <label htmlFor="date-filter" className="block text-sm font-medium text-gray-700 mb-1">
                    Date Posted
                  </label>
                  <select
                    id="date-filter"
                    value={dateRangeFilter}
                    onChange={(e) => setDateRangeFilter(e.target.value)}
                    className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm"
                  >
                    {dateRangeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              {/* Reset filters button */}
              <div className="flex justify-end">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={resetFilters}
                >
                  Reset Filters
                </Button>
              </div>
            </div>
          )}
        </div>
        
        {/* Jobs Table */}
        <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
          {isLoading ? (
            <div className="py-12 flex justify-center">
              <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : filteredJobs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Status
                    </th>
                    <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Title
                    </th>
                    <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Location
                    </th>
                    <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Type
                    </th>
                    <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Experience
                    </th>
                    <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Created
                    </th>
                    <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredJobs.map((job: Job) => (
                    <tr key={job.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="relative">
                          <select
                            value={job.status}
                            onChange={(e) => {
                              const newStatus = e.target.value;
                              updateJobStatusMutation.mutate({ jobId: job.id, status: newStatus });
                            }}
                            className={cn(
                              "pl-2 pr-6 py-1 text-xs font-medium rounded border-0 cursor-pointer appearance-none",
                              job.status === "active" ? "bg-green-100 text-green-800" : 
                              job.status === "draft" ? "bg-yellow-100 text-yellow-800" : 
                              job.status === "closed" ? "bg-gray-100 text-gray-800" : 
                              "bg-red-100 text-red-800"
                            )}
                          >
                            {jobStatusValues.map((status) => (
                              <option key={status} value={status}>
                                {status.charAt(0).toUpperCase() + status.slice(1)}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="h-3 w-3 absolute right-1 top-1/2 transform -translate-y-1/2 pointer-events-none" />
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                        <button 
                          onClick={() => navigate(`/jobs/${job.id}`)}
                          className="text-gray-900 hover:text-primary hover:underline text-left"
                        >
                          {job.title}
                        </button>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {getLocationName(job.locationId)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {job.type}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {getExperience(job)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(job.createdAt)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex gap-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-green-500 hover:text-green-600"
                                  onClick={() => window.open(`/apply/${job.applicationLink}`, '_blank')}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>View job application page</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-gray-500 hover:text-primary"
                                  onClick={() => navigate(`/jobs/${job.id}/edit`)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Edit job</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-gray-500 hover:text-red-600"
                                  onClick={() => deleteJob(job.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Delete job</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-gray-500">
              No jobs found matching your filters. Try adjusting your search criteria or create a new job.
            </div>
          )}
        </div>
      </div>
    </DashboardSidebar>
  );
}