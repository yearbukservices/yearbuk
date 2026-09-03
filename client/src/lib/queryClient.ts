import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    // Keep a readable copy for callers that need structured error details
    // such as the email-verification redirect metadata.
    const response = res.clone();
    const text = (await res.text()) || res.statusText;
    const error = new Error(`${res.status}: ${text}`) as Error & {
      response: Response;
    };
    error.response = response;
    throw error;
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Get user data from localStorage to include user ID in authorization header
  const userData = localStorage.getItem("user");
  const storedUser = userData ? JSON.parse(userData) : null;
  const userId = storedUser?.id || null;
  const authVersion = storedUser?.authVersion;
  
  const headers: Record<string, string> = {};
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  const isPublicAuthRequest = url === "/api/auth/login";
  if (userId && !isPublicAuthRequest) {
    headers["Authorization"] = `Bearer ${userId}`;
    if (authVersion !== undefined) headers["X-Auth-Version"] = String(authVersion);
  }

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const userData = localStorage.getItem("user");
    const storedUser = userData ? JSON.parse(userData) : null;
    const userId = storedUser?.id || null;
    const authVersion = storedUser?.authVersion;
    
    const headers: Record<string, string> = {};
    if (userId) {
      headers["Authorization"] = `Bearer ${userId}`;
      if (authVersion !== undefined) headers["X-Auth-Version"] = String(authVersion);
    }

    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
      headers,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
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
