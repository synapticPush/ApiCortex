"use client";
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { DashboardMetrics } from "@/lib/api-types";
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
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiCount, setApiCount] = useState<number>(0);
  const [endpointCount, setEndpointCount] = useState<number>(0);
  useEffect(() => {
    fetchDashboardData();
  }, []);
  const fetchDashboardData = async () => {
    try {
      const response = await apiClient.get<DashboardMetrics>(
        "/dashboard/summary?window_hours=24",
      );
      setMetrics(response.data);
      const apisResponse = await apiClient.get("/apis");
      const apis = apisResponse.data;
      setApiCount(apis.length);
      const endpointCounts = await Promise.all(
        apis.map(async (api: { id: string }) => {
          try {
            const endpointsRes = await apiClient.get(
              `/apis/${api.id}/endpoints`,
            );
            return endpointsRes.data.length;
          } catch (e) {
            console.error(e);
            return 0;
          }
        }),
      );
      setEndpointCount(endpointCounts.reduce((sum, count) => sum + count, 0));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
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
              {metrics?.p95_latency_ms.toFixed(1)} ms
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
              {metrics?.request_count.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>
      <div>
        <h2 className="text-xl font-bold text-[#E6EAF2] mb-4 tracking-tight">
          Upcoming Features
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-gradient-to-b from-[#161A23] to-[#0F1117] border-[#242938] overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-tr from-[#5B5DFF]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardHeader>
              <FlaskConical className="w-8 h-8 text-[#5B5DFF] mb-2" />
              <CardTitle className="text-lg text-[#E6EAF2]">
                ML Predictions
              </CardTitle>
              <CardDescription className="text-[#9AA3B2]">
                Predict API failures before they happen using our advanced
                machine learning engine.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="inline-block px-3 py-1 rounded-full bg-[#5B5DFF]/20 text-[#5B5DFF] text-xs font-semibold uppercase tracking-wider border border-[#5B5DFF]/30">
                Coming Soon
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-b from-[#161A23] to-[#0F1117] border-[#242938] overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-tr from-[#00C2A8]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardHeader>
              <BarChart3 className="w-8 h-8 text-[#00C2A8] mb-2" />
              <CardTitle className="text-lg text-[#E6EAF2]">
                API Telemetry
              </CardTitle>
              <CardDescription className="text-[#9AA3B2]">
                Deep visibility into endpoint latency, error rates, and traffic
                patterns.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="inline-block px-3 py-1 rounded-full bg-[#00C2A8]/20 text-[#00C2A8] text-xs font-semibold uppercase tracking-wider border border-[#00C2A8]/30">
                Coming Soon
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-b from-[#161A23] to-[#0F1117] border-[#242938] overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-tr from-[#F5B74F]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardHeader>
              <AlertTriangle className="w-8 h-8 text-[#F5B74F] mb-2" />
              <CardTitle className="text-lg text-[#E6EAF2]">
                Smart Alerts
              </CardTitle>
              <CardDescription className="text-[#9AA3B2]">
                Get notified about contract drifts and latency degradation over
                Slack and PagerDuty.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="inline-block px-3 py-1 rounded-full bg-[#F5B74F]/20 text-[#F5B74F] text-xs font-semibold uppercase tracking-wider border border-[#F5B74F]/30">
                Coming Soon
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
