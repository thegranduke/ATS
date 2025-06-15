import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  options?: {
    headers?: Record<string, string>;
  }
): Promise<Response> {
  console.log(`API Request: ${method} ${url}`, data);
  
  try {
    const res = await fetch(url, {
      method,
      headers: {
        ...(data && method !== 'GET' ? { "Content-Type": "application/json" } : {}),
        ...(options?.headers || {})
      },
      body: data && method !== 'GET' ? JSON.stringify(data) : undefined,
      credentials: "include",
    });
    
    console.log(`API Response: Status ${res.status} from ${method} ${url}`);
    
    // Clone the response to allow reading it multiple times
    const resClone = res.clone();
    
    try {
      // Try to log response body as JSON if possible
      const responseText = await resClone.text();
      console.log('Response body:', responseText);
      
      if (responseText) {
        try {
          console.log('Parsed response:', JSON.parse(responseText));
        } catch (e) {
          console.log('Not a JSON response');
        }
      }
    } catch (e) {
      console.log('Could not read response body for logging', e);
    }
    
    await throwIfResNotOk(res);
    return res;
  } catch (error) {
    console.error(`API Request Failed: ${method} ${url}`, error);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    try {
      const res = await apiRequest("GET", queryKey[0] as string);
      
      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }
      
      return await res.json();
    } catch (error) {
      if (unauthorizedBehavior === "returnNull" && error instanceof Error && error.message.startsWith("401:")) {
        return null;
      }
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
