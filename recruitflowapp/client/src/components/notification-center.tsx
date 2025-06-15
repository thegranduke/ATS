import React, { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

interface Notification {
  id: number;
  userId: number;
  type: 'new_candidate' | 'new_job' | 'status_change' | 'system';
  title: string;
  message: string;
  read: boolean;
  relatedId?: number;
  relatedType?: string;
  createdAt: string;
}

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const bellRef = useRef<HTMLButtonElement>(null);

  // Get all notifications
  const { data: allNotifications = [], isLoading, error } = useQuery<Notification[]>({
    queryKey: ['/api/notifications'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Get unread notifications
  const { data: unreadNotifications = [], isLoading: unreadLoading } = useQuery<Notification[]>({
    queryKey: ['/api/notifications/unread'],
    refetchInterval: 15000, // Refresh unread more frequently (every 15 seconds)
  });
  
  // For display, only show unread notifications and a maximum of 5 read notifications from the last 7 days
  const currentDate = new Date();
  const sevenDaysAgo = new Date(currentDate.setDate(currentDate.getDate() - 7));
  
  // For display, ONLY show unread notifications
  // This is what the user wants - no read notifications should appear at all
  const notifications = useMemo(() => {
    // Just return the unread notifications, don't include any read ones
    return [...unreadNotifications];
  }, [unreadNotifications]);

  // We'll use this to display a success message after marking all as read
  const [justMarkedAllAsRead, setJustMarkedAllAsRead] = useState(false);

  const markAsRead = useMutation({
    mutationFn: async (id: number) => {
      console.log(`Marking notification ${id} as read`);
      return apiRequest('POST', `/api/notifications/${id}/mark-read`, {});
    },
    onSuccess: () => {
      // Force a refetch of both notification lists
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread'] });
    },
    onError: (error: Error) => {
      console.error("Error marking notification as read:", error);
      toast({
        title: "Failed to mark notification as read",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      console.log("Marking all notifications as read");
      return apiRequest('POST', '/api/notifications/mark-all-read', {});
    },
    onSuccess: () => {
      // Force a refetch of both notification lists immediately
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread'] });
      
      // Set the state to show we just marked all as read
      setJustMarkedAllAsRead(true);
      setTimeout(() => setJustMarkedAllAsRead(false), 5000); // Reset after 5 seconds
      
      toast({
        title: "Success",
        description: "All notifications marked as read.",
      });
    },
    onError: (error: Error) => {
      console.error("Error marking all notifications as read:", error);
      toast({
        title: "Failed to mark all notifications as read",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleNotificationClick = (notification: Notification) => {
    // Always mark as read when clicked, regardless of current state
    // This ensures that even if the UI gets out of sync, clicking will mark it read
    markAsRead.mutate(notification.id);

    // Navigate to related content if applicable
    if (notification.relatedType === 'candidate' && notification.relatedId) {
      navigate(`/candidates/${notification.relatedId}`);
    } else if (notification.relatedType === 'job' && notification.relatedId) {
      navigate(`/jobs/${notification.relatedId}`);
    }

    setOpen(false);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.round(diffMs / 1000);
    const diffMin = Math.round(diffSec / 60);
    const diffHour = Math.round(diffMin / 60);
    const diffDay = Math.round(diffHour / 24);

    if (diffSec < 60) return `${diffSec} sec ago`;
    if (diffMin < 60) return `${diffMin} min ago`;
    if (diffHour < 24) return `${diffHour} hr ago`;
    if (diffDay < 7) return `${diffDay} day ago`;
    
    return date.toLocaleDateString();
  };

  const getTypeIcon = (type: string) => {
    switch(type) {
      case 'new_candidate':
        return '👤';
      case 'new_job':
        return '🔖';
      case 'status_change':
        return '🔄';
      case 'system':
        return '🔔';
      default:
        return '📣';
    }
  };

  if (error) {
    return null; // Don't show anything if there's an error
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={bellRef}
          variant="ghost" 
          size="icon" 
          className="relative"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadNotifications.length > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadNotifications.length > 9 ? '9+' : unreadNotifications.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4">
          <h3 className="font-medium text-sm">Notifications</h3>
          {/* Always show the mark as read button regardless of unreadNotifications.length */}
          <Button 
            variant={unreadNotifications.length > 0 ? "default" : "ghost"}
            size="sm" 
            className="text-xs"
            disabled={markAllAsRead.isPending || unreadNotifications.length === 0}
            onClick={() => markAllAsRead.mutate()}
          >
            {markAllAsRead.isPending ? "Marking..." : "Mark all as read"}
          </Button>
        </div>
        <Separator />
        {isLoading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No notifications yet
          </div>
        ) : (
          <ScrollArea className="h-[350px]">
            <div className="flex flex-col gap-1 p-1">
              {/* If we just marked all as read and there are no unread notifications, show a success message */}
              {justMarkedAllAsRead && unreadNotifications.length === 0 && (
                <div className="p-2 bg-green-100 dark:bg-green-900 text-center rounded mb-2 mx-1">
                  <p className="text-sm text-green-800 dark:text-green-200">All notifications marked as read!</p>
                </div>
              )}
              
              {notifications.map((notification) => (
                <Card 
                  key={notification.id}
                  className={`p-3 cursor-pointer hover:bg-muted transition-colors ${!notification.read ? 'bg-accent/10' : ''}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex gap-2">
                    <div className="text-lg">{getTypeIcon(notification.type)}</div>
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <span className={`text-xs font-medium ${!notification.read ? 'text-primary' : 'text-muted-foreground'}`}>
                          {notification.title}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(notification.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm">{notification.message}</p>
                      
                      {/* Add individual mark as read button for each unread notification */}
                      {!notification.read && (
                        <div className="mt-2 flex justify-end">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-xs h-7 px-2"
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent card click
                              markAsRead.mutate(notification.id);
                            }}
                          >
                            Mark as read
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}