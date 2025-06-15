import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import UserAvatar from "@/components/user-avatar";
import { User, Settings, LogOut, CreditCard } from "lucide-react";

export default function UserAvatarMenu() {
  const [_, navigate] = useLocation();
  const { user, logoutMutation } = useAuth();
  // Track when to force a refresh of the avatar
  const [forceRefresh, setForceRefresh] = useState(false);
  
  // Force a refresh of the avatar every 5 seconds when the page loads
  // This ensures the avatar is updated if the user has changed it in another tab
  useEffect(() => {
    if (user) {
      // Initial refresh when component mounts
      setForceRefresh(true);
      
      // Reset after trigger
      const timer = setTimeout(() => {
        setForceRefresh(false);
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [user]);
  
  if (!user) return null;
  
  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        // Short delay to allow React Query cache updates to complete
        setTimeout(() => {
          window.location.href = "/auth";
        }, 100);
      }
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="outline-none">
        <div className="h-9 w-9 border border-gray-200 cursor-pointer hover:ring-2 hover:ring-primary/20 rounded-full overflow-hidden">
          <UserAvatar 
            user={user} 
            forceRefresh={forceRefresh}
            size="sm"
            className="h-full w-full"
          />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="flex items-center justify-start gap-2 p-2">
          <div className="flex flex-col space-y-0.5">
            <p className="text-sm font-medium">{user.fullName}</p>
            <p className="text-xs text-gray-500">{user.username}</p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={() => navigate("/user-settings")}
          className="cursor-pointer"
        >
          <User className="mr-2 h-4 w-4" />
          <span>User Settings</span>
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => navigate("/settings")}
          className="cursor-pointer"
        >
          <Settings className="mr-2 h-4 w-4" />
          <span>Account Settings</span>
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => navigate("/billing")}
          className="cursor-pointer"
        >
          <CreditCard className="mr-2 h-4 w-4" />
          <span>Billing</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={handleLogout}
          className="cursor-pointer text-red-600 focus:text-red-600"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sign Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}