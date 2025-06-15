import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface User {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  fullName: string;
  companyId: number;
  role: string;
  avatarUrl: string | null;
  avatarColor: string | null;
}

// Export type for reuse
export type UserType = User;

// Export as a named function instead of a default export for compatibility with Fast Refresh
export const useUser = () => {
  const { data: user, isLoading, error } = useQuery({
    queryKey: ['/api/user'],
    queryFn: () => apiRequest<User>('/api/user')
  });

  return {
    user,
    isLoading,
    error,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
  };
};