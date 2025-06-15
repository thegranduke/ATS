import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useTenant } from "@/hooks/use-tenant";
import DashboardSidebar from "@/components/dashboard-sidebar";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CreditCard, Receipt, AlertCircle } from "lucide-react";

export default function Billing() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();

  // This is a placeholder for future implementation
  const { data: subscription, isLoading } = useQuery({
    queryKey: ["/api/billing/subscription"],
    queryFn: () => {
      // Mock data - in a real implementation, this would fetch from your backend
      return Promise.resolve({
        status: "active",
        plan: "Lite",
        nextBillingDate: "N/A",
        amount: "$0"
      });
    },
    enabled: !!user && !!currentTenant,
  });

  return (
    <DashboardSidebar>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
          <h2 className="text-sm text-gray-500 mt-1">
            Manage your subscription plan
          </h2>
        </div>

        <div className="space-y-6">
          {/* Current Plan */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CreditCard className="mr-2 h-5 w-5" />
                Current Plan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <div className="flex items-center space-x-4">
                  <div className="h-12 w-12 rounded-full bg-gray-200 animate-pulse"></div>
                  <div className="space-y-2">
                    <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
                    <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-lg font-medium">{subscription?.plan} Plan</h3>
                      <p className="text-sm text-gray-500">
                        Free during the beta period
                      </p>
                    </div>
                    <div className="text-xl font-bold">{subscription?.amount}/month</div>
                  </div>
                  
                  <div className="flex items-center mt-2">
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                      subscription?.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {subscription?.status === 'active' ? 'Active' : 'Pending'}
                    </div>
                  </div>
                  

                </>
              )}
            </CardContent>
          </Card>

          {/* Billing History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Receipt className="mr-2 h-5 w-5" />
                Billing History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-500">No billing history available</h3>
                <p className="text-sm text-gray-400 mt-1">
                  Your billing history will appear here once you've made your first payment
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardSidebar>
  );
}