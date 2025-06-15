import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Briefcase, Users, Shield } from "lucide-react";

export default function LandingPage() {
  const { user } = useAuth();
  const [_, navigate] = useLocation();

  // Redirect to dashboard if already logged in
  if (user) {
    navigate("/dashboard");
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation */}
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <span className="text-primary text-xl font-bold">RecruitFlow</span>
              </div>
            </div>
            <div className="flex items-center">
              <Link href="/auth">
                <Button variant="ghost" className="px-4 py-2 text-primary font-medium">
                  Sign In
                </Button>
              </Link>
              <Link href="/auth?signup=true">
                <Button className="ml-4 px-4 py-2">
                  Sign Up
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>
      
      {/* Hero Section */}
      <div className="flex-grow flex flex-col">
        <div className="py-12 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="lg:grid lg:grid-cols-12 lg:gap-8">
              <div className="sm:text-center md:max-w-2xl md:mx-auto lg:col-span-6 lg:text-left">
                <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
                  <span className="block xl:inline">Streamline your</span>
                  <span className="block text-primary xl:inline"> recruitment process</span>
                </h1>
                <p className="mt-3 text-base text-gray-500 sm:mt-5 sm:text-lg sm:max-w-xl sm:mx-auto lg:mx-0">
                  RecruitFlow helps companies manage job postings, track applications, and streamline their entire hiring workflow in one central location.
                </p>
                <div className="mt-8 sm:max-w-lg sm:mx-auto sm:text-center lg:text-left lg:mx-0">
                  <Link href="/auth?signup=true">
                    <Button size="lg" className="px-6 py-3">
                      Get Started
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="mt-12 relative sm:max-w-lg sm:mx-auto lg:mt-0 lg:max-w-none lg:mx-0 lg:col-span-6 lg:flex lg:items-center">
                <div className="relative mx-auto w-full rounded-lg shadow-lg lg:max-w-md">
                  <svg
                    className="w-full rounded-lg"
                    height="300"
                    viewBox="0 0 500 300"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <rect width="100%" height="100%" fill="#f3f4f6" />
                    <rect x="50" y="50" width="400" height="60" rx="4" fill="#e5e7eb" />
                    <rect x="70" y="70" width="100" height="20" rx="2" fill="#d1d5db" />
                    <rect x="350" y="70" width="80" height="20" rx="2" fill="#3b82f6" />
                    
                    <rect x="50" y="130" width="400" height="60" rx="4" fill="#e5e7eb" />
                    <rect x="70" y="150" width="100" height="20" rx="2" fill="#d1d5db" />
                    <rect x="350" y="150" width="80" height="20" rx="2" fill="#3b82f6" />
                    
                    <rect x="50" y="210" width="400" height="60" rx="4" fill="#e5e7eb" />
                    <rect x="70" y="230" width="100" height="20" rx="2" fill="#d1d5db" />
                    <rect x="350" y="230" width="80" height="20" rx="2" fill="#3b82f6" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Features */}
        <div className="py-12 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-base font-semibold text-primary tracking-wide uppercase">Features</h2>
              <p className="mt-2 text-3xl font-extrabold text-gray-900 sm:text-4xl">Everything you need to manage recruitment</p>
            </div>
            
            <div className="mt-10">
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
                {/* Feature 1 */}
                <div className="pt-6">
                  <div className="flow-root bg-white rounded-lg px-6 pb-8">
                    <div className="-mt-6">
                      <div>
                        <span className="inline-flex items-center justify-center p-3 bg-primary rounded-md shadow-lg">
                          <Briefcase className="h-6 w-6 text-white" />
                        </span>
                      </div>
                      <h3 className="mt-8 text-lg font-medium text-gray-900 tracking-tight">Job Management</h3>
                      <p className="mt-5 text-base text-gray-500">
                        Create, manage, and track job postings with ease. Generate unique application links to share on job boards.
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Feature 2 */}
                <div className="pt-6">
                  <div className="flow-root bg-white rounded-lg px-6 pb-8">
                    <div className="-mt-6">
                      <div>
                        <span className="inline-flex items-center justify-center p-3 bg-primary rounded-md shadow-lg">
                          <Users className="h-6 w-6 text-white" />
                        </span>
                      </div>
                      <h3 className="mt-8 text-lg font-medium text-gray-900 tracking-tight">Candidate Tracking</h3>
                      <p className="mt-5 text-base text-gray-500">
                        Manage all candidate information in one place. Track applications, resumes, and communication history.
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Feature 3 */}
                <div className="pt-6">
                  <div className="flow-root bg-white rounded-lg px-6 pb-8">
                    <div className="-mt-6">
                      <div>
                        <span className="inline-flex items-center justify-center p-3 bg-primary rounded-md shadow-lg">
                          <Shield className="h-6 w-6 text-white" />
                        </span>
                      </div>
                      <h3 className="mt-8 text-lg font-medium text-gray-900 tracking-tight">Secure Multi-Tenant</h3>
                      <p className="mt-5 text-base text-gray-500">
                        Each company has isolated data and accounts. Invite team members to collaborate with role-based permissions.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <footer className="bg-white">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="border-t border-gray-200 pt-8 flex justify-between items-center">
            <p className="text-base text-gray-400">&copy; {new Date().getFullYear()} RecruitFlow. All rights reserved.</p>
            <div className="flex space-x-6">
              <Link to="/terms" className="text-gray-400 hover:text-gray-500">Terms</Link>
              <Link to="/privacy" className="text-gray-400 hover:text-gray-500">Privacy</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
