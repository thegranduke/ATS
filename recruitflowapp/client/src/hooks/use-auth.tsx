import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { User as SelectUser, CompanyRegistration, Login } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<SelectUser, Error, Login>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<SelectUser, Error, CompanyRegistration>;
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<SelectUser | undefined, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: Login) => {
      try {
        const res = await apiRequest("POST", "/api/login", credentials);
        return await res.json();
      } catch (error) {
        console.error("Login error:", error);
        // Rethrow the error with a clearer message if possible
        if (error instanceof Error) {
          if (error.message.includes("401")) {
            throw new Error("Invalid email or password. Please try again.");
          }
          throw error;
        }
        throw new Error("Login failed. Please try again.");
      }
    },
    onSuccess: (user: SelectUser) => {
      console.log("Login successful, setting user data in cache:", user);
      
      // Update the query cache with the new user data
      queryClient.setQueryData(["/api/user"], user);
      
      // Invalidate the user query to trigger a refetch
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      
      toast({
        title: "Login successful",
        description: "Welcome back!",
      });
      // Note: We're not handling navigation here anymore
      // so that the component using this hook can handle it
    },
    onError: (error: Error) => {
      console.error("Login mutation error:", error);
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (registrationData: CompanyRegistration) => {
      try {
        const res = await apiRequest("POST", "/api/register", registrationData);
        return await res.json();
      } catch (error) {
        console.error("Registration error:", error);
        // Rethrow the error with a clearer message if possible
        if (error instanceof Error) {
          if (error.message.includes("400")) {
            throw new Error("Email address already exists. Please use a different email.");
          }
          throw error;
        }
        throw new Error("Registration failed. Please try again.");
      }
    },
    onSuccess: (user: SelectUser) => {
      console.log("Registration successful, setting user data in cache:", user);
      
      // Update the query cache with the new user data
      queryClient.setQueryData(["/api/user"], user);
      
      // Invalidate the user query to trigger a refetch
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      
      toast({
        title: "Registration successful",
        description: "Welcome to RecruitFlow!",
      });
      // Note: We're not handling navigation here anymore
      // so that the component using this hook can handle it
    },
    onError: (error: Error) => {
      console.error("Registration mutation error:", error);
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      console.log("Executing logout API request");
      await apiRequest("POST", "/api/logout", {});
      console.log("Logout API request completed");
    },
    onSuccess: () => {
      console.log("Logout successful, clearing user data from cache - STEP 1");
      
      // Set user to null in the cache
      queryClient.setQueryData(["/api/user"], null);
      console.log("User data set to null in cache - STEP 2");
      
      // Explicitly invalidate and remove the user query from cache
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      console.log("User query invalidated - STEP 3");
      
      queryClient.removeQueries({ queryKey: ["/api/user"] });
      console.log("User query removed - STEP 4");
      
      // Also invalidate any other user-related queries to ensure clean state
      queryClient.invalidateQueries();
      console.log("All queries invalidated - STEP 5");
      
      // Check current user state in cache
      const currentUser = queryClient.getQueryData(["/api/user"]);
      console.log("Current user in cache after logout:", currentUser);
      
      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      });
    },
    onError: (error: Error) => {
      console.error("Logout mutation error:", error);
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
