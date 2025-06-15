import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import DashboardSidebar from "@/components/dashboard-sidebar";
import { 
  Briefcase, 
  Users, 
  LineChart, 
  TrendingUp, 
  Eye, 
} from "lucide-react";
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const { user } = useAuth();
  const [location, navigate] = useLocation();
  
  // Query for jobs
  const { 
    data: jobsResponse,
    isLoading: isLoadingJobs 
  } = useQuery<{jobs: any[], pagination: any}>({
    queryKey: ["/api/jobs"],
    enabled: !!user,
  });
  
  const jobs = jobsResponse?.jobs || [];
  
  // Query for candidates
  const { 
    data: candidates = [],
    isLoading: isLoadingCandidates 
  } = useQuery<any[]>({
    queryKey: ["/api/candidates"],
    enabled: !!user,
  });
  
  // Query for total job views
  const {
    data: totalJobViewsData,
    isLoading: isLoadingJobViews
  } = useQuery<{count: number}>({
    queryKey: ["/api/job-views/total/company"],
    enabled: !!user,
  });

  // Get enhanced job views analytics with month-over-month calculations
  const {
    data: jobViewsAnalytics,
    isLoading: isLoadingJobViewsAnalytics
  } = useQuery({
    queryKey: ["/api/job-views/analytics/company"],
    enabled: !!user,
  });

  // Get job views data for individual job breakdown
  const {
    data: jobViewsData = [],
    isLoading: isLoadingJobViewsCount
  } = useQuery<any[]>({
    queryKey: ["/api/job-views/count/company"],
    enabled: !!user,
  });
  
  // Calculate statistics
  const activeJobs = jobs.filter((job: any) => job.status === "active").length;
  const totalApplications = candidates.length;
  
  // Get analytics from the enhanced API
  const jobViews = jobViewsAnalytics?.totalViews || 0;
  const currentMonthViews = jobViewsAnalytics?.currentMonthViews || 0;
  const lastMonthViews = jobViewsAnalytics?.lastMonthViews || 0;
  const percentageChange = jobViewsAnalytics?.percentageChange || 0;
  const trend = jobViewsAnalytics?.trend || 'same';
  
  // Format percentage change for display
  const formattedPercentage = Math.abs(percentageChange);
  const isPositive = trend === 'up';
  const isNegative = trend === 'down';
  
  // Analytics data is already calculated by the backend
  const displayPercentage = formattedPercentage > 0 ? formattedPercentage : 0;
  
  // Generate application trend data for chart
  const months = ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'];
  const applicationTrendData = months.map(month => ({
    name: month,
    applications: 0
  }));
  
  // Get recent jobs
  const recentJobs = [...jobs].sort((a: any, b: any) => 
    new Date(b.createdAt || Date.now()).getTime() - new Date(a.createdAt || Date.now()).getTime()
  ).slice(0, 5);
  
  return (
    <DashboardSidebar>
      <div className="px-4 sm:px-6 md:px-8 mt-4 md:mt-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-sm text-gray-500">Welcome back to RecruitFlow</p>
        </div>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
          {/* Active Jobs */}
          <Card className="overflow-hidden border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Active Jobs</p>
                  <div className="mt-2 flex items-baseline">
                    <h3 className="text-2xl font-semibold">
                      {isLoadingJobs ? 
                        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" /> 
                        : activeJobs
                      }
                    </h3>
                  </div>
                  <div className="mt-1">
                    <span className="text-xs text-green-600">+ 100% from last month</span>
                  </div>
                </div>
                <div className="p-2 bg-primary/10 rounded-md self-start">
                  <Briefcase className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Total Applications */}
          <Card className="overflow-hidden border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Applications</p>
                  <div className="mt-2 flex items-baseline">
                    <h3 className="text-2xl font-semibold">
                      {isLoadingCandidates ? 
                        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" /> 
                        : totalApplications
                      }
                    </h3>
                  </div>
                  <div className="mt-1">
                    <span className="text-xs text-green-600">+ 100% from last month</span>
                  </div>
                </div>
                <div className="p-2 bg-primary/10 rounded-md self-start">
                  <Users className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Job Views */}
          <Card className="overflow-hidden border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Job Views</p>
                  <div className="mt-2 flex items-baseline">
                    <h3 className="text-2xl font-semibold">
                      {isLoadingJobViews || isLoadingJobViewsCount ? 
                        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" /> 
                        : jobViews
                      }
                    </h3>
                  </div>
                  <div className="mt-1">
                    {!isLoadingJobViewsAnalytics && jobViewsAnalytics && (
                      <span className={`text-xs ${isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-500'}`}>
                        {isPositive ? `+${displayPercentage}%` : isNegative ? `-${displayPercentage}%` : '0%'} from last month
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-2 bg-primary/10 rounded-md self-start">
                  <Eye className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Recent Jobs */}
          <Card className="overflow-hidden border-0 shadow-sm">
            <CardContent className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Jobs</h3>
              {isLoadingJobs ? (
                <div className="py-8 flex justify-center">
                  <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                </div>
              ) : recentJobs.length > 0 ? (
                <div className="space-y-3">
                  {recentJobs.map((job: any) => (
                    <div 
                      key={job.id} 
                      className="p-3 border border-gray-100 rounded-lg cursor-pointer hover:shadow-sm transition-shadow"
                      onClick={() => navigate(`/jobs/${job.id}`)}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium text-sm text-gray-900">{job.title}</p>
                          <p className="text-xs text-gray-500 mt-1">{job.department || 'General'}</p>
                        </div>
                        <span className={cn(
                          "text-xs px-2 py-1 rounded-full font-medium",
                          job.status === "active" ? "bg-green-100 text-green-800" : 
                          job.status === "draft" ? "bg-yellow-100 text-yellow-800" : 
                          job.status === "closed" ? "bg-gray-100 text-gray-800" : 
                          "bg-red-100 text-red-800"
                        )}>
                          {job.status?.charAt(0).toUpperCase() + job.status?.slice(1) || 'Unknown'}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div 
                    className="flex items-center justify-center py-2 text-xs text-primary font-medium cursor-pointer hover:underline"
                    onClick={() => navigate('/jobs')}
                  >
                    View all jobs
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-gray-500">
                  No recent jobs
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Application Trends */}
          <Card className="overflow-hidden border-0 shadow-sm">
            <CardContent className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Application Trends</h3>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLineChart
                    data={applicationTrendData}
                    margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fontSize: 12 }}
                      axisLine={{ stroke: '#f0f0f0' }}
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      axisLine={{ stroke: '#f0f0f0' }}
                      tickLine={false}
                      domain={[0, 4]}
                      ticks={[0, 1, 2, 3, 4]}
                    />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="applications" 
                      stroke="var(--primary)" 
                      strokeWidth={2}
                      dot={{ r: 4, fill: "var(--primary)" }}
                      activeDot={{ r: 6, fill: "var(--primary)" }}
                    />
                  </RechartsLineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardSidebar>
  );
}
