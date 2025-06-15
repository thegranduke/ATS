import React from "react";
import UserAvatarMenu from "./user-avatar-menu";
import NotificationCenter from "./notification-center";
import GlobalSearch from "./global-search";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function TopNavigation() {
  const { user } = useAuth();
  
  return (
    <div className="fixed top-0 left-0 right-0 z-40 bg-white h-16 flex items-center justify-between px-4 border-b border-gray-100 shadow-sm">
      {/* Logo on the left */}
      <div className="flex items-center">
        <div 
          className="flex items-center cursor-pointer" 
          onClick={() => window.location.href = "/dashboard"}
        >
          <span className="font-bold text-xl">RecruitFlow</span>
        </div>
      </div>
      
      {/* Empty middle section for potential future navigation items */}
      <div className="flex-1"></div>
      
      {/* Search, Help, Notifications and User avatar menu on the far right */}
      <div className="flex items-center space-x-4">
        {user && <GlobalSearch />}
        {user && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/help-center">
                  <HelpCircle className="h-5 w-5 text-gray-500 hover:text-primary transition-colors cursor-pointer" />
                </Link>
              </TooltipTrigger>
              <TooltipContent>
                <p>Help Center</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {user && <NotificationCenter />}
        <UserAvatarMenu />
      </div>
    </div>
  );
}

export default TopNavigation;