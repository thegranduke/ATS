import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import DashboardSidebar from "@/components/dashboard-sidebar";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Job, Candidate } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, Users, BarChart2, DollarSign, Briefcase } from "lucide-react";

// Define chart data types
type JobStatusData = {
  name: string;
  value: number;
  color: string;
  count?: number;  // Used for storing the raw count for tooltips
};

type ApplicationTrendData = {
  name: string;
  applications: number;
  date?: Date;
  start?: Date;
  end?: Date;
};

// New data type for job views
type JobViewData = {
  jobId: number;
  count: number;
  jobTitle?: string;
};

export default function Reporting() {
  const { user } = useAuth();
  const [jobsByStatus, setJobsByStatus] = useState<JobStatusData[]>([]);
  const [applicationTrend, setApplicationTrend] = useState<ApplicationTrendData[]>([]);
  const [jobViewsData, setJobViewsData] = useState<JobViewData[]>([]);
  const [totalJobViews, setTotalJobViews] = useState<number>(0);

  // Query for jobs
  const { data: jobsResponse } = useQuery<{jobs: Job[], pagination: any}>({
    queryKey: ["/api/jobs"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/jobs");
      return res.json();
    },
    enabled: !!user,
  });
  
  const jobs = jobsResponse?.jobs || [];

  // Query for candidates
  const { data: candidates } = useQuery({
    queryKey: ["/api/candidates"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/candidates");
      return res.json();
    },
    enabled: !!user,
  });
  
  // Query for job view counts by job
  const { data: jobViewCounts, isLoading: isLoadingJobViews } = useQuery({
    queryKey: ["/api/job-views/count/company"],
    queryFn: async () => {
      const res = await fetch("/api/job-views/count/company", {
        credentials: "include"
      });
      if (!res.ok) {
        throw new Error("Failed to fetch job view counts");
      }
      return res.json();
    },
    enabled: !!user,
  });
  
  // Query for total job views
  const { data: totalJobViewsData } = useQuery({
    queryKey: ["/api/job-views/total/company"],
    queryFn: async () => {
      const res = await fetch("/api/job-views/total/company", {
        credentials: "include"
      });
      if (!res.ok) {
        throw new Error("Failed to fetch total job views");
      }
      return res.json();
    },
    enabled: !!user,
  });

  // Calculate job status distribution when jobs data is available
  useEffect(() => {
    if (jobs && jobs.length > 0) {
      // Count jobs by status
      const statusCounts: Record<string, number> = {};
      jobs.forEach((job: Job) => {
        const status = job.status || "unknown";
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      // Calculate percentages and prepare chart data
      const totalJobs = jobs.length;
      const chartData = Object.entries(statusCounts).map(([status, count]) => {
        const percentage = Math.round((count / totalJobs) * 100);
        
        // Define colors based on status
        let color = "#10B981"; // default green
        if (status === "draft") color = "#9CA3AF"; // gray
        if (status === "closed") color = "#EF4444"; // red
        if (status === "archived") color = "#6B7280"; // darker gray
        
        return {
          name: status.charAt(0).toUpperCase() + status.slice(1),
          value: percentage,
          count,
          color
        };
      });

      setJobsByStatus(chartData);
    } else {
      // Default empty state
      setJobsByStatus([
        { name: "No Data", value: 100, count: 0, color: "#E5E7EB" }
      ]);
    }
  }, [jobs]);

  // Generate applications trend data for the last 6 months
  useEffect(() => {
    if (candidates) {
      // Generate last 6 months
      const months: ApplicationTrendData[] = [];
      const now = new Date();
      
      for (let i = 5; i >= 0; i--) {
        const month = subMonths(now, i);
        months.push({
          date: month,
          name: format(month, "MMM"),
          start: startOfMonth(month),
          end: endOfMonth(month),
          applications: 0
        });
      }

      // Count applications per month
      if (candidates.length > 0) {
        candidates.forEach((candidate: Candidate) => {
          const candidateDate = new Date(candidate.createdAt);
          
          months.forEach(month => {
            if (month.start && month.end && candidateDate >= month.start && candidateDate <= month.end) {
              month.applications += 1;
            }
          });
        });
      }

      // Format data for chart
      setApplicationTrend(months.map(month => ({
        name: month.name,
        applications: month.applications
      })));
    } else {
      // Default empty state - last 6 months with zero applications
      const months: ApplicationTrendData[] = [];
      const now = new Date();
      
      for (let i = 5; i >= 0; i--) {
        const month = subMonths(now, i);
        months.push({
          name: format(month, "MMM"),
          applications: 0
        });
      }
      
      setApplicationTrend(months);
    }
  }, [candidates]);
  
  // Process job view data when available
  useEffect(() => {
    // Set total job views
    if (totalJobViewsData) {
      setTotalJobViews(totalJobViewsData.count || 0);
    }
    
    // Process job view counts by job
    if (jobViewCounts && jobs) {
      const viewsWithTitles = jobViewCounts.map((viewData: JobViewData) => {
        const job = jobs.find((j: Job) => j.id === viewData.jobId);
        return {
          ...viewData,
          jobTitle: job ? job.title : `Job #${viewData.jobId}`
        };
      });
      
      // Sort by count in descending order
      viewsWithTitles.sort((a: JobViewData, b: JobViewData) => b.count - a.count);
      
      setJobViewsData(viewsWithTitles);
    }
  }, [jobViewCounts, totalJobViewsData, jobs]);

  return (
    <DashboardSidebar>
      <div className="px-4 py-6 sm:px-6 max-w-[1400px] mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Reporting</h1>
        <p className="text-gray-600 mb-6">View detailed reports and analytics about your recruitment activities</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Jobs by Status */}
          <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm">
            <h2 className="text-lg font-semibold mb-6">Jobs by Status</h2>
            <div className="h-[300px] flex items-center justify-center">
              {jobsByStatus.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={jobsByStatus}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={0}
                      dataKey="value"
                      label={({name, value}) => `${name} ${value}%`}
                    >
                      {jobsByStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value, name, props) => [`${value}% (${props.payload.count} jobs)`, name]}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-gray-400">No job data available</div>
              )}
            </div>
          </div>
          
          {/* Applications Trend */}
          <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm">
            <h2 className="text-lg font-semibold mb-6">Applications Trend</h2>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={applicationTrend}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip formatter={(value) => [`${value} applications`, 'Applications']} />
                  <Bar dataKey="applications" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between space-x-2">
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-primary/10 rounded-full">
                    <Briefcase className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Jobs</p>
                    <p className="text-2xl font-bold">{jobs?.length || 0}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between space-x-2">
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-blue-100 rounded-full">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Candidates</p>
                    <p className="text-2xl font-bold">{candidates?.length || 0}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between space-x-2">
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-green-100 rounded-full">
                    <BarChart2 className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Active Jobs</p>
                    <p className="text-2xl font-bold">
                      {jobs?.filter((job: Job) => job.status === "active").length || 0}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between space-x-2">
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-purple-100 rounded-full">
                    <Eye className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Job Views</p>
                    <p className="text-2xl font-bold">{totalJobViews}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Job Views by Job */}
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Job Views by Position</CardTitle>
              <CardDescription>
                Track which job postings are receiving the most attention from potential applicants
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingJobViews ? (
                <div className="flex justify-center py-8">
                  <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                </div>
              ) : jobViewsData && jobViewsData.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {jobViewsData.map((jobView) => (
                    <div 
                      key={jobView.jobId}
                      className="bg-gray-50 p-4 rounded-lg flex items-start justify-between"
                    >
                      <div>
                        <h3 className="font-medium text-gray-900 truncate max-w-[240px]">
                          {jobView.jobTitle}
                        </h3>
                        <div className="mt-1 flex items-center text-sm text-gray-500">
                          <Eye className="h-4 w-4 mr-1" />
                          <span>{jobView.count} view{jobView.count !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <div 
                        className="min-w-[60px] text-right font-semibold text-lg"
                        style={{
                          color: jobView.count > 20 ? '#059669' : 
                                 jobView.count > 10 ? '#0284c7' : 
                                 jobView.count > 0 ? '#6366f1' : '#d1d5db'
                        }}
                      >
                        {jobView.count}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Eye className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No job view data available yet.</p>
                  <p className="text-sm mt-2">Data will appear once users start viewing your job postings.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardSidebar>
  );
}