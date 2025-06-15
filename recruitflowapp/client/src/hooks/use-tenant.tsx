import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './use-auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from './use-toast';
import { Company } from '@shared/schema';

// Define the tenant context type
type TenantContextType = {
  availableTenants: Company[];
  currentTenant: Company | null;
  isLoading: boolean;
  error: Error | null;
  switchTenant: (tenantId: number) => Promise<void>;
};

// Create the tenant context
export const TenantContext = createContext<TenantContextType | null>(null);

// Create the tenant provider component
export function TenantProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [currentTenant, setCurrentTenant] = useState<Company | null>(null);

  // Query to fetch available tenants for the current user
  const {
    data: availableTenants = [] as Company[],
    isLoading,
    error,
  } = useQuery<Company[]>({
    queryKey: ['/api/tenants'],
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Mutation to switch tenant
  const switchTenantMutation = useMutation<Company, Error, number>({
    mutationFn: async (tenantId: number) => {
      const response = await apiRequest('POST', '/api/tenants/switch', { tenantId });
      if (!response.ok) {
        throw new Error('Failed to switch tenant');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setCurrentTenant(data);
      // Invalidate all queries to refresh data for the new tenant
      queryClient.invalidateQueries();
      
      toast({
        title: "Tenant switched",
        description: `You are now working in ${data.name}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to switch tenant",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Set current tenant when user loads or changes
  useEffect(() => {
    if (user && availableTenants && availableTenants.length > 0) {
      // Default to the user's primary company
      const userCompany = availableTenants.find((tenant) => tenant.id === user.companyId);
      if (userCompany && !currentTenant) {
        setCurrentTenant(userCompany);
      }
    } else if (!user) {
      setCurrentTenant(null);
    }
  }, [user, availableTenants, currentTenant]);

  // Function to switch tenant
  const switchTenant = async (tenantId: number) => {
    await switchTenantMutation.mutateAsync(tenantId);
  };

  return (
    <TenantContext.Provider
      value={{
        availableTenants,
        currentTenant,
        isLoading,
        error: error as Error | null,
        switchTenant,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

// Hook to use the tenant context
export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}