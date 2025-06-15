import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { companyRegistrationSchema, loginSchema } from "@shared/schema";
import { Briefcase, Lock } from "lucide-react";

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [location, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");
  
  // Check URL parameters for signup flag
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("signup") === "true") {
      setActiveTab("signup");
    }
  }, []);
  
  // Redirect to dashboard if already logged in
  useEffect(() => {
    if (user) {
      console.log("User already logged in, redirecting from auth page to dashboard");
      setTimeout(() => {
        navigate("/dashboard");
      }, 100);
    }
  }, [user, navigate]);
  
  // Login form
  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: ""
    },
  });
  
  // Registration form
  const registrationForm = useForm<z.infer<typeof companyRegistrationSchema>>({
    resolver: zodResolver(companyRegistrationSchema),
    defaultValues: {
      companyName: "",
      firstName: "",
      lastName: "",
      username: "",
      password: ""
    },
  });
  
  function onLoginSubmit(values: z.infer<typeof loginSchema>) {
    loginMutation.mutate(values, {
      onSuccess: () => {
        console.log("Login successful, redirecting to dashboard");
        
        // Use a longer timeout to ensure the query cache has been updated
        // and the app has had time to process the authentication state
        setTimeout(() => {
          window.location.href = "/dashboard";
        }, 800);
      }
    });
  }
  
  function onRegisterSubmit(values: z.infer<typeof companyRegistrationSchema>) {
    console.log("Registration form submitted with values:", values);
    
    registerMutation.mutate(values, {
      onSuccess: () => {
        console.log("Registration successful, redirecting to dashboard");
        
        // Use a longer timeout to ensure the query cache has been updated
        // and the app has had time to process the authentication state
        setTimeout(() => {
          window.location.href = "/dashboard";
        }, 800);
      },
      onError: (error) => {
        console.error("Registration error in component:", error);
      }
    });
  }
  
  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Left side - Authentication forms */}
      <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:max-w-md">
          <div className="text-center">
            <div 
              className="cursor-pointer inline-block" 
              onClick={() => window.location.href = "/"}
            >
              <h1 className="text-3xl font-extrabold text-gray-900 hover:text-primary transition-colors duration-200">RecruitFlow</h1>
            </div>
            <p className="mt-2 text-sm text-gray-600">
              Your complete recruitment solution
            </p>
          </div>
          
          <div className="mt-8">
            <Tabs 
              defaultValue={activeTab} 
              value={activeTab} 
              onValueChange={(value) => setActiveTab(value as "signin" | "signup")}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
              
              {/* Sign In Form */}
              <TabsContent value="signin" className="mt-6">
                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-6">
                    <FormField
                      control={loginForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input placeholder="Email address" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={loginForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Checkbox id="remember" />
                        <label htmlFor="remember" className="ml-2 block text-sm text-gray-900">
                          Remember me
                        </label>
                      </div>
                      
                      <div className="text-sm">
                        <a href="#" className="font-medium text-primary hover:text-primary/80">
                          Forgot password?
                        </a>
                      </div>
                    </div>
                    
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={loginMutation.isPending}
                    >
                      {loginMutation.isPending ? (
                        <span className="flex items-center">
                          <span className="mr-2 h-4 w-4 animate-spin border-t-2 border-b-2 border-white rounded-full"></span>
                          Signing in...
                        </span>
                      ) : (
                        <span className="flex items-center">
                          <Lock className="mr-2 h-4 w-4" />
                          Sign in
                        </span>
                      )}
                    </Button>
                  </form>
                </Form>
                
                <div className="mt-6">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-gray-50 text-gray-500">Don't have an account?</span>
                    </div>
                  </div>
                  
                  <div className="mt-6">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setActiveTab("signup")}
                    >
                      Create account
                    </Button>
                  </div>
                </div>
              </TabsContent>
              
              {/* Sign Up Form */}
              <TabsContent value="signup" className="mt-6">
                <Form {...registrationForm}>
                  <form onSubmit={registrationForm.handleSubmit(onRegisterSubmit)} className="space-y-6">
                    <FormField
                      control={registrationForm.control}
                      name="companyName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Your company name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        control={registrationForm.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name</FormLabel>
                            <FormControl>
                              <Input placeholder="First name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={registrationForm.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Last name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <FormField
                      control={registrationForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input placeholder="Email address" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={registrationForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Password (min. 6 characters)" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={registerMutation.isPending}
                    >
                      {registerMutation.isPending ? (
                        <span className="flex items-center">
                          <span className="mr-2 h-4 w-4 animate-spin border-t-2 border-b-2 border-white rounded-full"></span>
                          Creating account...
                        </span>
                      ) : (
                        <span className="flex items-center">
                          <Briefcase className="mr-2 h-4 w-4" />
                          Create account
                        </span>
                      )}
                    </Button>
                  </form>
                </Form>
                
                <div className="mt-6">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-gray-50 text-gray-500">Already have an account?</span>
                    </div>
                  </div>
                  
                  <div className="mt-6">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setActiveTab("signin")}
                    >
                      Sign in instead
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
      
      {/* Right side - Hero content */}
      <div className="hidden lg:block relative w-0 flex-1">
        <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-primary/80 to-primary">
          <div className="flex flex-col justify-center h-full px-10 text-white">
            <h2 className="text-4xl font-bold mb-6">Streamline Your Hiring Process</h2>
            <ul className="space-y-4">
              <li className="flex items-start">
                <svg className="h-6 w-6 mr-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>Create and manage job postings in one place</span>
              </li>
              <li className="flex items-start">
                <svg className="h-6 w-6 mr-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>Track candidate applications and statuses</span>
              </li>
              <li className="flex items-start">
                <svg className="h-6 w-6 mr-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>Generate unique application pages for job boards</span>
              </li>
              <li className="flex items-start">
                <svg className="h-6 w-6 mr-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>Secure, multi-tenant platform isolates your data</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
