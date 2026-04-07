"use client";
import { useMemo } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { DashboardMetrics } from "@/lib/api-types";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Activity,
  Network,
  FlaskConical,
  AlertTriangle,
  BarChart3,
  Database,
  ArrowUpRight,
  CircleDot,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
export default function DashboardPage() {
  const metricsQuery = useQuery({
    queryKey: ["dashboard-summary", 24],
    queryFn: async () => {
      const response = await apiClient.get<DashboardMetrics>(
        "/dashboard/summary?window_hours=24",
      );
      return response.data;
    },
    staleTime: 2 * 60 * 1000,
  });

  const apisQuery = useQuery({
    queryKey: ["apis-list"],
    queryFn: async () => {
      const response = await apiClient.get<Array<{ id: string }>>("/apis");
      return response.data;
    },
    staleTime: 2 * 60 * 1000,
  });

  const endpointCountQuery = useQuery({
    queryKey: [
      "apis-endpoint-count",
      (apisQuery.data ?? []).map((api) => api.id).join(","),
    ],
    queryFn: async () => {
      const apis = apisQuery.data ?? [];
      const endpointCounts = await Promise.all(
        apis.map(async (api) => {
          try {
            const endpointsRes = await apiClient.get<Array<unknown>>(
              `/apis/${api.id}/endpoints`,
            );
            return endpointsRes.data.length;
          } catch {
            return 0;
          }
        }),
      );
      return endpointCounts.reduce((sum, count) => sum + count, 0);
    },
    enabled: !!apisQuery.data,
    staleTime: 2 * 60 * 1000,
  });

  const metrics = metricsQuery.data ?? null;
  const apiCount = apisQuery.data?.length ?? 0;
  const endpointCount = endpointCountQuery.data ?? 0;
  const loading =
    metricsQuery.isLoading ||
    apisQuery.isLoading ||
    endpointCountQuery.isLoading;

  const latencyText = useMemo(() => {
    if (typeof metrics?.p95_latency_ms !== "number") {
      return "0.0 ms";
    }
    return `${metrics.p95_latency_ms.toFixed(1)} ms`;
  }, [metrics]);

  const requestCountText = useMemo(() => {
    if (typeof metrics?.request_count !== "number") {
      return "0";
    }
    return metrics.request_count.toLocaleString();
  }, [metrics]);

  const liveStatus = useMemo(() => {
    const errorRate = (metrics?.error_rate ?? 0) * 100;
    const latency = metrics?.p95_latency_ms ?? 0;
    if (errorRate > 4 || latency > 700) {
      return {
        label: "Degraded",
        tone: "text-[#FF5C5C] border-[#FF5C5C]/25 bg-[#FF5C5C]/10",
      };
    }
    if (errorRate > 2 || latency > 450) {
      return {
        label: "Warning",
        tone: "text-[#F5B74F] border-[#F5B74F]/25 bg-[#F5B74F]/10",
      };
    }
    return {
      label: "Healthy",
      tone: "text-[#00C2A8] border-[#00C2A8]/25 bg-[#00C2A8]/10",
    };
  }, [metrics]);

  const modules = [
    {
      name: "ML Predictions",
      description:
        "Run risk forecasting and review top contributing features per endpoint.",
      href: "/predictions",
      icon: FlaskConical,
      tone: "bg-[#5B5DFF]/20 text-[#5B5DFF] border-[#5B5DFF]/30",
      halo: "from-[#5B5DFF]/10",
    },
    {
      name: "API Telemetry",
      description:
        "Inspect traffic, latency profiles, and error-rate behavior live.",
      href: "/telemetry",
      icon: BarChart3,
      tone: "bg-[#00C2A8]/20 text-[#00C2A8] border-[#00C2A8]/30",
      halo: "from-[#00C2A8]/10",
    },
    {
      name: "Smart Alerts",
      description:
        "Manage notification policy and team response workflow in settings.",
      href: "/settings",
      icon: AlertTriangle,
      tone: "bg-[#F5B74F]/20 text-[#F5B74F] border-[#F5B74F]/30",
      halo: "from-[#F5B74F]/10",
    },
  ];

  if (loading) {
    return (
      <div className="w-full space-y-8 animate-in fade-in duration-300">
        <div className="space-y-2">
          <Skeleton className="h-10 w-56 bg-[#242938]" />
          <Skeleton className="h-4 w-80 bg-[#161A23]" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton
              key={index}
              className="h-28 w-full rounded-xl bg-[#161A23] border border-[#242938]"
            />
          ))}
        </div>
        <div className="space-y-4 pt-4">
          <Skeleton className="h-8 w-52 bg-[#242938]" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton
                key={index}
                className="h-56 w-full rounded-xl bg-[#161A23] border border-[#242938]"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="w-full space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[#E6EAF2] tracking-tight">
          Dashboard
        </h1>
        <p className="text-[#9AA3B2] mt-1">
          Overview of your API health and predictions.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-[#161A23]/80 backdrop-blur-sm border-[#242938] transition-all hover:translate-y-[-2px] hover:shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-[#9AA3B2]">
              Total APIs
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-[#5B5DFF]/10 flex items-center justify-center">
              <Network className="w-4 h-4 text-[#5B5DFF]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#E6EAF2]">{apiCount}</div>
          </CardContent>
        </Card>
        <Card className="bg-[#161A23]/80 backdrop-blur-sm border-[#242938] transition-all hover:translate-y-[-2px] hover:shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-[#9AA3B2]">
              Total Endpoints
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-[#00C2A8]/10 flex items-center justify-center">
              <Database className="w-4 h-4 text-[#00C2A8]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#E6EAF2]">
              {endpointCount}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#161A23]/80 backdrop-blur-sm border-[#242938] transition-all hover:translate-y-[-2px] hover:shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-[#9AA3B2]">
              P95 Latency
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-[#5B5DFF]/10 flex items-center justify-center">
              <Activity className="w-4 h-4 text-[#5B5DFF]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#E6EAF2]">
              {latencyText}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#161A23]/80 backdrop-blur-sm border-[#242938] transition-all hover:translate-y-[-2px] hover:shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-[#9AA3B2]">
              Error Rate
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-[#F5B74F]/10 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-[#F5B74F]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#E6EAF2]">
              {((metrics?.error_rate ?? 0) * 100).toFixed(2)}%
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#161A23]/80 backdrop-blur-sm border-[#242938] transition-all hover:translate-y-[-2px] hover:shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-[#9AA3B2]">
              Total Requests
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-[#00C2A8]/10 flex items-center justify-center">
              <Activity className="w-4 h-4 text-[#00C2A8]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#E6EAF2]">
              {requestCountText}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-[#141824] border-[#242938]">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider text-[#9AA3B2]">
                Platform Health
              </p>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${liveStatus.tone}`}
              >
                <CircleDot className="w-3 h-3" />
                {liveStatus.label}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#141824] border-[#242938]">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider text-[#9AA3B2]">
                Endpoints / API
              </p>
              <p className="text-xl font-bold text-[#E6EAF2]">
                {(endpointCount / Math.max(apiCount, 1)).toFixed(1)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#141824] border-[#242938]">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider text-[#9AA3B2]">
                Signal Window
              </p>
              <p className="text-xl font-bold text-[#E6EAF2]">Last 24h</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-xl font-bold text-[#E6EAF2] mb-4 tracking-tight">
          Live Modules
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {modules.map((module) => (
            <Card
              key={module.name}
              className="bg-gradient-to-b from-[#161A23] to-[#0F1117] border-[#242938] overflow-hidden relative group"
            >
              <div
                className={`absolute inset-0 bg-gradient-to-tr ${module.halo} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
              />
              <CardHeader>
                <module.icon className="w-8 h-8 mb-2" />
                <CardTitle className="text-lg text-[#E6EAF2]">
                  {module.name}
                </CardTitle>
                <CardDescription className="text-[#9AA3B2]">
                  {module.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-3">
                <div
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border ${module.tone}`}
                >
                  Live
                </div>
                <Link
                  href={module.href}
                  prefetch
                  className="inline-flex items-center gap-1 text-sm text-[#E6EAF2] hover:text-white transition-colors"
                >
                  Open
                  <ArrowUpRight className="w-4 h-4" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
