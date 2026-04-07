import axios from "axios";
import { toast } from "sonner";

const tunnelBaseURL =
  process.env.NEXT_PUBLIC_TUNNEL_API_URL ||
  "https://apicortex-cp.0xarchit.is-a.dev";

const isLocalHost = (hostname: string) => {
  const normalized = hostname.trim().toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1"
  );
};

const resolveBaseURL = () => {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host && !isLocalHost(host)) {
      return tunnelBaseURL;
    }
  }

  const configured = (process.env.NEXT_PUBLIC_API_URL || "").trim();
  if (configured) {
    return configured;
  }
  return "http://localhost:8000";
};

const baseURL = resolveBaseURL();
export const apiClient = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

let refreshPromise: Promise<void> | null = null;

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const clearAuthCookies = () => {
  document.cookie =
    "acx_access=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  document.cookie =
    "acx_refresh=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  document.cookie = "acx_csrf=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
};

const getCookieValue = (name: string): string | null => {
  const cookies = document.cookie.split("; ");
  const found = cookies.find((row) => row.startsWith(`${name}=`));
  if (!found) {
    return null;
  }
  return found.split("=").slice(1).join("=");
};

const refreshAuth = async () => {
  if (!refreshPromise) {
    refreshPromise = apiClient
      .post("/auth/refresh")
      .then(() => undefined)
      .finally(() => {
        refreshPromise = null;
      });
  }
  await refreshPromise;
};

const refreshAuthWithRetry = async () => {
  const delays = [0, 200, 600];
  let lastError: unknown;

  for (const delay of delays) {
    if (delay > 0) {
      await wait(delay);
    }
    try {
      await refreshAuth();
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
};

apiClient.interceptors.request.use((config) => {
  if (
    ["post", "put", "patch", "delete"].includes(
      config.method?.toLowerCase() || "",
    )
  ) {
    if (typeof document !== "undefined") {
      const csrfCookie = getCookieValue("acx_csrf");
      if (csrfCookie) {
        config.headers["X-CSRF-Token"] = decodeURIComponent(csrfCookie);
      }
    }
  }
  return config;
});
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as typeof error.config & {
      _retry?: boolean;
    };

    if (error.response?.status === 401) {
      if (typeof window !== "undefined") {
        const isRefreshCall = String(originalRequest?.url || "").includes(
          "/auth/refresh",
        );
        if (!isRefreshCall && !originalRequest?._retry) {
          originalRequest._retry = true;
          try {
            await refreshAuthWithRetry();
            return apiClient(originalRequest);
          } catch {
            clearAuthCookies();
            window.location.href = "/login";
            return Promise.reject(error);
          }
        }
        clearAuthCookies();
        window.location.href = "/login";
      }
    } else if (error.response?.status === 403) {
      if (typeof window !== "undefined") toast.error("Permission denied.");
    } else if (error.response?.status === 404) {
      if (typeof window !== "undefined") toast.error("Resource not found.");
    } else if (error.response?.status === 409) {
      if (typeof window !== "undefined")
        toast.error("Conflict: duplicate resource.");
    } else if (error.response?.status >= 500) {
      if (typeof window !== "undefined") toast.error("Server error.");
    }
    return Promise.reject(error);
  },
);
