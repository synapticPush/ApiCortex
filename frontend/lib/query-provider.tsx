"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState } from "react";

/**
 * Provides a stable React Query client for the app runtime.
 *
 * Defaults are tuned for dashboard workflows to reduce refetch churn
 * while keeping near-real-time screens responsive.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 30 * 60 * 1000,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
