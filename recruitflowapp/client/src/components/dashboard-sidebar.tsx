import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  Briefcase, 
  Users, 
  Menu, 
  X, 
  BarChart3
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TenantSwitcher } from "./tenant-switcher";
import TopNavigation from "./top-navigation";

interface SidebarProps {
  children: React.ReactNode;
}

export default function DashboardSidebar({ children }: SidebarProps) {
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };
  
  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };
  
  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Jobs", href: "/jobs", icon: Briefcase },
    { name: "Candidates", href: "/candidates", icon: Users },
    { name: "Reporting", href: "/reporting", icon: BarChart3 },
  ];
  
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Top Navigation Bar */}
      <TopNavigation />
      
      {/* Sidebar for desktop */}
      <div 
        className={cn(
          "fixed inset-0 z-40 bg-white w-64 flex-shrink-0 border-r border-gray-100 transition-all duration-300 ease-in-out transform",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          "top-16" // Add top offset to make room for top navigation
        )}
      >
        <div className="h-full flex flex-col overflow-hidden">
          {/* Close button for mobile */}
          <div className="flex justify-end md:hidden pt-2 pr-4">
            <button 
              className="p-2 rounded-md text-gray-500 hover:bg-gray-100"
              onClick={toggleMobileMenu}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          {/* Navigation */}
          <div className="flex-1 overflow-y-auto py-4 px-3">
            <nav className="space-y-1">
              {navigation.map((item) => (
                <div key={item.name} onClick={() => {
                  navigate(item.href);
                  closeMobileMenu();
                }}>
                  <div
                    className={cn(
                      "flex items-center px-3 py-2 text-sm rounded-md font-medium transition-colors cursor-pointer",
                      location === item.href
                        ? "text-primary bg-primary/5"
                        : "text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    <item.icon 
                      className={cn(
                        "mr-3 h-5 w-5",
                        location === item.href
                          ? "text-primary"
                          : "text-gray-400"
                      )} 
                    />
                    {item.name}
                  </div>
                </div>
              ))}
            </nav>
          </div>
          
          {/* Bottom navigation */}
          <div className="flex-shrink-0 border-t border-gray-100 p-3">
            {/* Tenant Switcher */}
            <div className="px-3">
              <TenantSwitcher />
            </div>
          </div>
        </div>
      </div>
      
      {/* Mobile menu button */}
      <div className="fixed top-0 left-0 z-50 md:hidden">
        <button 
          className="p-4 text-gray-500 hover:bg-gray-100"
          onClick={toggleMobileMenu}
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>
      
      {/* Backdrop overlay when mobile menu is open */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black bg-opacity-50 md:hidden"
          onClick={toggleMobileMenu}
        />
      )}
      
      {/* Main content */}
      <div className="flex-1 flex flex-col md:ml-64">
        <main className="flex-1 py-6 px-4 md:px-8 mt-16">
          {children}
        </main>
      </div>
    </div>
  );
}
