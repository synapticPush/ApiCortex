"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  MoreHorizontal,
  ExternalLink,
  Trash2,
  Edit2,
  ArrowLeft,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api-client";
import { API, Endpoint } from "@/lib/api-types";
export default function DomainDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const domainId = params.domainId as string;
  const [searchQuery, setSearchQuery] = useState("");
  const [domain, setDomain] = useState<API | null>(null);
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEndpointModalOpen, setIsEndpointModalOpen] = useState(false);
  const [endpointFormPath, setEndpointFormPath] = useState("");
  const [endpointFormMethod, setEndpointFormMethod] = useState<string>("GET");
  const [editingEndpointId, setEditingEndpointId] = useState<string | null>(
    null,
  );
  const fetchDomainData = useCallback(async () => {
    try {
      setLoading(true);
      const apiRes = await apiClient.get<API[]>(`/apis`);
      const apiDetails = apiRes.data.find((a) => a.id === domainId);
      if (apiDetails) {
        setDomain(apiDetails);
        const endpointsRes = await apiClient.get<Endpoint[]>(
          `/apis/${domainId}/endpoints`,
        );
        setEndpoints(endpointsRes.data);
      } else {
        setDomain(null);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [domainId]);
  useEffect(() => {
    void fetchDomainData();
  }, [fetchDomainData]);
  if (loading) {
    return (
      <div className="w-full space-y-6 animate-in fade-in duration-300">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-lg bg-[#161A23] border border-[#242938]" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-9 w-72 bg-[#242938]" />
            <Skeleton className="h-4 w-80 bg-[#161A23]" />
          </div>
          <Skeleton className="h-10 w-36 rounded-xl bg-[#161A23] border border-[#242938]" />
        </div>
        <div className="bg-[#161A23]/80 backdrop-blur-xl border border-[#242938] rounded-2xl p-4 space-y-4">
          <Skeleton className="h-10 w-full max-w-sm bg-[#0F1117] border border-[#242938]" />
          <div className="rounded-xl border border-[#242938] overflow-hidden bg-[#0F1117]/50">
            <div className="h-12 border-b border-[#242938] bg-[#0F1117]" />
            <div className="space-y-2 p-3">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton
                  key={index}
                  className="h-12 w-full bg-[#161A23] border border-[#242938] rounded-lg"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (!domain && !loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <h2 className="text-2xl text-[#E6EAF2]">Domain not found</h2>
        <Button
          onClick={() => router.push("/apis")}
          variant="outline"
          className="border-[#242938] text-[#E6EAF2] hover:bg-[#242938]"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to APIs
        </Button>
      </div>
    );
  }
  const filteredEndpoints = endpoints.filter((ep) =>
    ep.path.toLowerCase().includes(searchQuery.toLowerCase()),
  );
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
  const openAddEndpoint = () => {
    setEditingEndpointId(null);
    setEndpointFormPath("");
    setEndpointFormMethod("GET");
    setIsEndpointModalOpen(true);
  };
  const openEditEndpoint = (ep: Endpoint) => {
    setEditingEndpointId(ep.id);
    setEndpointFormPath(ep.path);
    setEndpointFormMethod(ep.method);
    setIsEndpointModalOpen(true);
  };
  const handleSaveEndpoint = async () => {
    if (!endpointFormPath) return;
    try {
      if (editingEndpointId) {
        await apiClient.patch(`/endpoints/${editingEndpointId}`, {
          path: endpointFormPath,
          method: endpointFormMethod,
        });
      } else {
        await apiClient.post("/endpoints", {
          api_id: domainId,
          path: endpointFormPath,
          method: endpointFormMethod,
        });
      }
      await fetchDomainData();
      setIsEndpointModalOpen(false);
    } catch (error) {
      console.error(error);
    }
  };
  const handleDeleteEndpoint = async (endpointId: string) => {
    try {
      await apiClient.delete(`/endpoints/${endpointId}`);
      await fetchDomainData();
    } catch (error) {
      console.error(error);
    }
  };
  return (
    <div className="w-full space-y-6 flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center gap-4">
        <Button
          onClick={() => router.push("/apis")}
          variant="ghost"
          size="icon"
          className="hover:bg-[#242938] text-[#9AA3B2] hover:text-[#E6EAF2] h-10 w-10 shrink-0 border border-[#242938]/50"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[#E6EAF2] tracking-tight">
              {domain?.name} Endpoints
            </h1>
            <p className="text-[#9AA3B2] mt-1 font-mono text-sm">
              {domain?.base_url}
            </p>
          </div>
          <Button
            onClick={openAddEndpoint}
            className="bg-[#5B5DFF] hover:bg-[#5B5DFF]/90 text-white font-medium rounded-xl shadow-[0_0_20px_rgba(91,93,255,0.3)] transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Endpoint
          </Button>
        </div>
      </div>
      <div className="bg-[#161A23]/80 backdrop-blur-xl border border-[#242938] rounded-2xl p-4 flex-1 flex flex-col shadow-[0_10px_40px_rgba(0,0,0,0.25)] overflow-hidden">
        <div className="flex items-center gap-4 mb-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9AA3B2]" />
            <Input
              type="text"
              placeholder="Search endpoints..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-[#0F1117] border-[#242938] text-[#E6EAF2] placeholder:text-[#9AA3B2] focus-visible:ring-[#5B5DFF] h-10 rounded-xl"
            />
          </div>
        </div>
        <div className="rounded-xl border border-[#242938] overflow-hidden flex-1 overflow-y-auto bg-[#0F1117]/50">
          <Table>
            <TableHeader className="bg-[#0F1117] sticky top-0 z-10 border-b border-[#242938]">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="text-[#9AA3B2] font-medium h-12 w-[100px] pl-6">
                  Method
                </TableHead>
                <TableHead className="text-[#9AA3B2] font-medium h-12">
                  Path
                </TableHead>
                <TableHead className="text-[#9AA3B2] font-medium h-12 w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEndpoints.map((ep) => (
                <TableRow
                  key={ep.id}
                  className="border-[#242938] hover:bg-[#161A23] transition-colors group"
                >
                  <TableCell className="font-mono text-xs font-bold pl-6">
                    <span className={getMethodColor(ep.method)}>
                      {ep.method}
                    </span>
                  </TableCell>
                  <TableCell className="text-[#9AA3B2] font-mono text-sm">
                    {ep.path}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        nativeButton={false}
                        render={
                          <div
                            role="button"
                            className="h-8 w-8 inline-flex items-center justify-center p-0 text-[#9AA3B2] opacity-50 group-hover:opacity-100 hover:text-[#E6EAF2] hover:bg-[#242938] rounded-lg relative z-20 outline-none transition-opacity"
                          />
                        }
                      >
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="bg-[#161A23] border-[#242938] text-[#E6EAF2] z-50"
                      >
                        <DropdownMenuGroup>
                          <DropdownMenuLabel className="text-[#9AA3B2] text-xs font-semibold uppercase">
                            Endpoint Actions
                          </DropdownMenuLabel>
                          <DropdownMenuItem
                            onClick={() => openEditEndpoint(ep)}
                            className="focus:bg-[#242938] focus:text-[#E6EAF2] cursor-pointer flex items-center gap-2"
                          >
                            <Edit2 className="w-4 h-4 text-[#F5B74F]" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => router.push("/testing")}
                            className="focus:bg-[#242938] focus:text-[#E6EAF2] cursor-pointer flex items-center gap-2"
                          >
                            <ExternalLink className="w-4 h-4 text-[#3A8DFF]" />{" "}
                            Test Request
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-[#242938]" />
                          <DropdownMenuItem
                            onClick={() => handleDeleteEndpoint(ep.id)}
                            className="focus:bg-[#242938] text-[#FF5C5C] focus:text-[#FF5C5C] cursor-pointer flex items-center gap-2"
                          >
                            <Trash2 className="w-4 h-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {filteredEndpoints.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-32 text-center text-[#9AA3B2]"
                  >
                    No endpoints found.{" "}
                    <Button
                      variant="link"
                      onClick={openAddEndpoint}
                      className="text-[#5B5DFF] hover:text-[#3A8DFF] px-1"
                    >
                      Add your first one
                    </Button>
                    .
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <Dialog open={isEndpointModalOpen} onOpenChange={setIsEndpointModalOpen}>
        <DialogContent className="sm:max-w-[425px] bg-[#161A23] border-[#242938] text-[#E6EAF2]">
          <DialogHeader>
            <DialogTitle>
              {editingEndpointId ? "Edit Endpoint" : "Add New Endpoint"}
            </DialogTitle>
            <DialogDescription className="text-[#9AA3B2]">
              Define a specific endpoint route and method.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-[#9AA3B2]">Method</Label>
              <Select
                value={endpointFormMethod}
                onValueChange={(val) => setEndpointFormMethod(val || "GET")}
              >
                <SelectTrigger className="col-span-3 bg-[#0F1117] border-[#242938] text-[#E6EAF2] focus:ring-[#5B5DFF]">
                  <SelectValue placeholder="Select Method" />
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
                  <SelectItem
                    value="PATCH"
                    className="text-[#3A8DFF] font-bold"
                  >
                    PATCH
                  </SelectItem>
                  <SelectItem
                    value="DELETE"
                    className="text-[#FF5C5C] font-bold"
                  >
                    DELETE
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="epPath" className="text-right text-[#9AA3B2]">
                Path
              </Label>
              <Input
                id="epPath"
                value={endpointFormPath}
                onChange={(e) => setEndpointFormPath(e.target.value)}
                placeholder="e.g. /users/{id}"
                className="col-span-3 bg-[#0F1117] border-[#242938] text-[#E6EAF2] focus-visible:ring-[#5B5DFF] font-mono"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEndpointModalOpen(false)}
              className="border-[#242938] hover:bg-[#242938] text-[#E6EAF2]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEndpoint}
              className="bg-[#5B5DFF] text-white hover:bg-[#5B5DFF]/90"
            >
              {editingEndpointId ? "Update" : "Add"} Endpoint
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
