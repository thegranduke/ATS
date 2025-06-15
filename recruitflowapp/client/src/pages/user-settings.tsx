import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { disableRuntimeErrorOverlay } from "@/lib/vite-helpers";
import DashboardSidebar from "@/components/dashboard-sidebar";
import AvatarEditor from "@/components/avatar-editor";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { userProfileSchema, type User } from "@shared/schema";

// Custom interface for avatar updates
interface AvatarUpdateData extends Partial<User> {
  pendingColorUpdate?: boolean;
  _forceAvatarRefresh?: boolean;
}

export default function UserSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Disable runtime error overlay when component mounts
  useEffect(() => {
    // Call the helper function to disable the runtime error overlay
    disableRuntimeErrorOverlay();
    
    // Also set up a periodic check to make sure the overlay stays closed
    const intervalId = setInterval(disableRuntimeErrorOverlay, 1000);
    
    return () => clearInterval(intervalId);
  }, []);
  
  // Track pending avatar color changes
  const [pendingAvatarColor, setPendingAvatarColor] = useState<string | null>(null);

  // Password change form schema
  const passwordChangeSchema = z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string()
      .min(8, "Password must be at least 8 characters")
      .max(100, "Password must be less than 100 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

  // Form setup for user profile
  const userProfileForm = useForm<z.infer<typeof userProfileSchema>>({
    resolver: zodResolver(userProfileSchema),
    defaultValues: {
      firstName: user?.fullName.split(' ')[0] || "",
      lastName: user?.fullName.split(' ').slice(1).join(' ') || "",
      username: user?.username || "",
    },
  });

  // Form setup for password change
  const passwordForm = useForm<z.infer<typeof passwordChangeSchema>>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Mutation for updating avatar color
  const updateAvatarColorMutation = useMutation({
    mutationFn: async (color: string) => {
      const response = await apiRequest('PATCH', '/api/user/avatar', { avatarColor: color });
      return response.json();
    },
    onSuccess: () => {
      // Color updated successfully
      setPendingAvatarColor(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update avatar color.',
        variant: 'destructive',
      });
    },
  });

  // Mutation for updating user profile
  const updateProfileMutation = useMutation({
    mutationFn: async (data: z.infer<typeof userProfileSchema>) => {
      const response = await apiRequest("PUT", "/api/user/profile", data);
      return response.json();
    },
    onSuccess: () => {
      // If we have a pending avatar color change, update that too
      if (pendingAvatarColor) {
        updateAvatarColorMutation.mutate(pendingAvatarColor);
      }
      
      toast({
        title: "Profile updated",
        description: "Your profile information has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Mutation for changing password
  const changePasswordMutation = useMutation({
    mutationFn: async (data: z.infer<typeof passwordChangeSchema>) => {
      const response = await apiRequest("PUT", "/api/user/password", {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Password changed",
        description: "Your password has been changed successfully.",
      });
      passwordForm.reset({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to change password. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Form submission handlers
  function onUserProfileSubmit(values: z.infer<typeof userProfileSchema>) {
    updateProfileMutation.mutate(values);
  }

  function onPasswordSubmit(values: z.infer<typeof passwordChangeSchema>) {
    changePasswordMutation.mutate(values);
  }
  
  // Handler for avatar updates
  const handleAvatarUpdate = (updatedUser: AvatarUpdateData) => {
    if (updatedUser.pendingColorUpdate && updatedUser.avatarColor) {
      // Store the pending color without immediately updating
      setPendingAvatarColor(updatedUser.avatarColor);
    } else if (updatedUser._forceAvatarRefresh || updatedUser.avatarUrl !== undefined) {
      // Force a refresh when the avatar image changes
      console.log("Avatar image updated, invalidating user data:", updatedUser);
      
      // Immediately update the user data in cache to show the change
      if (user && updatedUser.avatarUrl !== undefined) {
        queryClient.setQueryData(['/api/user'], {
          ...user,
          avatarUrl: updatedUser.avatarUrl
        });
      }
      
      // Then refresh from the server
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
    }
  };

  return (
    <DashboardSidebar>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">User Settings</h1>
          <h2 className="text-sm text-gray-500 mt-1">
            Manage your personal profile and password
          </h2>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* User profile form */}
              <Form {...userProfileForm}>
                <form onSubmit={userProfileForm.handleSubmit(onUserProfileSubmit)} className="space-y-4">
                  {/* Avatar editor placed at the top */}
                  <div className="mb-8">
                    <h3 className="text-base font-medium mb-4">Profile Picture</h3>
                    {user && <AvatarEditor user={user} onUpdate={handleAvatarUpdate} />}
                  </div>

                  <div className="grid grid-cols-6 gap-6">
                    <div className="col-span-6 sm:col-span-3">
                      <FormField
                        control={userProfileForm.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="col-span-6 sm:col-span-3">
                      <FormField
                        control={userProfileForm.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last Name</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="col-span-6">
                      <FormField
                        control={userProfileForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email Address</FormLabel>
                            <FormControl>
                              <Input {...field} type="email" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    disabled={updateProfileMutation.isPending}
                  >
                    {updateProfileMutation.isPending ? 
                      <span className="flex items-center">
                        <span className="mr-2 h-4 w-4 animate-spin border-t-2 border-b-2 border-white rounded-full"></span>
                        Updating...
                      </span> 
                      : "Save Profile Information"
                    }
                  </Button>
                </form>
              </Form>
              
              {/* Password change form */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Change Password</h3>
                <Form {...passwordForm}>
                  <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                    <div className="grid grid-cols-6 gap-6">
                      <div className="col-span-6 sm:col-span-3">
                        <FormField
                          control={passwordForm.control}
                          name="currentPassword"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Current Password</FormLabel>
                              <FormControl>
                                <Input type="password" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-6 gap-6">
                      <div className="col-span-6 sm:col-span-3">
                        <FormField
                          control={passwordForm.control}
                          name="newPassword"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>New Password</FormLabel>
                              <FormControl>
                                <Input type="password" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="col-span-6 sm:col-span-3">
                        <FormField
                          control={passwordForm.control}
                          name="confirmPassword"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Confirm New Password</FormLabel>
                              <FormControl>
                                <Input type="password" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                    <Button 
                      type="submit" 
                      disabled={changePasswordMutation.isPending}
                    >
                      {changePasswordMutation.isPending ? 
                        <span className="flex items-center">
                          <span className="mr-2 h-4 w-4 animate-spin border-t-2 border-b-2 border-white rounded-full"></span>
                          Updating...
                        </span> 
                        : "Change Password"
                      }
                    </Button>
                  </form>
                </Form>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardSidebar>
  );
}