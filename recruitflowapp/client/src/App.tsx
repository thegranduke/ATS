import React, { useEffect } from "react";
import { Switch, Route, Redirect } from "wouter";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing-page";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import JobManagement from "@/pages/job-management";
import JobDetails from "@/pages/job-details";
import EditJob from "@/pages/edit-job";
import Candidates from "@/pages/candidates";
import CandidateDetails from "@/pages/candidate-details";
import EditCandidate from "@/pages/edit-candidate";
import AccountSettings from "@/pages/settings";
import UserSettings from "@/pages/user-settings";
import Billing from "@/pages/billing";
import Reporting from "@/pages/reporting";
import ApplicationForm from "@/pages/application-form";
import TermsOfService from "@/pages/terms";
import PrivacyPolicy from "@/pages/privacy";
import HelpCenter from "@/pages/help-center";
import ErrorBoundary from "@/components/error-boundary";
import { ProtectedRoute } from "./lib/protected-route";
import { useAuth } from "@/hooks/use-auth";
import { TenantProvider } from "@/hooks/use-tenant";
import { disableRuntimeErrorOverlay } from "@/lib/vite-helpers";

function Router() {
  return (
    <Switch>
      <Route path="/">
        {() => {
          const { user, isLoading } = useAuth();
          
          // If loading, show a loading spinner
          if (isLoading) {
            return (
              <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
              </div>
            );
          }
          
          // If user is logged in, redirect to dashboard
          if (user) {
            console.log("User already logged in, redirecting to dashboard");
            return <Redirect to="/dashboard" />;
          }
          
          // Otherwise show landing page
          return <LandingPage />;
        }}
      </Route>
      <Route path="/auth" component={AuthPage} />
      <Route path="/apply/:applicationLink" component={ApplicationForm} />
      <Route path="/j/:jobId/:shortCode" component={ApplicationForm} />
      <Route path="/terms" component={TermsOfService} />
      <Route path="/privacy" component={PrivacyPolicy} />
      <ProtectedRoute path="/dashboard" component={Dashboard} />
      <ProtectedRoute path="/jobs" component={JobManagement} />
      <ProtectedRoute path="/jobs/:id/edit" component={EditJob} />
      <ProtectedRoute path="/jobs/:id" component={JobDetails} />
      <ProtectedRoute path="/candidates" component={Candidates} />
      <ProtectedRoute path="/candidates/:id/edit" component={EditCandidate} />
      <ProtectedRoute path="/candidates/:id" component={CandidateDetails} />
      <ProtectedRoute path="/reporting" component={Reporting} />
      <ProtectedRoute path="/settings" component={AccountSettings} />
      <ProtectedRoute path="/user-settings" component={UserSettings} />
      <ProtectedRoute path="/billing" component={Billing} />
      <ProtectedRoute path="/help-center" component={HelpCenter} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // The AuthProvider is added in main.tsx, so we don't need to add it here
  
  // Disable Vite runtime error overlay when the app starts
  useEffect(() => {
    // Call the helper to disable runtime error overlay and setup preventions
    disableRuntimeErrorOverlay();
  }, []);
  
  // Wrap protected routes with TenantProvider for multi-tenant support
  // and add ErrorBoundary to catch any runtime errors
  return (
    <ErrorBoundary>
      <TenantProvider>
        <Router />
      </TenantProvider>
    </ErrorBoundary>
  );
}

export default App;
