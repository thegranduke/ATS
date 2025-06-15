import React, { useState, useRef, useEffect } from "react";
import { 
  Dialog, 
  DialogContent,
  DialogHeader,
  DialogTitle 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Search, 
  Briefcase, 
  User, 
  Loader2,
  XCircle
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/hooks/use-debounce";
import { Job, Candidate } from "@shared/schema";

type SearchResult = {
  jobs: Job[];
  candidates: Candidate[];
  loading: boolean;
  error: string | null;
};

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "jobs" | "candidates">("all");
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [, navigate] = useLocation();

  // Focus on input when dialog opens
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [open]);

  // Search API call
  const { data, isLoading, error } = useQuery<SearchResult>({
    queryKey: ["search", debouncedSearchQuery],
    queryFn: async () => {
      if (!debouncedSearchQuery || debouncedSearchQuery.length < 2) {
        return { jobs: [], candidates: [], loading: false, error: null };
      }
      
      const response = await fetch(`/api/search?q=${encodeURIComponent(debouncedSearchQuery)}`);
      if (!response.ok) {
        throw new Error('Search failed');
      }
      return await response.json();
    },
    enabled: debouncedSearchQuery.length >= 2,
    staleTime: 30000, // Cache results for 30 seconds
  });

  // Filter results based on active tab
  const filteredResults = {
    jobs: data?.jobs || [],
    candidates: data?.candidates || [],
  };

  // Handle navigation to item
  const navigateToItem = (type: 'job' | 'candidate', id: number) => {
    setOpen(false);
    navigate(`/${type}s/${id}`);
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K or Command+K to open search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
      
      // Escape to close
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  return (
    <>
      {/* Search icon in top navigation */}
      <div className="relative">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={() => setOpen(true)} 
                className="flex items-center text-gray-500 hover:text-primary transition-colors"
                aria-label="Search"
              >
                <Search className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <div className="flex items-center gap-2">
                <span>Search</span>
                <kbd className="px-1.5 py-0.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-md">
                  Ctrl K
                </kbd>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Search Dialog/Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-center">Global Search</DialogTitle>
          </DialogHeader>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <Input
              ref={inputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search jobs and candidates..."
              className="pl-10 pr-10"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <XCircle size={18} />
              </button>
            )}
          </div>

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="mt-2">
            <TabsList className="grid grid-cols-3 mb-4">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="jobs">Jobs</TabsTrigger>
              <TabsTrigger value="candidates">Candidates</TabsTrigger>
            </TabsList>

            <div className="min-h-[300px]">
              {/* Loading State */}
              {isLoading && (
                <div className="space-y-4 py-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              )}

              {/* Error State */}
              {error && (
                <div className="flex flex-col items-center justify-center h-[300px] text-center">
                  <XCircle className="h-12 w-12 text-destructive mb-4" />
                  <p className="text-lg font-medium">An error occurred</p>
                  <p className="text-gray-500">Please try again later</p>
                </div>
              )}

              {/* Empty Results */}
              {!isLoading && !error && debouncedSearchQuery.length >= 2 && 
                filteredResults.jobs.length === 0 && 
                filteredResults.candidates.length === 0 && (
                <div className="flex flex-col items-center justify-center h-[300px] text-center">
                  <Search className="h-12 w-12 text-gray-300 mb-4" />
                  <p className="text-lg font-medium">No results found</p>
                  <p className="text-gray-500">Try a different search term</p>
                </div>
              )}

              {/* Empty State - No Search */}
              {!isLoading && !error && debouncedSearchQuery.length < 2 && (
                <div className="flex flex-col items-center justify-center h-[300px] text-center">
                  <Search className="h-12 w-12 text-gray-300 mb-4" />
                  <p className="text-lg font-medium">Start typing to search</p>
                  <p className="text-gray-500">Search for jobs and candidates</p>
                </div>
              )}

              {/* Results */}
              {!isLoading && !error && debouncedSearchQuery.length >= 2 && (
                (filteredResults.jobs.length > 0 || filteredResults.candidates.length > 0) && (
                  <TabsContent value="all" className="space-y-6">
                    {/* Jobs Section */}
                    {filteredResults.jobs.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 mb-2">Jobs</h3>
                        <div className="space-y-2">
                          {filteredResults.jobs.map((job) => (
                            <div 
                              key={job.id}
                              onClick={() => navigateToItem('job', job.id)}
                              className="flex items-center p-3 rounded-md border hover:bg-gray-50 cursor-pointer transition-colors"
                            >
                              <Briefcase className="h-5 w-5 text-gray-400 mr-3 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{job.title}</p>
                                <p className="text-sm text-gray-500 truncate">
                                  {job.location} • {job.status}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Candidates Section */}
                    {filteredResults.candidates.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 mb-2">Candidates</h3>
                        <div className="space-y-2">
                          {filteredResults.candidates.map((candidate) => (
                            <div 
                              key={candidate.id}
                              onClick={() => navigateToItem('candidate', candidate.id)}
                              className="flex items-center p-3 rounded-md border hover:bg-gray-50 cursor-pointer transition-colors"
                            >
                              <User className="h-5 w-5 text-gray-400 mr-3 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{candidate.fullName}</p>
                                <p className="text-sm text-gray-500 truncate">
                                  {candidate.email} • {candidate.status}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </TabsContent>
                )
              )}

              {/* Jobs Tab */}
              <TabsContent value="jobs" className="space-y-2">
                {!isLoading && !error && filteredResults.jobs.length > 0 ? (
                  filteredResults.jobs.map((job) => (
                    <div 
                      key={job.id}
                      onClick={() => navigateToItem('job', job.id)}
                      className="flex items-center p-3 rounded-md border hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <Briefcase className="h-5 w-5 text-gray-400 mr-3 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{job.title}</p>
                        <p className="text-sm text-gray-500 truncate">
                          {job.location} • {job.status}
                        </p>
                      </div>
                    </div>
                  ))
                ) : !isLoading && debouncedSearchQuery.length >= 2 ? (
                  <div className="flex flex-col items-center justify-center h-[300px] text-center">
                    <Search className="h-12 w-12 text-gray-300 mb-4" />
                    <p className="text-lg font-medium">No jobs found</p>
                    <p className="text-gray-500">Try a different search term</p>
                  </div>
                ) : null}
              </TabsContent>

              {/* Candidates Tab */}
              <TabsContent value="candidates" className="space-y-2">
                {!isLoading && !error && filteredResults.candidates.length > 0 ? (
                  filteredResults.candidates.map((candidate) => (
                    <div 
                      key={candidate.id}
                      onClick={() => navigateToItem('candidate', candidate.id)}
                      className="flex items-center p-3 rounded-md border hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <User className="h-5 w-5 text-gray-400 mr-3 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{candidate.fullName}</p>
                        <p className="text-sm text-gray-500 truncate">
                          {candidate.email} • {candidate.status}
                        </p>
                      </div>
                    </div>
                  ))
                ) : !isLoading && debouncedSearchQuery.length >= 2 ? (
                  <div className="flex flex-col items-center justify-center h-[300px] text-center">
                    <Search className="h-12 w-12 text-gray-300 mb-4" />
                    <p className="text-lg font-medium">No candidates found</p>
                    <p className="text-gray-500">Try a different search term</p>
                  </div>
                ) : null}
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}