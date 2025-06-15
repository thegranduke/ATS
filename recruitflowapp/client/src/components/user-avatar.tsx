import { useState, useEffect, useRef } from 'react';
import { User } from '@shared/schema';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface UserAvatarProps {
  user: Partial<User>;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  forceRefresh?: boolean;
}

function getInitials(fullName: string): string {
  if (!fullName) return "?";
  
  const names = fullName.split(' ');
  if (names.length === 1) return names[0].charAt(0).toUpperCase();
  
  return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
}

export default function UserAvatar({ 
  user, 
  size = "md", 
  className,
  forceRefresh = false
}: UserAvatarProps) {
  const { toast } = useToast();
  // Track the avatar URL for image loading
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  // Track refresh count for cache busting
  const refreshCount = useRef(0);
  const [cacheKey, setCacheKey] = useState(Date.now());
  
  // Reset image states when avatarUrl changes or force refresh is triggered
  useEffect(() => {
    // Always reset the loading state when the component updates
    setImageLoaded(false);
    setImageError(false);
    refreshCount.current = 0; // Reset error count
    
    // Update cache key to force a refresh
    setCacheKey(Date.now());
    
    if (user.avatarUrl) {
      console.log("Avatar URL changed or refresh triggered:", user.avatarUrl);
    }
  }, [user.avatarUrl, forceRefresh]);
  
  // Size classes
  const sizeClasses = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-12 w-12 text-base",
    xl: "h-24 w-24 text-2xl"
  };
  
  const initials = user.fullName ? getInitials(user.fullName) : "?";

  // Create a function to handle image errors
  const handleImageError = () => {
    if (user.avatarUrl) {
      console.error("Failed to load avatar image:", user.avatarUrl);
    } else {
      console.error("Failed to load avatar image: No URL provided");
    }
    setImageError(true);
    
    // If this is the first error, try one more refresh with a different cache key
    if (refreshCount.current < 2 && user.avatarUrl) {
      console.log(`Attempting to refresh avatar image (attempt ${refreshCount.current + 1})...`);
      setCacheKey(Date.now());
      refreshCount.current += 1;
    } else if (refreshCount.current === 2 && user.avatarUrl) {
      // On the third failure, show a toast message
      toast({
        title: "Unable to load avatar",
        description: "Your profile picture couldn't be loaded. Please try uploading it again.",
        variant: "destructive"
      });
      refreshCount.current += 1;
    }
  };
  
  // Handle image load success
  const handleImageLoad = () => {
    if (user.avatarUrl) {
      console.log("Avatar image loaded successfully:", user.avatarUrl);
    }
    setImageLoaded(true);
    setImageError(false);
  };

  // Add cache busting to prevent browser caching - safer handling of null values
  const avatarUrl = user.avatarUrl ? 
    `${user.avatarUrl}${user.avatarUrl.includes('?') ? '&' : '?'}_=${cacheKey}` : 
    null;
  
  // Show debug info about the image in console to help troubleshoot, but only when an avatar exists
  useEffect(() => {
    // Only log if we have an avatar URL or debug status changes
    if (imageLoaded || imageError || refreshCount.current > 0) {
      console.log("Avatar status update:", {
        hasAvatarUrl: !!user.avatarUrl,
        originalUrl: user.avatarUrl || 'none',
        imageLoaded,
        imageError,
        refreshCount: refreshCount.current
      });
    }
  }, [user.avatarUrl, imageLoaded, imageError, refreshCount.current]);
  
  // Instead of using Radix UI Avatar components, we'll implement our own with better control
  return (
    <div className={cn(
      "relative overflow-hidden rounded-full flex items-center justify-center", 
      sizeClasses[size], 
      className
    )}>
      {/* Fallback - shown when no image, during loading, or on error */}
      <div 
        style={{ backgroundColor: user.avatarColor || '#3B82F6' }}
        className="absolute inset-0 w-full h-full flex items-center justify-center font-medium text-white"
      >
        {initials}
      </div>
      
      {/* Image - always attempt to load, but only show when successfully loaded */}
      {avatarUrl && (
        <img 
          src={avatarUrl} 
          alt={user.fullName || "User avatar"} 
          onLoad={handleImageLoad}
          onError={handleImageError}
          className={cn(
            "absolute inset-0 w-full h-full object-cover transition-opacity duration-200",
            imageLoaded && !imageError ? "opacity-100 z-10" : "opacity-0"
          )}
        />
      )}
    </div>
  );
}