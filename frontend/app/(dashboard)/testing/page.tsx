"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Play,
  Save,
  Plus,
  FolderTree,
  FileJson,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  TerminalSquare,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { API, ContractValidation, Endpoint } from "@/lib/api-types";

type TestResponseState = {
  status: number;
  time: string;
  size: string;
  body: string;
  headers: Record<string, string>;
  contractValidation: ContractValidation;
};

export default function TestingPage() {
  const [method, setMethod] = useState("GET");
  const [url, setUrl] = useState("https://api.acme.com/users/");
  const [isSending, setIsSending] = useState(false);
  const [response, setResponse] = useState<TestResponseState | null>(null);
  const [activeEndpoint, setActiveEndpoint] = useState<Endpoint | null>(null);

  const [domains, setDomains] = useState<(API & { endpoints?: Endpoint[] })[]>(
    [],
  );
  const [expandedCollections, setExpandedCollections] = useState<
    Record<string, boolean>
  >({});
  const [requestBody, setRequestBody] = useState(
    '{\n  "limit": 100,\n  "status": "active"\n}',
  );

  useEffect(() => {
    fetchApiData();
  }, []);

  const fetchApiData = async () => {
    try {
      const apiRes = await apiClient.get<API[]>("/apis");
      const initialDomains: (API & { endpoints?: Endpoint[] })[] = [];
      const expanded: Record<string, boolean> = {};

      for (const api of apiRes.data) {
        try {
          const eps = await apiClient.get<Endpoint[]>(
            `/apis/${api.id}/endpoints`,
          );
          initialDomains.push({ ...api, endpoints: eps.data });
        } catch {
          initialDomains.push({ ...api, endpoints: [] });
        }
        expanded[api.id] = false;
      }

      setDomains(initialDomains);
      if (initialDomains.length > 0) {
        expanded[initialDomains[0].id] = true;
      }
      setExpandedCollections(expanded);
    } catch (error) {
      console.error(error);
    }
  };

  const toggleCollection = (id: string) => {
    setExpandedCollections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const selectEndpoint = (domain: API, ep: Endpoint) => {
    setActiveEndpoint(ep);
    setMethod(ep.method);
    const cleanBase = domain.base_url.replace(new RegExp("/$"), "");
    const cleanPath = ep.path.replace(new RegExp("^/"), "");
    setUrl(`${cleanBase}/${cleanPath}`);
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case "GET":
        return "text-[#00C2A8]";
      case "POST":
        return "text-[#5B5DFF]";
      case "PUT":
        return "text-[#F5B74F]";
      case "DELETE":
        return "text-[#FF5C5C]";
      case "PATCH":
        return "text-[#3A8DFF]";
      default:
        return "text-[#E6EAF2]";
    }
  };

  const handleSend = async () => {
    setIsSending(true);
    setResponse(null);
    try {
      let parsedBody = null;
      if (method !== "GET" && method !== "DELETE" && requestBody) {
        try {
          parsedBody = JSON.parse(requestBody);
        } catch {
          parsedBody = requestBody;
        }
      }

      const res = await apiClient.post("/testing/request", {
        method,
        url,
        headers: {
          "Content-Type": "application/json",
        },
        body: parsedBody,
      });

      const proxyData = res.data;
      const respDataStr =
        typeof proxyData.body === "object"
          ? JSON.stringify(proxyData.body, null, 2)
          : String(proxyData.body || "");

      setResponse({
        status: proxyData.status,
        time: `${proxyData.time_ms}ms`,
        size: `${(proxyData.size_bytes / 1024).toFixed(2)}KB`,
        body: respDataStr,
        headers: proxyData.headers || {},
        contractValidation: proxyData.contract_validation,
      });
    } catch (error: unknown) {
      const axiosError = error as {
        response?: { status?: number; data?: unknown };
        message?: string;
      };
      const status = axiosError.response?.status || 0;
      const rawData =
        axiosError.response?.data ?? axiosError.message ?? "Request failed";
      const respDataStr =
        typeof rawData === "object"
          ? JSON.stringify(rawData, null, 2)
          : String(rawData);
      let fallbackPath = "/";
      try {
        fallbackPath = new URL(url).pathname;
      } catch {
        fallbackPath = url.startsWith("/") ? url : "/";
      }
      setResponse({
        status: status,
        time: `error`,
        size: `0KB`,
        body: respDataStr,
        headers: {},
        contractValidation: {
          status: "warning",
          endpoint_id: null,
          path: fallbackPath,
          method,
          contract_hash: null,
          observed_hash: null,
        },
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex-1 w-full flex rounded-2xl border border-[#242938] overflow-hidden shadow-2xl">
        <div className="w-[280px] shrink-0 border-r border-[#242938] bg-[#0F1117]">
          <div className="p-4 h-full flex flex-col min-w-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[#E6EAF2] uppercase tracking-wider truncate">
                Collections
              </h2>
              <Button
                variant="ghost"
                size="icon"
                className="w-6 h-6 shrink-0 text-[#9AA3B2] hover:text-[#E6EAF2]"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-1">
              {domains.map((domain) => (
                <div key={domain.id} className="group">
                  <div
                    onClick={() => toggleCollection(domain.id)}
                    className="flex items-center gap-2 text-[#E6EAF2] text-sm font-medium p-2 hover:bg-[#161A23] rounded-lg cursor-pointer transition-colors"
                  >
                    {expandedCollections[domain.id] ? (
                      <ChevronDown className="w-4 h-4 shrink-0 text-[#9AA3B2]" />
                    ) : (
                      <ChevronRight className="w-4 h-4 shrink-0 text-[#9AA3B2]" />
                    )}
                    <FolderTree className="w-4 h-4 shrink-0 text-[#3A8DFF]" />
                    <span className="truncate">{domain.name}</span>
                  </div>
                  {expandedCollections[domain.id] && domain.endpoints && (
                    <div className="pl-6 mt-1 space-y-1 mb-2">
                      {domain.endpoints.map((ep) => (
                        <div
                          key={ep.id}
                          onClick={() => selectEndpoint(domain, ep)}
                          className={`flex items-center gap-2 text-xs p-1.5 rounded-md cursor-pointer transition-colors ${activeEndpoint?.id === ep.id ? "bg-[#242938] text-[#E6EAF2]" : "text-[#9AA3B2] hover:text-[#E6EAF2] hover:bg-[#161A23]"}`}
                        >
                          <span
                            className={`font-bold w-10 shrink-0 text-right text-[10px] ${getMethodColor(ep.method)}`}
                          >
                            {ep.method}
                          </span>
                          <span className="truncate">{ep.path}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex-1 flex flex-col bg-[#161A23] min-w-0">
          <div className="p-4 border-b border-[#242938] flex gap-2 items-center bg-[#0F1117]/50 overflow-x-auto hidden-scrollbar">
            <Select
              value={method}
              onValueChange={(val) => setMethod(val || "GET")}
            >
              <SelectTrigger className="w-24 shrink-0 bg-[#161A23] border-[#242938] text-[#E6EAF2] focus:ring-[#5B5DFF] font-mono font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#161A23] border-[#242938] text-[#E6EAF2]">
                <SelectItem value="GET" className="text-[#00C2A8] font-bold">
                  GET
                </SelectItem>
                <SelectItem value="POST" className="text-[#5B5DFF] font-bold">
                  POST
                </SelectItem>
                <SelectItem value="PUT" className="text-[#F5B74F] font-bold">
                  PUT
                </SelectItem>
                <SelectItem value="PATCH" className="text-[#3A8DFF] font-bold">
                  PATCH
                </SelectItem>
                <SelectItem value="DELETE" className="text-[#FF5C5C] font-bold">
                  DELETE
                </SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1 min-w-[100px] bg-[#161A23] border-[#242938] text-[#E6EAF2] font-mono focus-visible:ring-[#5B5DFF]"
            />
            <Button
              onClick={handleSend}
              disabled={isSending}
              className="shrink-0 bg-[#5B5DFF] hover:bg-[#5B5DFF]/90 text-white gap-2 font-medium shadow-[0_0_15px_rgba(91,93,255,0.4)] transition-all min-w-[90px]"
            >
              {isSending ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Play className="w-4 h-4" /> Send
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="shrink-0 border-[#242938] text-[#9AA3B2] hover:text-[#E6EAF2] hover:bg-[#242938]"
            >
              <Save className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex-1 p-0 overflow-hidden flex flex-col min-w-0">
            <Tabs defaultValue="headers" className="h-full flex flex-col">
              <div className="border-b border-[#242938] px-4 overflow-x-auto hidden-scrollbar">
                <TabsList className="bg-transparent h-12 p-0 space-x-6 w-max">
                  <TabsTrigger
                    value="params"
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#5B5DFF] data-[state=active]:text-[#E6EAF2] text-[#9AA3B2] rounded-none py-3 px-0"
                  >
                    Params
                  </TabsTrigger>
                  <TabsTrigger
                    value="headers"
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#5B5DFF] data-[state=active]:text-[#E6EAF2] text-[#9AA3B2] rounded-none py-3 px-0"
                  >
                    Headers{" "}
                    <Badge
                      variant="secondary"
                      className="ml-2 bg-[#242938] text-xs px-1.5 h-4"
                    >
                      2
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger
                    value="body"
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#5B5DFF] data-[state=active]:text-[#E6EAF2] text-[#9AA3B2] rounded-none py-3 px-0"
                  >
                    Body
                  </TabsTrigger>
                  <TabsTrigger
                    value="auth"
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#5B5DFF] data-[state=active]:text-[#E6EAF2] text-[#9AA3B2] rounded-none py-3 px-0"
                  >
                    Auth
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent
                value="headers"
                className="flex-1 p-0 m-0 border-none outline-none overflow-auto"
              >
                <div className="w-full min-w-[400px]">
                  <div className="grid grid-cols-[30px_1fr_1fr_30px] border-b border-[#242938] bg-[#0F1117]/50 text-xs text-[#9AA3B2] font-medium">
                    <div className="p-2 border-r border-[#242938] text-center"></div>
                    <div className="p-2 border-r border-[#242938]">Key</div>
                    <div className="p-2 border-r border-[#242938]">Value</div>
                    <div className="p-2"></div>
                  </div>
                  <div className="grid grid-cols-[30px_1fr_1fr_30px] border-b border-[#242938] group">
                    <div className="p-2 border-r border-[#242938] flex items-center justify-center">
                      <input
                        type="checkbox"
                        defaultChecked
                        className="accent-[#5B5DFF]"
                      />
                    </div>
                    <input
                      type="text"
                      defaultValue="Content-Type"
                      className="p-2 border-r border-[#242938] bg-transparent text-[#E6EAF2] font-mono text-sm outline-none focus:bg-[#242938]/30 w-full"
                    />
                    <input
                      type="text"
                      defaultValue="application/json"
                      className="p-2 border-r border-[#242938] bg-transparent text-[#E6EAF2] font-mono text-sm outline-none focus:bg-[#242938]/30 w-full"
                    />
                    <div className="p-2 flex items-center justify-center">
                      <XCircle className="w-4 h-4 text-[#FF5C5C] opacity-0 group-hover:opacity-100 cursor-pointer" />
                    </div>
                  </div>
                  <div className="grid grid-cols-[30px_1fr_1fr_30px] border-b border-[#242938] group">
                    <div className="p-2 border-r border-[#242938] flex items-center justify-center">
                      <input
                        type="checkbox"
                        defaultChecked
                        className="accent-[#5B5DFF]"
                      />
                    </div>
                    <input
                      type="text"
                      defaultValue="Authorization"
                      className="p-2 border-r border-[#242938] bg-transparent text-[#E6EAF2] font-mono text-sm outline-none focus:bg-[#242938]/30 w-full"
                    />
                    <input
                      type="text"
                      defaultValue="Bearer eyJhbGc..."
                      className="p-2 border-r border-[#242938] bg-transparent text-[#E6EAF2] font-mono text-sm outline-none focus:bg-[#242938]/30 w-full text-ellipsis"
                    />
                    <div className="p-2 flex items-center justify-center">
                      <XCircle className="w-4 h-4 text-[#FF5C5C] opacity-0 group-hover:opacity-100 cursor-pointer" />
                    </div>
                  </div>
                  <div className="grid grid-cols-[30px_1fr_1fr_30px] border-b border-[#242938]">
                    <div className="p-2 border-r border-[#242938]"></div>
                    <input
                      type="text"
                      placeholder="Key"
                      className="p-2 border-r border-[#242938] bg-transparent text-[#9AA3B2] placeholder:text-[#9AA3B2]/50 font-mono text-sm outline-none focus:bg-[#242938]/30 w-full"
                    />
                    <input
                      type="text"
                      placeholder="Value"
                      className="p-2 border-r border-[#242938] bg-transparent text-[#9AA3B2] placeholder:text-[#9AA3B2]/50 font-mono text-sm outline-none focus:bg-[#242938]/30 w-full"
                    />
                    <div className="p-2"></div>
                  </div>
                </div>
              </TabsContent>
              <TabsContent
                value="body"
                className="flex-1 p-0 m-0 border-none outline-none relative bg-[#0F1117]/80"
              >
                <div className="absolute top-2 right-4 z-10">
                  <Select defaultValue="json">
                    <SelectTrigger className="h-7 text-xs bg-[#242938] border-[#242938] text-[#E6EAF2] rounded-md">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#161A23] border-[#242938] text-[#E6EAF2]">
                      <SelectItem value="json">JSON</SelectItem>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="xml">XML</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <textarea
                  className="w-full h-full bg-transparent p-4 font-mono text-sm text-[#00C2A8] outline-none resize-none leading-relaxed placeholder:text-[#9AA3B2]/50"
                  placeholder="Enter request body here..."
                  spellCheck="false"
                  value={requestBody}
                  onChange={(e) => setRequestBody(e.target.value)}
                />
              </TabsContent>
              <TabsContent
                value="params"
                className="flex-1 p-4 m-0 text-sm text-[#9AA3B2]"
              >
                No parameters configured.
              </TabsContent>
              <TabsContent
                value="auth"
                className="flex-1 p-4 m-0 text-sm text-[#9AA3B2]"
              >
                Using global Bearer token from settings.
              </TabsContent>
            </Tabs>
          </div>
        </div>
        <div className="w-[35%] min-w-[300px] shrink-0 bg-[#0F1117] border-l border-[#242938] flex flex-col relative">
          {response ? (
            <>
              <div className="p-3 border-b border-[#242938] flex items-center gap-4 bg-[#161A23]/50 overflow-x-auto hidden-scrollbar">
                <div className="flex items-center gap-2 text-sm font-medium shrink-0">
                  <span className="text-[#9AA3B2]">Status</span>
                  <span
                    className={`font-bold flex items-center gap-1 ${response.status >= 200 && response.status < 300 ? "text-[#2ED573]" : response.status >= 400 ? "text-[#FF5C5C]" : "text-[#F5B74F]"}`}
                  >
                    {response.status}{" "}
                    {response.status === 200
                      ? "OK"
                      : response.status === 201
                        ? "Created"
                        : response.status === 204
                          ? "No Content"
                          : "Error"}
                  </span>
                </div>
                <div className="w-px h-4 bg-[#242938] shrink-0" />
                <div className="flex items-center gap-2 text-sm font-medium shrink-0">
                  <span className="text-[#9AA3B2]">Time</span>
                  <span className="text-[#00C2A8] font-mono bg-[#00C2A8]/10 px-1.5 py-0.5 rounded">
                    {response.time}
                  </span>
                </div>
                <div className="w-px h-4 bg-[#242938] shrink-0" />
                <div className="flex items-center gap-2 text-sm font-medium shrink-0">
                  <span className="text-[#9AA3B2]">Size</span>
                  <span className="text-[#E6EAF2] font-mono">
                    {response.size}
                  </span>
                </div>
              </div>
              <div className="bg-[#161A23] border-b border-[#242938] px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2 truncate">
                  {response.contractValidation.status === "valid" ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-[#2ED573]" />
                      <span className="text-sm font-medium text-[#E6EAF2] truncate">
                        Contract Validation Passed
                      </span>
                    </>
                  ) : response.contractValidation.status === "missing" ? (
                    <>
                      <AlertTriangle className="w-4 h-4 shrink-0 text-[#9AA3B2]" />
                      <span className="text-sm font-medium text-[#9AA3B2] truncate">
                        No Contract Found for Endpoint
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4 shrink-0 text-[#F5B74F]" />
                      <span className="text-sm font-medium text-[#F5B74F] truncate">
                        Contract Mismatch Warning
                      </span>
                    </>
                  )}
                </div>
                <div className="text-[11px] text-[#9AA3B2] truncate max-w-[45%] text-right">
                  {response.contractValidation.path}{" "}
                  {response.contractValidation.method}
                </div>
              </div>
              <Tabs
                defaultValue="body"
                className="flex-1 flex flex-col min-w-0 overflow-hidden"
              >
                <div className="border-b border-[#242938] px-4 bg-[#161A23]/30 overflow-x-auto hidden-scrollbar">
                  <TabsList className="bg-transparent h-10 p-0 space-x-6 w-max">
                    <TabsTrigger
                      value="body"
                      className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#00C2A8] data-[state=active]:text-[#E6EAF2] text-[#9AA3B2] rounded-none py-2 px-0"
                    >
                      Body
                    </TabsTrigger>
                    <TabsTrigger
                      value="headers"
                      className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#00C2A8] data-[state=active]:text-[#E6EAF2] text-[#9AA3B2] rounded-none py-2 px-0"
                    >
                      Headers
                    </TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent
                  value="body"
                  className="flex-1 p-0 m-0 overflow-auto bg-[#0F1117] h-full relative"
                >
                  <div className="absolute top-2 right-4 flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-[#9AA3B2] hover:text-[#E6EAF2] hover:bg-[#242938]"
                    >
                      <FileJson className="w-4 h-4" />
                    </Button>
                  </div>
                  {response.body ? (
                    <pre className="p-4 font-mono text-sm leading-relaxed overflow-auto h-full text-[#E6EAF2]">
                      <code>{response.body}</code>
                    </pre>
                  ) : (
                    <div className="p-4 text-sm text-[#9AA3B2] font-mono italic">
                      No response body.
                    </div>
                  )}
                </TabsContent>
                <TabsContent
                  value="headers"
                  className="flex-1 p-4 m-0 overflow-auto bg-[#0F1117] text-sm font-mono text-[#9AA3B2]"
                >
                  {Object.keys(response.headers).length === 0 ? (
                    <span>No headers available.</span>
                  ) : (
                    Object.entries(response.headers).map(([key, value]) => (
                      <div key={key}>
                        {key}: {value}
                      </div>
                    ))
                  )}
                  <div className="mt-3 border-t border-[#242938] pt-3 text-[#E6EAF2]">
                    Contract Hash:{" "}
                    {response.contractValidation.contract_hash || "n/a"}
                  </div>
                  <div>
                    Observed Hash:{" "}
                    {response.contractValidation.observed_hash || "n/a"}
                  </div>
                </TabsContent>
              </Tabs>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-[#9AA3B2] p-8 text-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#161A23] to-[#0F1117] min-w-0 overflow-hidden">
              <div className="w-16 h-16 mb-4 rounded-2xl bg-[#242938]/50 flex items-center justify-center shrink-0">
                <TerminalSquare className="w-8 h-8 text-[#5B5DFF]/50" />
              </div>
              <h3 className="text-lg font-medium text-[#E6EAF2] mb-2 truncate max-w-full">
                Ready to Send Response
              </h3>
              <p className="w-full text-sm line-clamp-3">
                Hit Send to execute the request and see the response along with
                contract validation results here.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
