import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Company } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import DashboardSidebar from "@/components/dashboard-sidebar";
import { User, UserPlus, MoreHorizontal, Pencil, Trash2, Link, Building2, Upload, Image } from "lucide-react";
import { Location, LocationFormData } from "@/interfaces/location";
import { userProfileSchema, UserProfile, brokerkitIntegrationSchema, BrokerkitIntegration } from "@shared/schema";

// Define user invitation schema
const inviteUserSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  username: z.string().email("Valid email address is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.string().min(1, "Role is required"),
});

// Define company info schema
const companyInfoSchema = z.object({
  name: z.string().min(1, "Company name is required"),
  industry: z.string().optional(),
  size: z.string().optional(),
});

// Define password change schema
const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
  confirmPassword: z.string().min(1, "Please confirm your new password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Define edit user schema
const editUserSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  username: z.string().email("Valid email address is required"),
  role: z.string().min(1, "Role is required"),
}).transform(data => ({
  ...data,
  fullName: `${data.firstName} ${data.lastName}`
}));

// Define location form schema
const locationFormSchema = z.object({
  name: z.string().min(1, "Location name is required"),
  streetAddress: z.string().min(1, "Street address is required"),
  city: z.string().min(1, "City is required"),
  county: z.string().min(1, "County is required"),
  state: z.string().min(1, "State is required"),
  zipCode: z.string().min(1, "Zip code is required").regex(/^\d{5}(-\d{4})?$/, "Must be a valid zip code"),
});

export default function AccountSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("account");
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [editUserDialogOpen, setEditUserDialogOpen] = useState(false);
  const [deleteUserDialogOpen, setDeleteUserDialogOpen] = useState(false);
  const [addLocationDialogOpen, setAddLocationDialogOpen] = useState(false);
  const [editLocationDialogOpen, setEditLocationDialogOpen] = useState(false);
  const [deleteLocationDialogOpen, setDeleteLocationDialogOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Define a type for company users
  type CompanyUser = {
    id: number;
    username: string;
    fullName: string;
    role: string;
    companyId: number;
  };
  
  const [selectedUser, setSelectedUser] = useState<CompanyUser | null>(null);
  
  // Brokerkit API key form
  const brokerkitForm = useForm<z.infer<typeof brokerkitIntegrationSchema>>({
    resolver: zodResolver(brokerkitIntegrationSchema),
    defaultValues: {
      brokerkitApiKey: "",
    },
  });
  
  // User profile form
  const userProfileForm = useForm<z.infer<typeof userProfileSchema>>({
    resolver: zodResolver(userProfileSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      username: "",
    },
  });
  
  // Set user profile form values when user data is loaded
  useEffect(() => {
    if (user) {
      // Split fullName into firstName and lastName
      const nameParts = user.fullName ? user.fullName.split(' ') : ['', ''];
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      userProfileForm.reset({
        firstName,
        lastName,
        username: user.username,
      });
    }
  }, [user, userProfileForm]);

  // Query for company information
  const {
    data: company = { name: "", industry: "", size: "", brokerkitApiKey: "" } as Company,
    isLoading: isLoadingCompany,
    refetch: refetchCompany
  } = useQuery<Company>({
    queryKey: ["/api/company"],
    queryFn: () => apiRequest("GET", "/api/company", undefined).then(res => res.json()),
    enabled: !!user,
  });

  // State to toggle viewing all users (admin only)
  const [showAllUsers, setShowAllUsers] = useState(false);
  
  // Query for company users
  const {
    data: companyUsers = [] as CompanyUser[],
    isLoading: isLoadingUsers,
    refetch: refetchUsers
  } = useQuery<CompanyUser[]>({
    queryKey: ["/api/company/users", showAllUsers ? "all" : "tenant"],
    queryFn: () => {
      // Only admins can view all users when they explicitly toggle the setting
      const url = `/api/company/users${showAllUsers ? '?showAllUsers=true' : ''}`;
      return apiRequest("GET", url, undefined).then(res => res.json());
    },
    enabled: !!user,
  });

  // Company info form
  const companyForm = useForm<z.infer<typeof companyInfoSchema>>({
    resolver: zodResolver(companyInfoSchema),
    defaultValues: {
      name: "",
      industry: "real_estate",
      size: "",
    },
  });

  // Set company form values when company data is loaded
  useEffect(() => {
    if (company && company.name && companyForm.getValues().name === "") {
      companyForm.reset({
        name: company.name,
        industry: company.industry || "real_estate",
        size: company.size || "",
      });
    }
    
    // Set Brokerkit API key if available
    if (company && company.brokerkitApiKey) {
      brokerkitForm.reset({
        brokerkitApiKey: company.brokerkitApiKey,
      });
    }
  }, [company, companyForm, brokerkitForm]);

  // Password change form
  const passwordForm = useForm<z.infer<typeof passwordChangeSchema>>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Invite user form
  const inviteForm = useForm<z.infer<typeof inviteUserSchema>>({
    resolver: zodResolver(inviteUserSchema),
    defaultValues: {
      fullName: "",
      username: "",
      password: "",
      role: "user",
    },
  });
  
  // Edit user form
  const editUserForm = useForm<z.infer<typeof editUserSchema>>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      username: "",
      role: "user",
    },
  });
  
  // Set edit user form values when a user is selected
  useEffect(() => {
    if (selectedUser) {
      // Split fullName into firstName and lastName (fallback to fullName for both if needed)
      const nameParts = selectedUser.fullName.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      editUserForm.reset({
        firstName,
        lastName,
        username: selectedUser.username,
        role: selectedUser.role
      });
    }
  }, [selectedUser, editUserForm]);

  // Update company information mutation
  const updateCompanyMutation = useMutation({
    mutationFn: async (data: z.infer<typeof companyInfoSchema>) => {
      const response = await apiRequest("PUT", "/api/company", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company"] });
      toast({
        title: "Company information updated",
        description: "Your company details have been saved.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update company information",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (data: z.infer<typeof passwordChangeSchema>) => {
      // Implement password change endpoint
      const response = await apiRequest("PUT", "/api/user/password", {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      return response.json();
    },
    onSuccess: () => {
      passwordForm.reset({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      toast({
        title: "Password updated",
        description: "Your password has been changed successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update password",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Invite user mutation
  const inviteUserMutation = useMutation({
    mutationFn: async (data: z.infer<typeof inviteUserSchema>) => {
      const response = await apiRequest("POST", "/api/company/users", {
        ...data,
        companyId: user?.companyId,
      });
      return response.json();
    },
    onSuccess: () => {
      setInviteDialogOpen(false);
      inviteForm.reset();
      refetchUsers();
      toast({
        title: "User invited",
        description: "The user invitation has been sent.",
      });
    },
    onError: (error: Error) => {
      // Check if the error message contains information about duplicate username
      const errorMessage = error.message;
      const isDuplicateError = errorMessage.includes('users_username_unique') || 
                              errorMessage.includes('duplicate key') || 
                              errorMessage.includes('already exists');
      
      if (isDuplicateError) {
        // Set specific form error for duplicate username
        inviteForm.setError('username', { 
          type: 'manual', 
          message: 'This email is already registered. Please use a different email.' 
        });
        
        // Keep the password but clear the error message after a few seconds
        setTimeout(() => {
          inviteForm.clearErrors('username');
        }, 5000);
        
        toast({
          title: "Email already in use",
          description: "A user with this email already exists in the system.",
          variant: "destructive",
        });
      } else {
        // Reset the form for any other error
        inviteForm.reset();
        
        toast({
          title: "Failed to invite user",
          description: errorMessage,
          variant: "destructive",
        });
      }
    },
  });
  
  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async (data: z.infer<typeof editUserSchema>) => {
      if (!selectedUser) return null;
      const response = await apiRequest("PUT", `/api/company/users/${selectedUser.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      setEditUserDialogOpen(false);
      refetchUsers();
      toast({
        title: "User updated",
        description: "User information has been successfully updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: z.infer<typeof userProfileSchema>) => {
      try {
        console.log("Sending profile update:", data);
        const payload = {
          ...data,
          // Create fullName from firstName and lastName
          fullName: `${data.firstName} ${data.lastName}`
        };
        const response = await apiRequest("PUT", "/api/user/profile", payload);
        
        // Check response type and content
        const contentType = response.headers.get("content-type");
        console.log("Response content type:", contentType);
        
        // If not JSON, log the text and throw error
        if (!contentType || !contentType.includes("application/json")) {
          const text = await response.text();
          console.log("Non-JSON response:", text.substring(0, 100) + "...");
          throw new Error("Server returned non-JSON response");
        }
        
        return response.json();
      } catch (error) {
        console.error("Profile update error:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "Profile updated",
        description: "Your profile information has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update profile",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiRequest("DELETE", `/api/company/users/${userId}`, undefined);
      if (!response.ok) {
        throw new Error("Failed to delete user");
      }
      return null;
    },
    onSuccess: () => {
      setDeleteUserDialogOpen(false);
      setSelectedUser(null);
      refetchUsers();
      toast({
        title: "User deleted",
        description: "User has been successfully removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete user",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Update Brokerkit API key mutation
  const updateBrokerkitMutation = useMutation({
    mutationFn: async (data: z.infer<typeof brokerkitIntegrationSchema>) => {
      const response = await apiRequest("PUT", "/api/company/integration/brokerkit", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company"] });
      toast({
        title: "Brokerkit integration updated",
        description: "Your Brokerkit API key has been saved successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update Brokerkit integration",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Location form
  const locationForm = useForm<z.infer<typeof locationFormSchema>>({
    resolver: zodResolver(locationFormSchema),
    defaultValues: {
      name: "",
      streetAddress: "",
      city: "",
      county: "",
      state: "",
      zipCode: ""
    },
  });
  
  // Set location form values when editing
  useEffect(() => {
    if (selectedLocation) {
      locationForm.reset({
        name: selectedLocation.name,
        streetAddress: selectedLocation.streetAddress,
        city: selectedLocation.city,
        county: selectedLocation.county,
        state: selectedLocation.state,
        zipCode: selectedLocation.zipCode
      });
    }
  }, [selectedLocation, locationForm]);
  
  // Query for company locations
  const {
    data: locations = [] as Location[],
    isLoading: isLoadingLocations,
    refetch: refetchLocations
  } = useQuery<Location[]>({
    queryKey: ["/api/company/locations"],
    queryFn: () => apiRequest("GET", "/api/company/locations", undefined).then(res => res.json()),
    enabled: !!user,
  });
  
  // Create location mutation
  const createLocationMutation = useMutation({
    mutationFn: async (data: LocationFormData) => {
      const response = await apiRequest("POST", "/api/company/locations", data);
      return response.json();
    },
    onSuccess: () => {
      setAddLocationDialogOpen(false);
      locationForm.reset();
      refetchLocations();
      toast({
        title: "Location added",
        description: "New location has been successfully added.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add location",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Update location mutation
  const updateLocationMutation = useMutation({
    mutationFn: async (data: LocationFormData) => {
      if (!selectedLocation) return null;
      const response = await apiRequest("PUT", `/api/company/locations/${selectedLocation.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      setEditLocationDialogOpen(false);
      locationForm.reset();
      setSelectedLocation(null);
      refetchLocations();
      toast({
        title: "Location updated",
        description: "Location has been successfully updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update location",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Delete location mutation
  const deleteLocationMutation = useMutation({
    mutationFn: async (locationId: number) => {
      const response = await apiRequest("DELETE", `/api/company/locations/${locationId}`, undefined);
      if (!response.ok) {
        throw new Error("Failed to delete location");
      }
      return null;
    },
    onSuccess: () => {
      setDeleteLocationDialogOpen(false);
      setSelectedLocation(null);
      refetchLocations();
      toast({
        title: "Location deleted",
        description: "Location has been successfully removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete location",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Logo upload mutation
  const uploadLogoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('logo', file);
      
      const response = await fetch('/api/company/logo', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload logo');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      refetchCompany();
      setLogoFile(null);
      setLogoPreview(null);
      toast({
        title: "Logo uploaded",
        description: "Company logo has been successfully updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to upload logo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete logo mutation
  const deleteLogoMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", "/api/company/logo", undefined);
      if (!response.ok) {
        throw new Error("Failed to delete logo");
      }
      return null;
    },
    onSuccess: () => {
      refetchCompany();
      toast({
        title: "Logo removed",
        description: "Company logo has been successfully removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to remove logo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle logo file selection
  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid file type",
          description: "Please select an image file.",
          variant: "destructive",
        });
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select an image smaller than 5MB.",
          variant: "destructive",
        });
        return;
      }
      
      setLogoFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (event) => {
        setLogoPreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Submit company form
  function onCompanySubmit(values: z.infer<typeof companyInfoSchema>) {
    updateCompanyMutation.mutate(values);
  }

  // Submit password form
  function onPasswordSubmit(values: z.infer<typeof passwordChangeSchema>) {
    changePasswordMutation.mutate(values);
  }

  // Submit invite form
  function onInviteSubmit(values: z.infer<typeof inviteUserSchema>) {
    inviteUserMutation.mutate(values);
  }
  
  // Submit edit user form
  function onEditUserSubmit(values: z.infer<typeof editUserSchema>) {
    updateUserMutation.mutate(values);
  }
  
  // Submit user profile form
  function onUserProfileSubmit(values: z.infer<typeof userProfileSchema>) {
    updateProfileMutation.mutate(values);
  }
  
  // Submit Brokerkit API key form
  function onBrokerkitSubmit(values: z.infer<typeof brokerkitIntegrationSchema>) {
    updateBrokerkitMutation.mutate(values);
  }
  
  // Submit add location form
  function onAddLocationSubmit(values: z.infer<typeof locationFormSchema>) {
    createLocationMutation.mutate(values);
  }
  
  // Submit edit location form
  function onEditLocationSubmit(values: z.infer<typeof locationFormSchema>) {
    updateLocationMutation.mutate(values);
  }

  return (
    <DashboardSidebar>
      <div className="px-4 sm:px-6 md:px-8 mt-6 md:mt-16">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
            Account Settings
          </h2>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
          <TabsList className="mb-4">
            <TabsTrigger value="account">Company Settings</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="locations">Locations</TabsTrigger>
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
          </TabsList>
          
          <TabsContent value="user">
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Add userProfile form */}
                <Form {...userProfileForm}>
                  <form onSubmit={userProfileForm.handleSubmit(onUserProfileSubmit)} className="space-y-4">
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
                
                <div>
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
          </TabsContent>
          
          <TabsContent value="account">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Company Information</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoadingCompany ? (
                    <div className="flex justify-center py-4">
                      <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    </div>
                  ) : (
                    <Form {...companyForm}>
                      <form onSubmit={companyForm.handleSubmit(onCompanySubmit)} className="space-y-4">
                        <FormField
                          control={companyForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Company Name</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <FormField
                            control={companyForm.control}
                            name="industry"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Industry</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select industry" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="real_estate">Real Estate</SelectItem>
                                    <SelectItem value="technology">Technology</SelectItem>
                                    <SelectItem value="healthcare">Healthcare</SelectItem>
                                    <SelectItem value="finance">Finance</SelectItem>
                                    <SelectItem value="education">Education</SelectItem>
                                    <SelectItem value="retail">Retail</SelectItem>
                                    <SelectItem value="manufacturing">Manufacturing</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={companyForm.control}
                            name="size"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Company Size</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select company size" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="1-10">1-10 employees</SelectItem>
                                    <SelectItem value="11-50">11-50 employees</SelectItem>
                                    <SelectItem value="51-200">51-200 employees</SelectItem>
                                    <SelectItem value="201-500">201-500 employees</SelectItem>
                                    <SelectItem value="501+">501+ employees</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <Button 
                          type="submit" 
                          disabled={updateCompanyMutation.isPending}
                        >
                          {updateCompanyMutation.isPending ? 
                            <span className="flex items-center">
                              <span className="mr-2 h-4 w-4 animate-spin border-t-2 border-b-2 border-white rounded-full"></span>
                              Saving...
                            </span> 
                            : "Save Company Information"
                          }
                        </Button>
                      </form>
                    </Form>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Company Logo</CardTitle>
                  <CardDescription>
                    Upload your company logo to display on application forms
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Current Logo Display */}
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        {company.logoUrl || logoPreview ? (
                          <img
                            src={logoPreview || company.logoUrl || ''}
                            alt="Company Logo"
                            className="h-16 w-16 object-contain border rounded-lg p-2"
                          />
                        ) : (
                          <div className="h-16 w-16 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                            <Image className="h-6 w-6 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {company.logoUrl ? "Current logo" : "No logo uploaded"}
                        </p>
                        <p className="text-xs text-gray-500">
                          Recommended: 200x200px, PNG or JPG, max 5MB
                        </p>
                      </div>
                    </div>

                    {/* Upload Controls */}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadLogoMutation.isPending}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        {logoFile ? "Change Logo" : "Upload Logo"}
                      </Button>
                      
                      {logoFile && (
                        <Button
                          type="button"
                          onClick={() => uploadLogoMutation.mutate(logoFile)}
                          disabled={uploadLogoMutation.isPending}
                        >
                          {uploadLogoMutation.isPending ? (
                            <span className="flex items-center">
                              <span className="mr-2 h-4 w-4 animate-spin border-t-2 border-b-2 border-white rounded-full"></span>
                              Uploading...
                            </span>
                          ) : (
                            "Save Logo"
                          )}
                        </Button>
                      )}
                      
                      {company.logoUrl && (
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={() => deleteLogoMutation.mutate()}
                          disabled={deleteLogoMutation.isPending}
                        >
                          {deleteLogoMutation.isPending ? (
                            <span className="flex items-center">
                              <span className="mr-2 h-4 w-4 animate-spin border-t-2 border-b-2 border-white rounded-full"></span>
                              Removing...
                            </span>
                          ) : (
                            "Remove Logo"
                          )}
                        </Button>
                      )}
                    </div>

                    {/* Hidden File Input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoSelect}
                      className="hidden"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="users">
            <div className="space-y-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <CardTitle>User Management</CardTitle>
                    {/* Admin toggle for showing all users */}
                    {user?.role === "admin" && (
                      <div className="flex items-center space-x-2 ml-4">
                        <Switch
                          checked={showAllUsers}
                          onCheckedChange={setShowAllUsers}
                          id="show-all-users"
                        />
                        <Label htmlFor="show-all-users" className="text-sm text-gray-500">
                          {showAllUsers ? "Showing all users" : "Showing current tenant only"}
                        </Label>
                      </div>
                    )}
                  </div>
                  {user?.role === "admin" && (
                    <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="inline-flex items-center">
                          <UserPlus className="mr-2 h-4 w-4" />
                          Add User
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Invite New User</DialogTitle>
                          <DialogDescription>
                            Provide details for the new user to be added to your company account.
                          </DialogDescription>
                        </DialogHeader>
                        <Form {...inviteForm}>
                          <form onSubmit={inviteForm.handleSubmit(onInviteSubmit)} className="space-y-4">
                            <FormField
                              control={inviteForm.control}
                              name="fullName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Full Name</FormLabel>
                                  <FormControl>
                                    <Input {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={inviteForm.control}
                              name="username"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Email Address</FormLabel>
                                  <FormControl>
                                    <Input type="email" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={inviteForm.control}
                              name="password"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Password</FormLabel>
                                  <FormControl>
                                    <Input type="password" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={inviteForm.control}
                              name="role"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Role</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select role" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="admin">Admin</SelectItem>
                                      <SelectItem value="user">User</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <DialogFooter className="flex flex-col items-end gap-2">
                              {inviteForm.formState.errors.username && (
                                <p className="text-sm text-destructive self-start">
                                  {inviteForm.formState.errors.username.message}
                                </p>
                              )}
                              <Button 
                                type="submit" 
                                disabled={inviteUserMutation.isPending}
                              >
                                {inviteUserMutation.isPending ? 
                                  <span className="flex items-center">
                                    <span className="mr-2 h-4 w-4 animate-spin border-t-2 border-b-2 border-white rounded-full"></span>
                                    Inviting...
                                  </span> 
                                  : "Invite User"
                                }
                              </Button>
                            </DialogFooter>
                          </form>
                        </Form>
                      </DialogContent>
                    </Dialog>
                  )}
                </CardHeader>
                <CardContent>
                  {isLoadingUsers ? (
                    <div className="flex justify-center py-4">
                      <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    </div>
                  ) : companyUsers.length > 0 ? (
                    <div className="bg-white overflow-hidden shadow rounded-md">
                      {/* Table header */}
                      <div className="px-4 py-3 flex items-center justify-between sm:px-6 border-b border-gray-200 bg-gray-50">
                        <div className="w-3/4 text-sm font-medium text-gray-500">Users</div>
                        <div className="w-1/4 text-right text-sm font-medium text-gray-500">Actions</div>
                      </div>
                      
                      <ul role="list" className="divide-y divide-gray-200">
                        {companyUsers.map((companyUser) => (
                          <li key={companyUser.id}>
                            <div className="px-4 py-4 flex items-center justify-between sm:px-6">
                              <div className="w-3/4 flex items-center">
                                <div className="flex-shrink-0 h-10 w-10">
                                  <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary font-medium">
                                    {companyUser.fullName.split(' ').map((n) => n[0]).join('').toUpperCase()}
                                  </div>
                                </div>
                                <div className="ml-4">
                                  <div className="flex text-sm">
                                    <p className="font-medium text-primary truncate">{companyUser.fullName}</p>
                                    <p className="ml-1 flex-shrink-0 font-normal text-gray-500">
                                      {companyUser.username}
                                    </p>
                                  </div>
                                  <div className="mt-2 flex space-x-4">
                                    <div className="flex items-center text-sm text-gray-500">
                                      <User className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                                      {companyUser.role.charAt(0).toUpperCase() + companyUser.role.slice(1)}
                                    </div>
                                    
                                    {/* If user is admin and viewing all users, show company ID */}
                                    {user?.role === "admin" && (
                                      <div className="flex items-center text-sm text-gray-500">
                                        <Building2 className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                                        {companyUser.companyId === company?.id ? 
                                          'Current tenant' : 
                                          `Company ID: ${companyUser.companyId}`}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              {/* Action buttons */}
                              <div className="w-1/4 text-right">
                                {user?.role === "admin" && user?.id !== companyUser.id ? (
                                  <div className="flex justify-end space-x-2">
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      onClick={() => {
                                        setSelectedUser(companyUser);
                                        setEditUserDialogOpen(true);
                                      }}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      className="text-red-600 border-red-200 hover:bg-red-50" 
                                      onClick={() => {
                                        setSelectedUser(companyUser);
                                        setDeleteUserDialogOpen(true);
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ) : (
                                  <span className="text-sm text-gray-500">
                                    {user?.id === companyUser.id ? 'Current user' : 'No actions'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-gray-500">
                      No users found for this company.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="integrations">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Brokerkit Integration</CardTitle>
                  <CardDescription>
                    Connect your Brokerkit account to automatically sync candidates from your job postings.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...brokerkitForm}>
                    <form onSubmit={brokerkitForm.handleSubmit(onBrokerkitSubmit)} className="space-y-4">
                      <FormField
                        control={brokerkitForm.control}
                        name="brokerkitApiKey"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Brokerkit API Key</FormLabel>
                            <FormControl>
                              <Input 
                                {...field}
                                type="password" 
                                placeholder="Enter your Brokerkit API key"
                              />
                            </FormControl>
                            <FormDescription>
                              You can find your API key in your Brokerkit account settings.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button 
                        type="submit" 
                        disabled={updateBrokerkitMutation.isPending}
                        className="flex items-center"
                      >
                        {updateBrokerkitMutation.isPending ? (
                          <span className="flex items-center">
                            <span className="mr-2 h-4 w-4 animate-spin border-t-2 border-b-2 border-white rounded-full"></span>
                            Saving...
                          </span>
                        ) : (
                          <>
                            <Link className="mr-2 h-4 w-4" />
                            Save API Key
                          </>
                        )}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="locations">
            <div className="space-y-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Locations</CardTitle>
                    <CardDescription>Manage your company locations</CardDescription>
                  </div>
                  <Dialog open={addLocationDialogOpen} onOpenChange={setAddLocationDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Building2 className="mr-2 h-4 w-4" />
                        Add Location
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add New Location</DialogTitle>
                        <DialogDescription>
                          Enter the details for the new company location.
                        </DialogDescription>
                      </DialogHeader>
                      <Form {...locationForm}>
                        <form onSubmit={locationForm.handleSubmit(onAddLocationSubmit)} className="space-y-4 py-2">
                          <FormField
                            control={locationForm.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Location Name</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="Headquarters" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={locationForm.control}
                            name="streetAddress"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Street Address</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="123 Main St" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={locationForm.control}
                              name="city"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>City</FormLabel>
                                  <FormControl>
                                    <Input {...field} placeholder="San Francisco" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={locationForm.control}
                              name="county"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>County</FormLabel>
                                  <FormControl>
                                    <Input {...field} placeholder="San Francisco" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={locationForm.control}
                              name="state"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>State</FormLabel>
                                  <FormControl>
                                    <Input {...field} placeholder="CA" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={locationForm.control}
                              name="zipCode"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Zip Code</FormLabel>
                                  <FormControl>
                                    <Input {...field} placeholder="94105" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <DialogFooter>
                            <Button 
                              type="submit" 
                              disabled={createLocationMutation.isPending}
                            >
                              {createLocationMutation.isPending ? 
                                <span className="flex items-center">
                                  <span className="mr-2 h-4 w-4 animate-spin border-t-2 border-b-2 border-white rounded-full"></span>
                                  Saving...
                                </span> 
                                : "Add Location"
                              }
                            </Button>
                          </DialogFooter>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                <CardContent>
                  <div className="relative w-full overflow-auto">
                    {isLoadingLocations ? (
                      <div className="flex justify-center py-8">
                        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                      </div>
                    ) : locations.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Building2 className="mx-auto h-8 w-8 mb-2 opacity-50" />
                        <p>No locations added yet. Click "Add Location" to create your first location.</p>
                      </div>
                    ) : (
                      <table className="w-full caption-bottom text-sm">
                        <thead className="[&_tr]:border-b">
                          <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Name</th>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Address</th>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">City</th>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">State</th>
                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="[&_tr:last-child]:border-0">
                          {locations.map((location) => (
                            <tr key={location.id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                              <td className="p-4 align-middle">{location.name}</td>
                              <td className="p-4 align-middle">{location.streetAddress}</td>
                              <td className="p-4 align-middle">{location.city}</td>
                              <td className="p-4 align-middle">{location.state}</td>
                              <td className="p-4 align-middle">
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setSelectedLocation(location);
                                      setEditLocationDialogOpen(true);
                                    }}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setSelectedLocation(location);
                                      setDeleteLocationDialogOpen(true);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit User Dialog */}
      <Dialog open={editUserDialogOpen} onOpenChange={setEditUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information below. Click save when you're done.
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <Form {...editUserForm}>
              <form onSubmit={editUserForm.handleSubmit(onEditUserSubmit)} className="space-y-4">
                <FormField
                  control={editUserForm.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editUserForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editUserForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="user">User</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button 
                    type="submit" 
                    disabled={updateUserMutation.isPending}
                  >
                    {updateUserMutation.isPending ? 
                      <span className="flex items-center">
                        <span className="mr-2 h-4 w-4 animate-spin border-t-2 border-b-2 border-white rounded-full"></span>
                        Saving...
                      </span> 
                      : "Save Changes"
                    }
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation */}
      <AlertDialog open={deleteUserDialogOpen} onOpenChange={setDeleteUserDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the user
              account and remove their data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              onClick={() => {
                if (selectedUser) {
                  deleteUserMutation.mutate(selectedUser.id);
                }
              }}
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending ? (
                <span className="flex items-center">
                  <span className="mr-2 h-4 w-4 animate-spin border-t-2 border-b-2 border-white rounded-full"></span>
                  Deleting...
                </span>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Edit Location Dialog */}
      <Dialog open={editLocationDialogOpen} onOpenChange={setEditLocationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Location</DialogTitle>
            <DialogDescription>
              Update location information below. Click save when you're done.
            </DialogDescription>
          </DialogHeader>
          {selectedLocation && (
            <Form {...locationForm}>
              <form onSubmit={locationForm.handleSubmit(onEditLocationSubmit)} className="space-y-4 py-2">
                <FormField
                  control={locationForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={locationForm.control}
                  name="streetAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Street Address</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={locationForm.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={locationForm.control}
                    name="county"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>County</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={locationForm.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={locationForm.control}
                    name="zipCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Zip Code</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <DialogFooter>
                  <Button 
                    type="submit" 
                    disabled={updateLocationMutation.isPending}
                  >
                    {updateLocationMutation.isPending ? 
                      <span className="flex items-center">
                        <span className="mr-2 h-4 w-4 animate-spin border-t-2 border-b-2 border-white rounded-full"></span>
                        Saving...
                      </span> 
                      : "Save Changes"
                    }
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Location Confirmation */}
      <AlertDialog open={deleteLocationDialogOpen} onOpenChange={setDeleteLocationDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the location
              and remove its data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              onClick={() => {
                if (selectedLocation) {
                  deleteLocationMutation.mutate(selectedLocation.id);
                }
              }}
              disabled={deleteLocationMutation.isPending}
            >
              {deleteLocationMutation.isPending ? (
                <span className="flex items-center">
                  <span className="mr-2 h-4 w-4 animate-spin border-t-2 border-b-2 border-white rounded-full"></span>
                  Deleting...
                </span>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardSidebar>
  );
}
