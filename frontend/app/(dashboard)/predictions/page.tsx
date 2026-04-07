"use client";

import { useMemo, useState } from "react";
import {
  FlaskConical,
  AlertTriangle,
  ShieldAlert,
  Cpu,
  Filter,
  Layers,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";

interface PredictionFeature {
  name: string;
  value: number;
  contribution: number;
}

interface PredictionRecordOut {
  time: string;
  api_id: string;
  endpoint: string;
  method?: string;
  risk_score: number;
  prediction: string;
  confidence: number;
  top_features: PredictionFeature[];
}

interface PredictionGroup {
  id: string;
  apiId: string;
  endpoint: string;
  totalEvents: number;
  latestAt: string;
  latestPrediction: string;
  latestConfidence: number;
  avgConfidence: number;
  avgRisk: number;
  maxRisk: number;
  criticalEvents: number;
  warningEvents: number;
  stableEvents: number;
  topFeatures: PredictionFeature[];
  recentEvents: PredictionRecordOut[];
}

type RiskFilter = "all" | "critical" | "warning" | "stable";

export default function PredictionsPage() {
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [now] = useState(() => Date.now());
  const predictionsQuery = useQuery({
    queryKey: ["predictions"],
    queryFn: async () => {
      const response =
        await apiClient.get<PredictionRecordOut[]>("/predictions");
      return response.data;
    },
    staleTime: 2 * 60 * 1000,
  });

  const data = useMemo(
    () => predictionsQuery.data ?? [],
    [predictionsQuery.data],
  );
  const loading = predictionsQuery.isLoading;
  const error = predictionsQuery.error
    ? predictionsQuery.error instanceof Error
      ? predictionsQuery.error.message
      : "Failed to load prediction data."
    : null;

  const getTimestamp = (isoString: string) => {
    const timestamp = new Date(isoString).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
  };

  const getRelativeTime = (isoString: string) => {
    const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
    const diff = getTimestamp(isoString) - now;
    const absDiff = Math.abs(diff);
    if (absDiff < 1000 * 60 * 60) {
      return rtf.format(Math.round(diff / (1000 * 60)), "minute");
    }
    if (absDiff < 1000 * 60 * 60 * 24) {
      return rtf.format(Math.round(diff / (1000 * 60 * 60)), "hour");
    }
    return rtf.format(Math.round(diff / (1000 * 60 * 60 * 24)), "day");
  };

  const getRiskTone = (score: number) => {
    if (score >= 0.8) {
      return {
        bar: "bg-[#FF5C5C]",
        badge: "text-[#FF5C5C] border-[#FF5C5C]/20 bg-[#FF5C5C]/10",
        label: "Critical",
      };
    }
    if (score >= 0.5) {
      return {
        bar: "bg-[#F5B74F]",
        badge: "text-[#F5B74F] border-[#F5B74F]/20 bg-[#F5B74F]/10",
        label: "Warning",
      };
    }
    return {
      bar: "bg-[#00C2A8]",
      badge: "text-[#00C2A8] border-[#00C2A8]/20 bg-[#00C2A8]/10",
      label: "Stable",
    };
  };

  const groupedPredictions = useMemo<PredictionGroup[]>(() => {
    const grouped = new Map<string, PredictionRecordOut[]>();
    for (const item of data) {
      const key = `${item.api_id}::${item.endpoint}`;
      const items = grouped.get(key) || [];
      items.push(item);
      grouped.set(key, items);
    }

    return Array.from(grouped.entries())
      .map(([key, records]) => {
        const sorted = [...records].sort(
          (a, b) => getTimestamp(b.time) - getTimestamp(a.time),
        );
        const latest = sorted[0];
        const totalRisk = sorted.reduce(
          (sum, record) => sum + record.risk_score,
          0,
        );
        const totalConfidence = sorted.reduce(
          (sum, record) => sum + record.confidence,
          0,
        );
        const maxRisk = sorted.reduce(
          (currentMax, record) => Math.max(currentMax, record.risk_score),
          0,
        );

        return {
          id: key,
          apiId: latest.api_id,
          endpoint: latest.endpoint,
          totalEvents: sorted.length,
          latestAt: latest.time,
          latestPrediction: latest.prediction,
          latestConfidence: latest.confidence,
          avgConfidence: totalConfidence / sorted.length,
          avgRisk: totalRisk / sorted.length,
          maxRisk,
          criticalEvents: sorted.filter((record) => record.risk_score >= 0.8)
            .length,
          warningEvents: sorted.filter(
            (record) => record.risk_score >= 0.5 && record.risk_score < 0.8,
          ).length,
          stableEvents: sorted.filter((record) => record.risk_score < 0.5)
            .length,
          topFeatures: latest.top_features || [],
          recentEvents: sorted.slice(0, 3),
        };
      })
      .sort((a, b) => {
        if (b.maxRisk !== a.maxRisk) {
          return b.maxRisk - a.maxRisk;
        }
        return getTimestamp(b.latestAt) - getTimestamp(a.latestAt);
      });
  }, [data]);

  const filteredGroups = useMemo(() => {
    return groupedPredictions.filter((group) => {
      if (riskFilter === "critical") {
        return group.maxRisk >= 0.8;
      }
      if (riskFilter === "warning") {
        return group.maxRisk >= 0.5 && group.maxRisk < 0.8;
      }
      if (riskFilter === "stable") {
        return group.maxRisk < 0.5;
      }
      return true;
    });
  }, [groupedPredictions, riskFilter]);

  const totalSignals = filteredGroups.reduce(
    (sum, group) => sum + group.totalEvents,
    0,
  );
  const criticalGroups = filteredGroups.filter(
    (group) => group.maxRisk >= 0.8,
  ).length;
  const averageRisk =
    filteredGroups.length > 0
      ? filteredGroups.reduce((sum, group) => sum + group.avgRisk, 0) /
        filteredGroups.length
      : 0;

  if (loading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-9 w-64 bg-[#242938]" />
            <Skeleton className="h-4 w-96 bg-[#161A23]" />
          </div>
          <Skeleton className="h-9 w-36 bg-[#161A23] border border-[#242938]" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton
              key={index}
              className="h-28 w-full rounded-xl bg-[#161A23] border border-[#242938]"
            />
          ))}
        </div>
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton
              key={index}
              className="h-72 w-full rounded-xl bg-[#161A23] border border-[#242938]"
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
            Failed to load Predictions
          </h2>
          <p className="text-[#9AA3B2] mt-2">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#E6EAF2] mb-1 tracking-tight flex items-center gap-2">
            <FlaskConical className="w-6 h-6 text-[#5B5DFF]" />
            ML Failure Predictions
          </h1>
          <p className="text-[#9AA3B2] text-sm">
            Advanced machine learning engine predicting API downtime before it
            happens.
          </p>
        </div>
        <Badge
          variant="outline"
          className="bg-[#5B5DFF]/10 text-[#5B5DFF] border-[#5B5DFF]/20 px-3 py-1"
        >
          <Cpu className="w-4 h-4 mr-2" />
          Models Active
        </Badge>
      </div>

      {data.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-[#161A23]/50 backdrop-blur-sm border-[#242938]">
            <CardContent className="py-5">
              <p className="text-xs uppercase tracking-wide text-[#9AA3B2]">
                Grouped Endpoints
              </p>
              <p className="text-3xl font-semibold text-[#E6EAF2] mt-2">
                {filteredGroups.length}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-[#161A23]/50 backdrop-blur-sm border-[#242938]">
            <CardContent className="py-5">
              <p className="text-xs uppercase tracking-wide text-[#9AA3B2]">
                Total Signals
              </p>
              <p className="text-3xl font-semibold text-[#E6EAF2] mt-2">
                {totalSignals}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-[#161A23]/50 backdrop-blur-sm border-[#242938]">
            <CardContent className="py-5">
              <p className="text-xs uppercase tracking-wide text-[#9AA3B2]">
                Critical Endpoints
              </p>
              <p className="text-3xl font-semibold text-[#FF5C5C] mt-2">
                {criticalGroups}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {data.length > 0 && (
        <Card className="bg-[#161A23]/50 backdrop-blur-sm border-[#242938]">
          <CardContent className="py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-[#9AA3B2]">
              Average group risk:
              <span className="text-[#E6EAF2] font-semibold ml-2">
                {(averageRisk * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-[#9AA3B2]" />
              <Select
                value={riskFilter}
                onValueChange={(value) => setRiskFilter(value as RiskFilter)}
              >
                <SelectTrigger className="w-48 bg-[#0F1117] border-[#242938] text-[#E6EAF2]">
                  <SelectValue placeholder="Filter risk" />
                </SelectTrigger>
                <SelectContent className="bg-[#161A23] border-[#242938] text-[#E6EAF2]">
                  <SelectItem value="all">All Risk Bands</SelectItem>
                  <SelectItem value="critical">Critical (80%+)</SelectItem>
                  <SelectItem value="warning">Warning (50-79%)</SelectItem>
                  <SelectItem value="stable">Stable (&lt;50%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {data.length === 0 ? (
        <Card className="bg-[#161A23]/50 backdrop-blur-sm border-[#242938]">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ShieldAlert className="w-12 h-12 text-[#00C2A8] mb-4 opacity-70" />
            <h3 className="text-lg font-medium text-[#E6EAF2]">
              No imminent failures detected
            </h3>
            <p className="text-[#9AA3B2] mt-2 max-w-md text-center">
              Your APIs look healthy! Our ML models are constantly monitoring
              traffic patterns for anomalies.
            </p>
          </CardContent>
        </Card>
      ) : filteredGroups.length === 0 ? (
        <Card className="bg-[#161A23]/50 backdrop-blur-sm border-[#242938]">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <Layers className="w-10 h-10 text-[#9AA3B2] mb-3" />
            <h3 className="text-lg font-medium text-[#E6EAF2]">
              No endpoint groups in this filter
            </h3>
            <p className="text-[#9AA3B2] mt-2 max-w-lg">
              Adjust the risk filter to inspect another risk band.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredGroups.map((group) => {
            const tone = getRiskTone(group.maxRisk);
            return (
              <Card
                key={group.id}
                className="bg-[#161A23]/50 backdrop-blur-sm border-[#242938] overflow-hidden hover:border-[#5B5DFF]/30 transition-colors"
              >
                <div className={`h-1 w-full ${tone.bar}`} />
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap justify-between gap-3 items-start">
                    <div className="min-w-0">
                      <CardTitle
                        className="text-lg font-medium text-[#E6EAF2] font-mono truncate"
                        title={group.endpoint}
                      >
                        {group.endpoint}
                      </CardTitle>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#9AA3B2]">
                        <Badge
                          variant="outline"
                          className="bg-[#242938] border-[#2D3346] text-[#B7C0D1] font-mono"
                        >
                          {group.apiId.slice(0, 8)}
                        </Badge>
                        <span>{group.totalEvents} signals</span>
                        <span>{getRelativeTime(group.latestAt)}</span>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`font-mono ${tone.badge}`}
                    >
                      {tone.label} {(group.maxRisk * 100).toFixed(0)}%
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="rounded-lg border border-[#242938] bg-[#0F1117]/60 px-3 py-2">
                      <p className="text-xs text-[#9AA3B2]">Average Risk</p>
                      <p className="text-sm font-semibold text-[#E6EAF2]">
                        {(group.avgRisk * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div className="rounded-lg border border-[#242938] bg-[#0F1117]/60 px-3 py-2">
                      <p className="text-xs text-[#9AA3B2]">Avg Confidence</p>
                      <p className="text-sm font-semibold text-[#E6EAF2]">
                        {(group.avgConfidence * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div className="rounded-lg border border-[#242938] bg-[#0F1117]/60 px-3 py-2">
                      <p className="text-xs text-[#9AA3B2]">Critical Events</p>
                      <p className="text-sm font-semibold text-[#FF5C5C]">
                        {group.criticalEvents}
                      </p>
                    </div>
                    <div className="rounded-lg border border-[#242938] bg-[#0F1117]/60 px-3 py-2">
                      <p className="text-xs text-[#9AA3B2]">Stable Events</p>
                      <p className="text-sm font-semibold text-[#00C2A8]">
                        {group.stableEvents}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-[#242938] bg-[#0F1117]/60 p-3">
                    <div className="text-sm font-medium text-[#E6EAF2] flex items-center gap-2 mb-1">
                      <AlertTriangle
                        className={`w-4 h-4 ${group.maxRisk >= 0.8 ? "text-[#FF5C5C]" : "text-[#F5B74F]"}`}
                      />
                      {group.latestPrediction}
                    </div>
                    <p className="text-xs text-[#9AA3B2]">
                      Latest confidence{" "}
                      <span className="text-[#E6EAF2] font-semibold">
                        {(group.latestConfidence * 100).toFixed(1)}%
                      </span>{" "}
                      inference {getRelativeTime(group.latestAt)}.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="rounded-lg border border-[#242938] bg-[#0F1117]/60 p-3">
                      <h4 className="text-xs font-semibold text-[#9AA3B2] uppercase tracking-wider mb-3">
                        Top Features
                      </h4>
                      <div className="space-y-2">
                        {group.topFeatures.slice(0, 3).map((feature, index) => (
                          <div
                            key={`${feature.name}-${index}`}
                            className="space-y-1"
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-[#E6EAF2] font-mono truncate pr-2">
                                {feature.name}
                              </span>
                              <span className="text-[#9AA3B2] font-mono">
                                {feature.value.toFixed(2)}
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-[#1E232E] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-linear-to-r from-[#5B5DFF] to-[#3A8DFF] rounded-full"
                                style={{
                                  width: `${Math.min(100, Math.max(0, feature.contribution * 100))}%`,
                                }}
                              />
                            </div>
                          </div>
                        ))}
                        {group.topFeatures.length === 0 && (
                          <span className="text-sm text-[#9AA3B2] italic">
                            Black-box inference applied
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg border border-[#242938] bg-[#0F1117]/60 p-3">
                      <h4 className="text-xs font-semibold text-[#9AA3B2] uppercase tracking-wider mb-3">
                        Recent Events
                      </h4>
                      <div className="space-y-2">
                        {group.recentEvents.map((event, index) => {
                          const eventTone = getRiskTone(event.risk_score);
                          return (
                            <div
                              key={`${event.time}-${index}`}
                              className="flex items-center justify-between rounded-md border border-[#242938] px-3 py-2"
                            >
                              <span className="text-xs text-[#9AA3B2]">
                                {getRelativeTime(event.time)}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-[11px] ${eventTone.badge}`}
                              >
                                {(event.risk_score * 100).toFixed(0)}%
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-[#9AA3B2]">
                    <span>Critical: {group.criticalEvents}</span>
                    <span>Warning: {group.warningEvents}</span>
                    <span>Stable: {group.stableEvents}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
