import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route, useLocation } from "wouter";
import { useEffect, useState } from "react";

export function ProtectedRoute({
  path,
  component: Component,
}: {
  path: string;
  component: () => React.JSX.Element;
}) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();
  const [checkCount, setCheckCount] = useState(0);
  const [redirecting, setRedirecting] = useState(false);

  // Debug information to help troubleshoot
  useEffect(() => {
    console.log(`ProtectedRoute (${path}) - Auth state updated:`, { 
      user, 
      isLoading, 
      checkCount,
      redirecting,
      timestamp: new Date().toISOString()
    });
    
    // Immediate redirect if we detect user is null and not loading
    if (!isLoading && !user && !redirecting) {
      console.log(`ProtectedRoute (${path}) - User is null, triggering immediate redirect`);
      setRedirecting(true);
    }
    
    // Increment check count when we finish loading
    if (!isLoading && checkCount < 5) {
      setCheckCount(prev => prev + 1);
    }
  }, [user, isLoading, path, checkCount, redirecting]);

  // When the route changes, reset the check count
  useEffect(() => {
    setCheckCount(0);
    setRedirecting(false);
  }, [location]);

  if (isLoading || (checkCount < 3 && !user)) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Route>
    );
  }

  if (!user && redirecting) {
    console.log(`ProtectedRoute (${path}) - No user, redirecting to /auth`);
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  if (user) {
    console.log(`ProtectedRoute (${path}) - User authenticated, rendering component`);
    return <Route path={path} component={Component} />;
  }

  // Default case - show loading
  return (
    <Route path={path}>
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    </Route>
  );
}
