import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import DashboardSidebar from "@/components/dashboard-sidebar";
import CandidateForm from "@/components/candidate-form";
import { 
  Plus, 
  Search, 
  Filter, 
  ChevronDown, 
  ArrowUpRight, 
  Pencil, 
  Trash2,
  Mail,
  Phone
} from "lucide-react";
import { Candidate } from "@shared/schema";
import { cn } from "@/lib/utils";

export default function Candidates() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [_, navigate] = useLocation();
  const [openCandidateDialog, setOpenCandidateDialog] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [localCandidates, setLocalCandidates] = useState<Candidate[]>([]);
  const [filters, setFilters] = useState({
    status: "",
    jobId: "",
    appliedAfter: ""
  });

  // Parse URL query parameters
  const urlParams = new URLSearchParams(window.location.search);
  const jobIdParam = urlParams.get("jobId");

  // Set initial jobId filter if provided in URL
  useEffect(() => {
    if (jobIdParam && filters.jobId === "") {
      setFilters({ ...filters, jobId: jobIdParam });
    }
  }, [jobIdParam]);

  // Query for candidates
  const { 
    data: serverCandidates = [] as Candidate[],
    isLoading: isLoadingCandidates,
    refetch: refetchCandidates
  } = useQuery<Candidate[]>({
    queryKey: ["/api/candidates"],
    enabled: !!user,
  });

  // Query for jobs (for filtering)
  const { 
    data: jobs = [] as any[],
    isLoading: isLoadingJobs
  } = useQuery<any[]>({
    queryKey: ["/api/jobs"],
    enabled: !!user,
  });

  // Update local state when server data changes
  useEffect(() => {
    setLocalCandidates(serverCandidates);
  }, [serverCandidates]);

  // Delete candidate mutation
  const deleteCandidateMutation = useMutation({
    mutationFn: async (candidateId: number) => {
      // First update local state for optimistic UI update
      setLocalCandidates(prevCandidates => prevCandidates.filter(candidate => candidate.id !== candidateId));

      const response = await apiRequest("DELETE", `/api/candidates/${candidateId}`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to delete candidate");
      }
      return candidateId;
    },
    onSuccess: (candidateId: number) => {
      toast({
        title: "Candidate deleted",
        description: "The candidate was successfully deleted",
        variant: "default",
      });

      // Also update the candidates list in the cache
      queryClient.setQueryData(["/api/candidates"], (oldData: Candidate[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.filter(candidate => candidate.id !== candidateId);
      });

      // Quietly refetch in the background
      queryClient.invalidateQueries({ 
        queryKey: ["/api/candidates"],
        refetchType: 'none' // Don't automatically refetch
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete candidate",
        variant: "destructive",
      });

      // Restore original data from the server
      refetchCandidates().then(({ data }) => {
        if (data) {
          setLocalCandidates(data);
        }
      });
    }
  });

  // Update candidate status mutation
  const updateCandidateStatusMutation = useMutation({
    mutationFn: async ({ candidateId, status }: { candidateId: number; status: string }) => {
      // First update the status locally for instant UI update
      setLocalCandidates(prevCandidates => 
        prevCandidates.map(candidate => 
          candidate.id === candidateId ? { ...candidate, status } : candidate
        )
      );

      const response = await apiRequest("PATCH", `/api/candidates/${candidateId}/status`, { status });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to update candidate status");
      }
      return { candidateId, status };
    },
    onSuccess: ({ candidateId, status }) => {
      toast({
        title: "Status updated",
        description: `Candidate status updated to ${status}`,
        variant: "default",
      });

      // Also update the query cache
      queryClient.setQueryData(["/api/candidates"], (oldData: Candidate[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.map(candidate => 
          candidate.id === candidateId ? { ...candidate, status } : candidate
        );
      });

      // Quietly refetch in the background to ensure sync with server
      queryClient.invalidateQueries({ 
        queryKey: ["/api/candidates"],
        refetchType: 'none' // Don't automatically refetch
      });
    },
    onError: (error: Error, variables) => {
      const { candidateId } = variables;
      toast({
        title: "Error",
        description: error.message || "Failed to update candidate status",
        variant: "destructive",
      });

      // Restore original data from the server
      refetchCandidates().then(({ data }) => {
        if (data) {
          setLocalCandidates(data);
        }
      });
    }
  });

  // Handle candidate deletion
  const deleteCandidate = (candidateId: number) => {
    if(confirm('Are you sure you want to delete this candidate?')) {
      deleteCandidateMutation.mutate(candidateId);
    }
  };

  // Handle form submission success
  const handleCandidateCreated = (newCandidate: Candidate) => {
    // Immediately update local state
    setLocalCandidates(prevCandidates => [...prevCandidates, newCandidate]);

    // Also update the query cache
    queryClient.setQueryData(["/api/candidates"], (oldData: Candidate[] | undefined) => {
      if (!oldData) return [newCandidate];
      return [...oldData, newCandidate];
    });

    setOpenCandidateDialog(false);
    toast({
      title: "Candidate added",
      description: "The candidate has been successfully added",
    });
  };

  // Filter candidates based on the current filter values and search
  const filteredCandidates = localCandidates.filter((candidate: Candidate) => {
    // Filter by search value
    if (searchValue) {
      const searchLower = searchValue.toLowerCase();
      if (
        !(candidate.fullName?.toLowerCase().includes(searchLower) ||
        candidate.email?.toLowerCase().includes(searchLower) ||
        (candidate.notes && candidate.notes.toLowerCase().includes(searchLower)))
      ) {
        return false;
      }
    }

    // Filter by status if selected (ignore all_statuses as it means show all)
    if (filters.status && filters.status !== "all_statuses" && candidate.status !== filters.status) {
      return false;
    }

    // Filter by job if selected (ignore all_jobs as it means show all)
    if (filters.jobId && filters.jobId !== "all_jobs" && candidate.jobId !== parseInt(filters.jobId)) {
      return false;
    }

    // Filter by application date if selected
    if (filters.appliedAfter) {
      const filterDate = new Date(filters.appliedAfter);
      const candidateDate = new Date(candidate.createdAt);
      if (candidateDate < filterDate) {
        return false;
      }
    }

    return true;
  });

  // Calculate unique filter options
  const statusSet = new Set<string>();
  localCandidates.forEach((candidate: Candidate) => {
    if (candidate.status) statusSet.add(candidate.status);
  });
  const statuses = Array.from(statusSet);

  // Format date for display
  const formatDate = (dateInput: Date | string) => {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  };

  // Get job title by id
  const getJobTitle = (jobId: number) => {
    const job = jobs.find((job: any) => job.id === jobId);
    return job ? job.title : "Unknown Position";
  };

  // Status badge variants
  const getStatusColor = (status: string) => {
    switch (status) {
      case "new":
        return "bg-blue-100 text-blue-800";
      case "screening":
        return "bg-purple-100 text-purple-800";
      case "interview":
        return "bg-yellow-100 text-yellow-800";
      case "offer":
        return "bg-orange-100 text-orange-800";
      case "hired":
        return "bg-green-100 text-green-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Available candidate statuses
  const candidateStatuses = [
    "new",
    "screening",
    "interview",
    "offer",
    "hired",
    "rejected"
  ];

  return (
    <DashboardSidebar>
      <div className="px-4 py-6 sm:px-6 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Candidates</h1>
          <Dialog open={openCandidateDialog} onOpenChange={setOpenCandidateDialog}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-primary flex items-center gap-1.5">
                <Plus className="h-4 w-4" /> Create Candidate
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Create New Candidate</DialogTitle>
                <DialogDescription>
                  Add a new candidate to your recruitment pipeline.
                </DialogDescription>
              </DialogHeader>
              <CandidateForm onSuccess={handleCandidateCreated} jobs={jobs} />
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
                placeholder="Search candidates..."
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

          {/* Filters */}
          {showFilters && (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <Select
                  value={filters.status}
                  onValueChange={(value) => setFilters({...filters, status: value})}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_statuses">All Statuses</SelectItem>
                    {statuses.map((status: string) => (
                      <SelectItem key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Job Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Job</label>
                <Select
                  value={filters.jobId}
                  onValueChange={(value) => setFilters({...filters, jobId: value})}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Jobs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_jobs">All Jobs</SelectItem>
                    {jobs.map((job: any) => (
                      <SelectItem key={job.id} value={job.id.toString()}>
                        {job.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Applied After</label>
                <Input
                  type="date"
                  value={filters.appliedAfter}
                  onChange={(e) => setFilters({...filters, appliedAfter: e.target.value})}
                />
              </div>
            </div>
          )}
        </div>

        {/* Candidates Table */}
        <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
          {isLoadingCandidates || isLoadingJobs ? (
            <div className="py-12 flex justify-center">
              <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : filteredCandidates.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Status
                    </th>
                    <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Name
                    </th>
                    <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Contact
                    </th>
                    <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Job
                    </th>
                    <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Applied
                    </th>
                    <th scope="col" className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredCandidates.map((candidate: Candidate) => (
                    <tr key={candidate.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="relative">
                          <select
                            value={candidate.status}
                            onChange={(e) => {
                              const newStatus = e.target.value;
                              updateCandidateStatusMutation.mutate({ 
                                candidateId: candidate.id, 
                                status: newStatus 
                              });
                            }}
                            className={cn(
                              "pl-2 pr-6 py-1 text-xs font-medium rounded border-0 cursor-pointer appearance-none",
                              getStatusColor(candidate.status)
                            )}
                          >
                            {candidateStatuses.map((status) => (
                              <option key={status} value={status}>
                                {status.charAt(0).toUpperCase() + status.slice(1)}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="h-3 w-3 absolute right-1 top-1/2 transform -translate-y-1/2 pointer-events-none" />
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        <div className="flex items-center">
                          {/* Removed initials display */}
                          <div className="ml-3">
                            <a 
                              href={`/candidates/${candidate.id}`} 
                              className="hover:text-primary hover:underline"
                            >
                              {candidate.fullName}
                            </a>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex flex-col">
                          <div className="flex items-center">
                            <Mail className="h-3 w-3 mr-1 text-gray-400" />
                            <span>{candidate.email}</span>
                          </div>
                          {candidate.phone && (
                            <div className="flex items-center mt-1">
                              <Phone className="h-3 w-3 mr-1 text-gray-400" />
                              <span>{candidate.phone}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {candidate.jobId ? getJobTitle(candidate.jobId) : "Not specified"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(candidate.createdAt)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex gap-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-gray-500 hover:text-primary"
                                  onClick={() => navigate(`/candidates/${candidate.id}`)}
                                >
                                  <ArrowUpRight className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>View candidate</p>
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
                                  onClick={() => navigate(`/candidates/${candidate.id}/edit`)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Edit candidate</p>
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
                                  onClick={() => deleteCandidate(candidate.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Delete candidate</p>
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
            <div className="py-8 text-center text-gray-500">
              No candidates found matching your search criteria. Try adjusting your filters or add a new candidate.
            </div>
          )}
        </div>
      </div>
    </DashboardSidebar>
  );
}