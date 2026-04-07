"use client";

import { BarChart3, Clock, AlertTriangle, Activity } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";

interface TelemetryEndpointStatsOut {
  endpoint: string;
  method: string;
  request_count: number;
  error_rate: number;
  p95_latency_ms: number;
}

export default function TelemetryPage() {
  const telemetryQuery = useQuery({
    queryKey: ["telemetry-endpoints"],
    queryFn: async () => {
      const response = await apiClient.get<TelemetryEndpointStatsOut[]>(
        "/telemetry/endpoints",
      );
      return response.data;
    },
    staleTime: 2 * 60 * 1000,
  });

  const data = telemetryQuery.data ?? [];
  const loading = telemetryQuery.isLoading;
  const error = telemetryQuery.error
    ? telemetryQuery.error instanceof Error
      ? telemetryQuery.error.message
      : "Failed to load telemetry data."
    : null;

  const getMethodColor = (method: string) => {
    switch (method) {
      case "GET":
        return "bg-[#00C2A8]/10 text-[#00C2A8] border-[#00C2A8]/20";
      case "POST":
        return "bg-[#5B5DFF]/10 text-[#5B5DFF] border-[#5B5DFF]/20";
      case "PUT":
        return "bg-[#F5B74F]/10 text-[#F5B74F] border-[#F5B74F]/20";
      case "DELETE":
        return "bg-[#FF5C5C]/10 text-[#FF5C5C] border-[#FF5C5C]/20";
      case "PATCH":
        return "bg-[#3A8DFF]/10 text-[#3A8DFF] border-[#3A8DFF]/20";
      default:
        return "bg-[#242938] text-[#E6EAF2] border-[#242938]";
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="space-y-2">
          <Skeleton className="h-9 w-56 bg-[#242938]" />
          <Skeleton className="h-4 w-96 bg-[#161A23]" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton
              key={index}
              className="h-32 w-full rounded-xl bg-[#161A23] border border-[#242938]"
            />
          ))}
        </div>
        <div className="bg-[#161A23]/50 border border-[#242938] rounded-xl p-4 space-y-3">
          <Skeleton className="h-6 w-52 bg-[#242938]" />
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton
              key={index}
              className="h-11 w-full bg-[#0F1117] border border-[#242938] rounded-lg"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[calc(100vh-8rem)] w-full flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-[#FF5C5C] mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-[#E6EAF2]">
            Failed to load Telemetry
          </h2>
          <p className="text-[#9AA3B2] mt-2">{error}</p>
        </div>
      </div>
    );
  }

  const totalRequests = data.reduce((acc, curr) => acc + curr.request_count, 0);
  const avgErrorRate =
    data.length > 0
      ? data.reduce((acc, curr) => acc + curr.error_rate, 0) / data.length
      : 0;
  const avgLatency =
    data.length > 0
      ? data.reduce((acc, curr) => acc + curr.p95_latency_ms, 0) / data.length
      : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#E6EAF2] mb-1 tracking-tight">
          API Telemetry
        </h1>
        <p className="text-[#9AA3B2] text-sm">
          Deep visibility into your API performance, endpoint latency, and
          traffic patterns.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-[#161A23]/50 backdrop-blur-sm border-[#242938]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-[#9AA3B2]">
              Total Requests (24h)
            </CardTitle>
            <Activity className="h-4 w-4 text-[#00C2A8]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[#E6EAF2]">
              {totalRequests.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#161A23]/50 backdrop-blur-sm border-[#242938]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-[#9AA3B2]">
              Avg Error Rate (24h)
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-[#FF5C5C]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[#E6EAF2]">
              {(avgErrorRate * 100).toFixed(2)}%
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#161A23]/50 backdrop-blur-sm border-[#242938]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-[#9AA3B2]">
              Avg P95 Latency
            </CardTitle>
            <Clock className="h-4 w-4 text-[#3A8DFF]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[#E6EAF2]">
              {avgLatency.toFixed(0)}{" "}
              <span className="text-sm font-normal text-[#9AA3B2]">ms</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-[#161A23]/50 backdrop-blur-sm border-[#242938] overflow-hidden">
        <CardHeader className="border-b border-[#242938] bg-[#1E232E]/50">
          <CardTitle className="text-lg font-medium text-[#E6EAF2] flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#00C2A8]" />
            Endpoint Performance
          </CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-[#242938] hover:bg-transparent">
                <TableHead className="text-[#9AA3B2] font-medium">
                  Method
                </TableHead>
                <TableHead className="text-[#9AA3B2] font-medium">
                  Endpoint
                </TableHead>
                <TableHead className="text-[#9AA3B2] font-medium text-right">
                  Traffic (24h)
                </TableHead>
                <TableHead className="text-[#9AA3B2] font-medium text-right">
                  Error Rate
                </TableHead>
                <TableHead className="text-[#9AA3B2] font-medium text-right">
                  P95 Latency
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow className="border-[#242938] hover:bg-[#1E232E]">
                  <TableCell
                    colSpan={5}
                    className="text-center py-8 text-[#9AA3B2]"
                  >
                    No telemetry data found for the selected window.
                  </TableCell>
                </TableRow>
              ) : (
                data.map((item, i) => (
                  <TableRow
                    key={i}
                    className="border-[#242938] hover:bg-[#1E232E] transition-colors"
                  >
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`font-mono ${getMethodColor(item.method)}`}
                      >
                        {item.method}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className="font-mono text-sm text-[#E6EAF2] truncate max-w-[300px]"
                      title={item.endpoint}
                    >
                      {item.endpoint}
                    </TableCell>
                    <TableCell className="text-right text-[#E6EAF2] tabular-nums font-medium">
                      {item.request_count.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <div className="flex items-center justify-end gap-2">
                        <span
                          className={
                            item.error_rate > 0.05
                              ? "text-[#FF5C5C]"
                              : "text-[#00C2A8]"
                          }
                        >
                          {(item.error_rate * 100).toFixed(2)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <div className="flex items-center justify-end gap-2 text-[#E6EAF2]">
                        {item.p95_latency_ms.toFixed(0)} ms
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
