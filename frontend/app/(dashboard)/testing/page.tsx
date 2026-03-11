"use client";

import { useState } from "react";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Play, Save, Plus, FolderTree, FileJson, Clock, CheckCircle2, AlertTriangle, XCircle, TerminalSquare, ChevronDown, ChevronRight } from "lucide-react";
import { mockDomains, Domain, Endpoint } from "@/lib/mock-data";

export default function TestingPage() {
  const [method, setMethod] = useState("GET");
  const [url, setUrl] = useState("https://api.acme.com/users/");
  const [isSending, setIsSending] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [activeEndpoint, setActiveEndpoint] = useState<Endpoint | null>(null);

  const [expandedCollections, setExpandedCollections] = useState<Record<string, boolean>>({
    domain_1: true // Open the first domain by default
  });

  const toggleCollection = (id: string) => {
    setExpandedCollections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const selectEndpoint = (domain: Domain, ep: Endpoint) => {
    setActiveEndpoint(ep);
    setMethod(ep.method);
    // Rough URL assembly for demo
    const cleanBase = domain.baseUrl.replace(/\/$/, '');
    const cleanPath = ep.path.replace(/^\//, '');
    setUrl(`${cleanBase}/${cleanPath}`);
  };

  const getMethodColor = (method: string) => {
    switch(method) {
      case "GET": return "text-[#00C2A8]";
      case "POST": return "text-[#5B5DFF]";
      case "PUT": return "text-[#F5B74F]";
      case "DELETE": return "text-[#FF5C5C]";
      case "PATCH": return "text-[#3A8DFF]";
      default: return "text-[#E6EAF2]";
    }
  };

  const generateMockData = () => {
    // Generate realistic response based on the active endpoint or URL
    let status = 200;
    let body: any = { message: "Success" };
    let size = "1.2KB";
    const time = Math.floor(Math.random() * 250 + 40) + "ms";
    let contractStatus = "valid";

    if (activeEndpoint) {
      // Map based on endpoint name
      const name = activeEndpoint.name.toLowerCase();
      if (name.includes("list users")) {
        body = { data: [{ id: "usr_1", name: "Alice", role: "admin" }, { id: "usr_2", name: "Bob", role: "user" }], meta: { total: 2 } };
        size = "2.4KB";
      } else if (name.includes("create user")) {
        status = 201; body = { id: "usr_new", message: "User created" }; size = "800B";
      } else if (name.includes("get user")) {
        body = { id: "usr_123", name: "John Doe", email: "john@example.com", preferences: { theme: "dark" } };
      } else if (name.includes("delete")) {
        status = 204; body = null; size = "0B";
      } else if (name.includes("charge")) {
        if (method === "POST") { status = 201; body = { id: "ch_1A2B3C", amount: 5000, currency: "usd", status: "succeeded" }; }
        else { body = { id: "ch_1A2B3C", amount: 5000, status: "succeeded", receipt_url: "https://acme.com/receipts/ch_1A2B3C" }; }
      } else if (name.includes("refund")) {
        status = 201; body = { id: "re_9X8Y7Z", charge: "ch_1A2B3C", amount: 5000, status: "pending" };
      } else if (name.includes("products")) {
        if (method === "GET") { body = { items: [{ id: "prod_1", name: "Ergo Mouse", stock: 15 }, { id: "prod_2", name: "Mech Keyboard", stock: 4 }] }; }
        else { status = 201; body = { id: "prod_new", success: true }; }
      } else if (name.includes("email") || name.includes("sms") || name.includes("push")) {
        status = 202; body = { messageId: "msg_" + Math.random().toString(36).substring(7), status: "queued" }; size = "450B";
      } else if (name.includes("metrics") || name.includes("analytics") || name.includes("active users")) {
        body = { activeUsers: 14205, newSignups: 340, revenue: 84500.50, trends: [100, 105, 110, 115, 120] };
        size = "1.8KB";
      } else {
        body = { success: true, ref: activeEndpoint.id };
      }
    } else {
      // Fallback based on method/url heuristics
      if (method === "GET") {
        body = { data: { id: "req_" + Date.now(), received_at: new Date().toISOString() } };
      } else if (method === "POST") {
        status = 201; body = { id: "new_" + Date.now(), created: true }; size = "850B";
      } else if (method === "DELETE") {
        status = 204; body = null; size = "0B";
      } else {
        body = { updated: true, timestamp: Date.now() };
      }
    }

    if (Math.random() > 0.85) {
      contractStatus = "warning";
    }

    return {
      status,
      time,
      size,
      body: body ? JSON.stringify(body, null, 2) : "",
      contractStatus
    };
  };

  const handleSend = () => {
    setIsSending(true);
    // Mock API call latency
    setTimeout(() => {
      setResponse(generateMockData());
      setIsSending(false);
    }, 600 + Math.random() * 400); // 600-1000ms delay
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex-1 w-full flex rounded-2xl border border-[#242938] overflow-hidden shadow-2xl">
        
        {/* Left Panel: Collections Fixed Width */}
        <div className="w-[280px] shrink-0 border-r border-[#242938] bg-[#0F1117]">
          <div className="p-4 h-full flex flex-col min-w-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[#E6EAF2] uppercase tracking-wider truncate">Collections</h2>
              <Button variant="ghost" size="icon" className="w-6 h-6 shrink-0 text-[#9AA3B2] hover:text-[#E6EAF2]">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-1">
              {mockDomains.map(domain => (
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
                  
                  {expandedCollections[domain.id] && (
                    <div className="pl-6 mt-1 space-y-1 mb-2">
                      {domain.endpoints.map(ep => (
                        <div 
                          key={ep.id}
                          onClick={() => selectEndpoint(domain, ep)}
                          className={`flex items-center gap-2 text-xs p-1.5 rounded-md cursor-pointer transition-colors ${activeEndpoint?.id === ep.id ? 'bg-[#242938] text-[#E6EAF2]' : 'text-[#9AA3B2] hover:text-[#E6EAF2] hover:bg-[#161A23]'}`}
                        >
                          <span className={`font-bold w-10 shrink-0 text-right text-[10px] ${getMethodColor(ep.method)}`}>{ep.method}</span>
                          <span className="truncate">{ep.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center Panel: Request Builder Flex-1 */}
        <div className="flex-1 flex flex-col bg-[#161A23] min-w-0">
          {/* Request Bar */}
          <div className="p-4 border-b border-[#242938] flex gap-2 items-center bg-[#0F1117]/50 overflow-x-auto hidden-scrollbar">
            <Select value={method} onValueChange={(val) => setMethod(val || "GET")}>
              <SelectTrigger className="w-24 shrink-0 bg-[#161A23] border-[#242938] text-[#E6EAF2] focus:ring-[#5B5DFF] font-mono font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#161A23] border-[#242938] text-[#E6EAF2]">
                <SelectItem value="GET" className="text-[#00C2A8] font-bold">GET</SelectItem>
                <SelectItem value="POST" className="text-[#5B5DFF] font-bold">POST</SelectItem>
                <SelectItem value="PUT" className="text-[#F5B74F] font-bold">PUT</SelectItem>
                <SelectItem value="PATCH" className="text-[#3A8DFF] font-bold">PATCH</SelectItem>
                <SelectItem value="DELETE" className="text-[#FF5C5C] font-bold">DELETE</SelectItem>
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
            <Button variant="outline" size="icon" className="shrink-0 border-[#242938] text-[#9AA3B2] hover:text-[#E6EAF2] hover:bg-[#242938]">
              <Save className="w-4 h-4" />
            </Button>
          </div>

          {/* Request Builder Tabs */}
          <div className="flex-1 p-0 overflow-hidden flex flex-col min-w-0">
            <Tabs defaultValue="headers" className="h-full flex flex-col">
              <div className="border-b border-[#242938] px-4 overflow-x-auto hidden-scrollbar">
                <TabsList className="bg-transparent h-12 p-0 space-x-6 w-max">
                  <TabsTrigger value="params" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#5B5DFF] data-[state=active]:text-[#E6EAF2] text-[#9AA3B2] rounded-none py-3 px-0">Params</TabsTrigger>
                  <TabsTrigger value="headers" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#5B5DFF] data-[state=active]:text-[#E6EAF2] text-[#9AA3B2] rounded-none py-3 px-0">
                    Headers <Badge variant="secondary" className="ml-2 bg-[#242938] text-xs px-1.5 h-4">2</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="body" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#5B5DFF] data-[state=active]:text-[#E6EAF2] text-[#9AA3B2] rounded-none py-3 px-0">Body</TabsTrigger>
                  <TabsTrigger value="auth" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#5B5DFF] data-[state=active]:text-[#E6EAF2] text-[#9AA3B2] rounded-none py-3 px-0">Auth</TabsTrigger>
                </TabsList>
              </div>
              
              <TabsContent value="headers" className="flex-1 p-0 m-0 border-none outline-none overflow-auto">
                <div className="w-full min-w-[400px]">
                  {/* Mock Headers Grid */}
                  <div className="grid grid-cols-[30px_1fr_1fr_30px] border-b border-[#242938] bg-[#0F1117]/50 text-xs text-[#9AA3B2] font-medium">
                    <div className="p-2 border-r border-[#242938] text-center"></div>
                    <div className="p-2 border-r border-[#242938]">Key</div>
                    <div className="p-2 border-r border-[#242938]">Value</div>
                    <div className="p-2"></div>
                  </div>
                  <div className="grid grid-cols-[30px_1fr_1fr_30px] border-b border-[#242938] group">
                    <div className="p-2 border-r border-[#242938] flex items-center justify-center">
                      <input type="checkbox" defaultChecked className="accent-[#5B5DFF]" />
                    </div>
                    <input type="text" defaultValue="Content-Type" className="p-2 border-r border-[#242938] bg-transparent text-[#E6EAF2] font-mono text-sm outline-none focus:bg-[#242938]/30 w-full" />
                    <input type="text" defaultValue="application/json" className="p-2 border-r border-[#242938] bg-transparent text-[#E6EAF2] font-mono text-sm outline-none focus:bg-[#242938]/30 w-full" />
                    <div className="p-2 flex items-center justify-center">
                      <XCircle className="w-4 h-4 text-[#FF5C5C] opacity-0 group-hover:opacity-100 cursor-pointer" />
                    </div>
                  </div>
                  <div className="grid grid-cols-[30px_1fr_1fr_30px] border-b border-[#242938] group">
                    <div className="p-2 border-r border-[#242938] flex items-center justify-center">
                      <input type="checkbox" defaultChecked className="accent-[#5B5DFF]" />
                    </div>
                    <input type="text" defaultValue="Authorization" className="p-2 border-r border-[#242938] bg-transparent text-[#E6EAF2] font-mono text-sm outline-none focus:bg-[#242938]/30 w-full" />
                    <input type="text" defaultValue="Bearer eyJhbGc..." className="p-2 border-r border-[#242938] bg-transparent text-[#E6EAF2] font-mono text-sm outline-none focus:bg-[#242938]/30 w-full text-ellipsis" />
                    <div className="p-2 flex items-center justify-center">
                      <XCircle className="w-4 h-4 text-[#FF5C5C] opacity-0 group-hover:opacity-100 cursor-pointer" />
                    </div>
                  </div>
                  <div className="grid grid-cols-[30px_1fr_1fr_30px] border-b border-[#242938]">
                    <div className="p-2 border-r border-[#242938]"></div>
                    <input type="text" placeholder="Key" className="p-2 border-r border-[#242938] bg-transparent text-[#9AA3B2] placeholder:text-[#9AA3B2]/50 font-mono text-sm outline-none focus:bg-[#242938]/30 w-full" />
                    <input type="text" placeholder="Value" className="p-2 border-r border-[#242938] bg-transparent text-[#9AA3B2] placeholder:text-[#9AA3B2]/50 font-mono text-sm outline-none focus:bg-[#242938]/30 w-full" />
                    <div className="p-2"></div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="body" className="flex-1 p-0 m-0 border-none outline-none relative bg-[#0F1117]/80">
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
                  defaultValue="{\n  &quot;limit&quot;: 100,\n  &quot;status&quot;: &quot;active&quot;\n}"
                ></textarea>
              </TabsContent>
              
              <TabsContent value="params" className="flex-1 p-4 m-0 text-sm text-[#9AA3B2]">
                No parameters configured.
              </TabsContent>
              
              <TabsContent value="auth" className="flex-1 p-4 m-0 text-sm text-[#9AA3B2]">
                Using global Bearer token from settings.
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Right Panel: Response Viewer w-[35%] ideally or min-w */}
        <div className="w-[35%] min-w-[300px] shrink-0 bg-[#0F1117] border-l border-[#242938] flex flex-col relative">
          
          {response ? (
            <>
              <div className="p-3 border-b border-[#242938] flex items-center gap-4 bg-[#161A23]/50 overflow-x-auto hidden-scrollbar">
                <div className="flex items-center gap-2 text-sm font-medium shrink-0">
                  <span className="text-[#9AA3B2]">Status</span>
                  <span className={`font-bold flex items-center gap-1 ${response.status >= 200 && response.status < 300 ? 'text-[#2ED573]' : response.status >= 400 ? 'text-[#FF5C5C]' : 'text-[#F5B74F]'}`}>
                    {response.status} {response.status === 200 ? "OK" : response.status === 201 ? "Created" : response.status === 204 ? "No Content" : "Error"}
                  </span>
                </div>
                <div className="w-px h-4 bg-[#242938] shrink-0" />
                <div className="flex items-center gap-2 text-sm font-medium shrink-0">
                  <span className="text-[#9AA3B2]">Time</span>
                  <span className="text-[#00C2A8] font-mono bg-[#00C2A8]/10 px-1.5 py-0.5 rounded">{response.time}</span>
                </div>
                <div className="w-px h-4 bg-[#242938] shrink-0" />
                <div className="flex items-center gap-2 text-sm font-medium shrink-0">
                  <span className="text-[#9AA3B2]">Size</span>
                  <span className="text-[#E6EAF2] font-mono">{response.size}</span>
                </div>
              </div>

              {/* Contract Validation Overlay */}
              <div className="bg-[#161A23] border-b border-[#242938] px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2 truncate">
                  {response.contractStatus === "valid" ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-[#2ED573]" />
                      <span className="text-sm font-medium text-[#E6EAF2] truncate">Contract Validation Passed</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4 shrink-0 text-[#F5B74F]" />
                      <span className="text-sm font-medium text-[#F5B74F] truncate">Contract Mismatch Warning</span>
                    </>
                  )}
                </div>
                <Button variant="link" className="text-xs text-[#3A8DFF] h-auto p-0 hover:text-[#5B5DFF] shrink-0">View details</Button>
              </div>

              <Tabs defaultValue="body" className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <div className="border-b border-[#242938] px-4 bg-[#161A23]/30 overflow-x-auto hidden-scrollbar">
                  <TabsList className="bg-transparent h-10 p-0 space-x-6 w-max">
                    <TabsTrigger value="body" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#00C2A8] data-[state=active]:text-[#E6EAF2] text-[#9AA3B2] rounded-none py-2 px-0">Body</TabsTrigger>
                    <TabsTrigger value="headers" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-[#00C2A8] data-[state=active]:text-[#E6EAF2] text-[#9AA3B2] rounded-none py-2 px-0">Headers</TabsTrigger>
                  </TabsList>
                </div>
                
                <TabsContent value="body" className="flex-1 p-0 m-0 overflow-auto bg-[#0F1117] h-full relative">
                  <div className="absolute top-2 right-4 flex gap-2">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-[#9AA3B2] hover:text-[#E6EAF2] hover:bg-[#242938]">
                      <FileJson className="w-4 h-4" />
                    </Button>
                  </div>
                  {response.body ? (
                    <pre className="p-4 font-mono text-sm leading-relaxed overflow-auto h-full text-[#E6EAF2]">
                      <code dangerouslySetInnerHTML={{ __html: syntaxHighlight(response.body) }} />
                    </pre>
                  ) : (
                    <div className="p-4 text-sm text-[#9AA3B2] font-mono italic">No response body.</div>
                  )}
                </TabsContent>
                
                <TabsContent value="headers" className="flex-1 p-4 m-0 overflow-auto bg-[#0F1117] text-sm font-mono text-[#9AA3B2]">
                  content-type: {response.body ? 'application/json' : 'text/plain'}<br/>
                  x-powered-by: ApiCortex Engine<br/>
                  content-length: {response.body ? response.body.length : 0}
                </TabsContent>
              </Tabs>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-[#9AA3B2] p-8 text-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#161A23] to-[#0F1117] min-w-0 overflow-hidden">
              <div className="w-16 h-16 mb-4 rounded-2xl bg-[#242938]/50 flex items-center justify-center shrink-0">
                <TerminalSquare className="w-8 h-8 text-[#5B5DFF]/50" />
              </div>
              <h3 className="text-lg font-medium text-[#E6EAF2] mb-2 truncate max-w-full">Ready to Send Response</h3>
              <p className="w-full text-sm line-clamp-3">Hit Send to execute the request and see the response along with contract validation results here.</p>
            </div>
          )}
          
        </div>
      </div>
    </div>
  );
}

// Very basic JSON syntax highlighting helper for MVP
function syntaxHighlight(json: string) {
  if (!json) return "";
  json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
    let cls = 'text-[#3A8DFF]'; // number
    if (/^"/.test(match)) {
      if (/:$/.test(match)) {
        cls = 'text-[#E6EAF2] font-semibold'; // key
      } else {
        cls = 'text-[#00C2A8]'; // string
      }
    } else if (/true|false/.test(match)) {
      cls = 'text-[#FF5C5C]'; // boolean
    } else if (/null/.test(match)) {
      cls = 'text-[#F5B74F]'; // null
    }
    return '<span class="' + cls + '">' + match + '</span>';
  });
}
