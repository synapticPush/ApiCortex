"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { Search, MoreHorizontal, Trash2, Edit2, Globe } from "lucide-react";
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
import { apiClient } from "@/lib/api-client";
import { API, Endpoint, OpenAPIUploadResult } from "@/lib/api-types";
import { toast } from "sonner";
type APIDomain = API & { endpointsCount: number; status: string };
export default function ApisPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [domains, setDomains] = useState<APIDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDomainModalOpen, setIsDomainModalOpen] = useState(false);
  const [isOpenApiModalOpen, setIsOpenApiModalOpen] = useState(false);
  const [openApiVersion, setOpenApiVersion] = useState("1.0.0");
  const [openApiTarget, setOpenApiTarget] = useState("new");
  const [openApiName, setOpenApiName] = useState("");
  const [openApiBaseUrl, setOpenApiBaseUrl] = useState("");
  const [openApiFile, setOpenApiFile] = useState<File | null>(null);
  const [uploadingOpenApi, setUploadingOpenApi] = useState(false);
  const [domainFormUrl, setDomainFormUrl] = useState("");
  const [domainFormName, setDomainFormName] = useState("");
  const [editingDomainId, setEditingDomainId] = useState<string | null>(null);
  useEffect(() => {
    fetchApis();
  }, []);
  const fetchApis = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get<API[]>("/apis");
      const apisData = res.data;
      const enrichedApis = await Promise.all(
        apisData.map(async (api) => {
          let count = 0;
          try {
            const endpointsRes = await apiClient.get<Endpoint[]>(
              `/apis/${api.id}/endpoints`,
            );
            count = endpointsRes.data.length;
          } catch (e) {
            console.error(e);
          }
          return {
            ...api,
            endpointsCount: count,
            status: "healthy",
          };
        }),
      );
      setDomains(enrichedApis);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  const filteredDomains = domains.filter(
    (d) =>
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.base_url.toLowerCase().includes(searchQuery.toLowerCase()),
  );
  const openAddDomain = () => {
    setEditingDomainId(null);
    setDomainFormName("");
    setDomainFormUrl("");
    setIsDomainModalOpen(true);
  };
  const openOpenApiImport = () => {
    setOpenApiVersion("1.0.0");
    setOpenApiTarget("new");
    setOpenApiName("");
    setOpenApiBaseUrl("");
    setOpenApiFile(null);
    setIsOpenApiModalOpen(true);
  };
  const openEditDomain = (e: React.MouseEvent, d: APIDomain) => {
    e.stopPropagation();
    setEditingDomainId(d.id);
    setDomainFormName(d.name);
    setDomainFormUrl(d.base_url);
    setIsDomainModalOpen(true);
  };
  const handleSaveDomain = async () => {
    if (!domainFormName || !domainFormUrl) return;
    try {
      if (editingDomainId) {
        await apiClient.patch(`/apis/${editingDomainId}`, {
          name: domainFormName,
          base_url: domainFormUrl,
        });
      } else {
        await apiClient.post("/apis", {
          name: domainFormName,
          base_url: domainFormUrl,
        });
      }
      await fetchApis();
      setIsDomainModalOpen(false);
    } catch (error) {
      console.error(error);
    }
  };
  const handleDeleteDomain = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await apiClient.delete(`/apis/${id}`);
      await fetchApis();
    } catch (error) {
      console.error(error);
    }
  };
  const handleImportOpenApi = async () => {
    if (!openApiFile) {
      toast.error("OpenAPI file is required.");
      return;
    }
    if (!openApiVersion.trim()) {
      toast.error("Version is required.");
      return;
    }
    if (
      openApiTarget === "new" &&
      (!openApiName.trim() || !openApiBaseUrl.trim())
    ) {
      toast.error(
        "API name and base URL are required when importing as a new domain.",
      );
      return;
    }
    setUploadingOpenApi(true);
    try {
      const formData = new FormData();
      formData.append("file", openApiFile);
      formData.append("version", openApiVersion.trim());
      if (openApiTarget === "new") {
        formData.append("api_name", openApiName.trim());
        formData.append("base_url", openApiBaseUrl.trim());
      } else {
        formData.append("api_id", openApiTarget);
      }
      const response = await apiClient.post<OpenAPIUploadResult>(
        "/contracts/openapi",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );
      toast.success(
        `OpenAPI imported. ${response.data.endpoints_synced} endpoints synced.`,
      );
      setIsOpenApiModalOpen(false);
      await fetchApis();
    } catch {
      toast.error("Failed to import OpenAPI document.");
    } finally {
      setUploadingOpenApi(false);
    }
  };
  if (loading) {
    return (
      <div className="w-full space-y-6 animate-in fade-in duration-300">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-10 w-56 bg-[#242938]" />
            <Skeleton className="h-4 w-80 bg-[#161A23]" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-32 bg-[#161A23] border border-[#242938] rounded-xl" />
            <Skeleton className="h-10 w-36 bg-[#161A23] border border-[#242938] rounded-xl" />
          </div>
        </div>
        <div className="bg-[#161A23]/80 backdrop-blur-xl border border-[#242938] rounded-2xl p-4 space-y-4">
          <Skeleton className="h-10 w-full max-w-sm bg-[#0F1117] border border-[#242938]" />
          <div className="rounded-xl border border-[#242938] overflow-hidden bg-[#0F1117]/50">
            <div className="h-12 border-b border-[#242938] bg-[#0F1117]" />
            <div className="space-y-2 p-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton
                  key={index}
                  className="h-14 w-full bg-[#161A23] border border-[#242938] rounded-lg"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="w-full space-y-6 flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#E6EAF2] tracking-tight">
            API Domains
          </h1>
          <p className="text-[#9AA3B2] mt-1">
            Manage your organizations tracked API Domains. Click a domain to
            view endpoints.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={openOpenApiImport}
            variant="outline"
            className="border-[#242938] text-[#E6EAF2] hover:bg-[#242938] rounded-xl"
          >
            Import OpenAPI
          </Button>
          <Button
            onClick={openAddDomain}
            className="bg-[#5B5DFF] hover:bg-[#5B5DFF]/90 text-white font-medium rounded-xl shadow-[0_0_20px_rgba(91,93,255,0.3)] transition-all flex items-center gap-2"
          >
            <Globe className="w-4 h-4" />
            Add New Domain
          </Button>
        </div>
      </div>
      <div className="bg-[#161A23]/80 backdrop-blur-xl border border-[#242938] rounded-2xl p-4 flex-1 flex flex-col shadow-[0_10px_40px_rgba(0,0,0,0.25)] overflow-hidden">
        <div className="flex items-center gap-4 mb-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9AA3B2]" />
            <Input
              type="text"
              placeholder="Search domains..."
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
                <TableHead className="text-[#9AA3B2] font-medium h-12 w-[250px] pl-6">
                  Domain
                </TableHead>
                <TableHead className="text-[#9AA3B2] font-medium h-12">
                  Base URL
                </TableHead>
                <TableHead className="text-[#9AA3B2] font-medium h-12">
                  Status
                </TableHead>
                <TableHead className="text-[#9AA3B2] font-medium h-12 text-center">
                  Endpoints
                </TableHead>
                <TableHead className="text-[#9AA3B2] font-medium h-12 text-right">
                  Created
                </TableHead>
                <TableHead className="text-[#9AA3B2] font-medium h-12 w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDomains.map((domain) => (
                <TableRow
                  key={domain.id}
                  className="border-[#242938] hover:bg-[#161A23] transition-colors cursor-pointer group"
                  onClick={() => router.push(`/apis/${domain.id}`)}
                >
                  <TableCell className="font-semibold text-[#E6EAF2] pl-6 h-16">
                    {domain.name}
                  </TableCell>
                  <TableCell className="text-[#9AA3B2] font-mono text-xs">
                    {domain.base_url}
                  </TableCell>
                  <TableCell>
                    {domain.status === "healthy" && (
                      <Badge
                        variant="outline"
                        className="text-[#2ED573] border-[#2ED573]/30 bg-[#2ED573]/10"
                      >
                        Healthy
                      </Badge>
                    )}
                    {domain.status === "warning" && (
                      <Badge
                        variant="outline"
                        className="text-[#F5B74F] border-[#F5B74F]/30 bg-[#F5B74F]/10"
                      >
                        Warning
                      </Badge>
                    )}
                    {domain.status === "error" && (
                      <Badge
                        variant="outline"
                        className="text-[#FF5C5C] border-[#FF5C5C]/30 bg-[#FF5C5C]/10"
                      >
                        Failing
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-[#E6EAF2] text-center">
                    <Badge
                      variant="secondary"
                      className="bg-[#242938] text-[#9AA3B2]"
                    >
                      {domain.endpointsCount}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[#9AA3B2] text-right">
                    {new Date(domain.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        nativeButton={false}
                        onClick={(e) => e.stopPropagation()}
                        render={
                          <div
                            role="button"
                            className="h-8 w-8 inline-flex items-center justify-center p-0 text-[#9AA3B2] hover:text-[#E6EAF2] hover:bg-[#242938] rounded-lg relative z-20 outline-none"
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
                            Domain Actions
                          </DropdownMenuLabel>
                          <DropdownMenuItem
                            onClick={(e) => openEditDomain(e, domain)}
                            className="focus:bg-[#242938] focus:text-[#E6EAF2] cursor-pointer flex items-center gap-2"
                          >
                            <Edit2 className="w-4 h-4 text-[#F5B74F]" /> Edit
                            Domain
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-[#242938]" />
                          <DropdownMenuItem
                            onClick={(e) => handleDeleteDomain(e, domain.id)}
                            className="focus:bg-[#242938] text-[#FF5C5C] focus:text-[#FF5C5C] cursor-pointer flex items-center gap-2"
                          >
                            <Trash2 className="w-4 h-4" /> Delete Domain
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {filteredDomains.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-32 text-center text-[#9AA3B2]"
                  >
                    No domains found matching your search.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <Dialog open={isDomainModalOpen} onOpenChange={setIsDomainModalOpen}>
        <DialogContent className="sm:max-w-[425px] bg-[#161A23] border-[#242938] text-[#E6EAF2]">
          <DialogHeader>
            <DialogTitle>
              {editingDomainId ? "Edit Domain" : "Add New Domain"}
            </DialogTitle>
            <DialogDescription className="text-[#9AA3B2]">
              Define a core API domain like your User Service or Payment
              Gateway.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="domainName" className="text-right text-[#9AA3B2]">
                Name
              </Label>
              <Input
                id="domainName"
                value={domainFormName}
                onChange={(e) => setDomainFormName(e.target.value)}
                placeholder="e.g. Payment Gateway"
                className="col-span-3 bg-[#0F1117] border-[#242938] text-[#E6EAF2] focus-visible:ring-[#5B5DFF]"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="domainUrl" className="text-right text-[#9AA3B2]">
                Base URL
              </Label>
              <Input
                id="domainUrl"
                value={domainFormUrl}
                onChange={(e) => setDomainFormUrl(e.target.value)}
                placeholder="https://api.acme.com/v1"
                className="col-span-3 bg-[#0F1117] border-[#242938] text-[#E6EAF2] focus-visible:ring-[#5B5DFF]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDomainModalOpen(false)}
              className="border-[#242938] hover:bg-[#242938] text-[#E6EAF2]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveDomain}
              className="bg-[#5B5DFF] text-white hover:bg-[#5B5DFF]/90"
            >
              {editingDomainId ? "Update" : "Create"} Domain
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isOpenApiModalOpen} onOpenChange={setIsOpenApiModalOpen}>
        <DialogContent className="sm:max-w-[560px] bg-[#161A23] border-[#242938] text-[#E6EAF2]">
          <DialogHeader>
            <DialogTitle>Import OpenAPI Specification</DialogTitle>
            <DialogDescription className="text-[#9AA3B2]">
              Upload a JSON OpenAPI document to create or sync domains and
              endpoints.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-[#9AA3B2]">Target</Label>
              <div className="col-span-3">
                <Select
                  value={openApiTarget}
                  onValueChange={(value) => setOpenApiTarget(value || "new")}
                >
                  <SelectTrigger className="bg-[#0F1117] border-[#242938] text-[#E6EAF2]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#161A23] border-[#242938] text-[#E6EAF2]">
                    <SelectItem value="new">Create New Domain</SelectItem>
                    {domains.map((domain) => (
                      <SelectItem key={domain.id} value={domain.id}>
                        {domain.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {openApiTarget === "new" && (
              <>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label
                    htmlFor="openApiName"
                    className="text-right text-[#9AA3B2]"
                  >
                    API Name
                  </Label>
                  <Input
                    id="openApiName"
                    value={openApiName}
                    onChange={(event) => setOpenApiName(event.target.value)}
                    placeholder="e.g. Orders Service"
                    className="col-span-3 bg-[#0F1117] border-[#242938] text-[#E6EAF2]"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label
                    htmlFor="openApiBaseUrl"
                    className="text-right text-[#9AA3B2]"
                  >
                    Base URL
                  </Label>
                  <Input
                    id="openApiBaseUrl"
                    value={openApiBaseUrl}
                    onChange={(event) => setOpenApiBaseUrl(event.target.value)}
                    placeholder="https://api.example.com/v1"
                    className="col-span-3 bg-[#0F1117] border-[#242938] text-[#E6EAF2]"
                  />
                </div>
              </>
            )}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label
                htmlFor="openApiVersion"
                className="text-right text-[#9AA3B2]"
              >
                Version
              </Label>
              <Input
                id="openApiVersion"
                value={openApiVersion}
                onChange={(event) => setOpenApiVersion(event.target.value)}
                placeholder="1.0.0"
                className="col-span-3 bg-[#0F1117] border-[#242938] text-[#E6EAF2]"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label
                htmlFor="openApiFile"
                className="text-right text-[#9AA3B2]"
              >
                JSON File
              </Label>
              <Input
                id="openApiFile"
                type="file"
                accept="application/json"
                onChange={(event) =>
                  setOpenApiFile(event.target.files?.[0] || null)
                }
                className="col-span-3 bg-[#0F1117] border-[#242938] text-[#E6EAF2] file:text-[#E6EAF2]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsOpenApiModalOpen(false)}
              className="border-[#242938] hover:bg-[#242938] text-[#E6EAF2]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleImportOpenApi}
              disabled={uploadingOpenApi}
              className="bg-[#5B5DFF] text-white hover:bg-[#5B5DFF]/90"
            >
              {uploadingOpenApi ? "Importing..." : "Import OpenAPI"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
