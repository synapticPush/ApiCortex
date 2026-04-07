"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  CalendarClock,
  KeyRound,
  Mail,
  RefreshCw,
  Save,
  ShieldCheck,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api-client";
import type {
  AuthSession,
  Organization,
  User as AppUser,
} from "@/lib/api-types";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState<AppUser | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [profileName, setProfileName] = useState("");

  const identityQuery = useQuery({
    queryKey: ["profile-identity"],
    queryFn: async () => {
      const [profileRes, organizationRes, sessionRes] = await Promise.all([
        apiClient.get<AppUser>("/auth/profile"),
        apiClient.get<Organization>("/orgs/current"),
        apiClient.get<AuthSession>("/auth/me"),
      ]);
      return {
        profile: profileRes.data,
        organization: organizationRes.data,
        session: sessionRes.data,
      };
    },
    staleTime: 2 * 60 * 1000,
  });

  const loading = identityQuery.isLoading;

  useEffect(() => {
    if (!identityQuery.data) {
      return;
    }
    setProfile(identityQuery.data.profile);
    setOrganization(identityQuery.data.organization);
    setSession(identityQuery.data.session);
    setProfileName(identityQuery.data.profile.name || "");
  }, [identityQuery.data]);

  const saveProfile = async () => {
    if (!profileName.trim()) {
      toast.error("Name is required.");
      return;
    }
    setSaving(true);
    try {
      const result = await apiClient.patch<AppUser>("/auth/profile", {
        name: profileName.trim(),
      });
      setProfile(result.data);
      setProfileName(result.data.name || "");
      toast.success("Profile updated.");
    } catch {
      toast.error("Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const copyValue = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied.`);
    } catch {
      toast.error(`Failed to copy ${label.toLowerCase()}.`);
    }
  };

  const formatDate = (value?: string) => {
    if (!value) {
      return "Unknown";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString();
  };

  const userInitials = useMemo(() => {
    const seed = (profile?.name || profile?.email || "U").trim();
    const initials = seed
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    return initials || "U";
  }, [profile?.name, profile?.email]);

  if (loading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="space-y-2">
          <Skeleton className="h-10 w-44 bg-[#242938]" />
          <Skeleton className="h-4 w-96 bg-[#161A23]" />
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Skeleton className="xl:col-span-2 h-80 w-full bg-[#161A23] border border-[#242938] rounded-xl" />
          <Skeleton className="h-80 w-full bg-[#161A23] border border-[#242938] rounded-xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64 w-full bg-[#161A23] border border-[#242938] rounded-xl" />
          <Skeleton className="h-64 w-full bg-[#161A23] border border-[#242938] rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-[#E6EAF2] tracking-tight">
          Profile
        </h1>
        <p className="text-[#9AA3B2]">
          Manage your personal account details, organization context, and quick
          access preferences.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2 bg-[#161A23]/80 backdrop-blur-sm border-[#242938]">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-linear-to-tr from-[#5B5DFF] to-[#00C2A8] text-white font-semibold flex items-center justify-center">
                {userInitials}
              </div>
              <div className="min-w-0">
                <CardTitle className="text-[#E6EAF2] truncate">
                  {profile?.name || "User"}
                </CardTitle>
                <CardDescription className="text-[#9AA3B2] truncate">
                  {profile?.email || "No email"}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-[#5B5DFF]/20 text-[#B8BBFF] border-[#5B5DFF]/30">
                {session?.role || "member"}
              </Badge>
              <Badge className="bg-[#00C2A8]/20 text-[#8DE7D9] border-[#00C2A8]/30">
                {session?.plan || organization?.plan || "free"}
              </Badge>
              <Badge className="bg-[#242938] text-[#E6EAF2] border-[#2C3244]">
                {profile?.provider || "unknown"}
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-[#9AA3B2] mb-1">Display Name</div>
                <Input
                  value={profileName}
                  onChange={(event) => setProfileName(event.target.value)}
                  className="bg-[#0F1117] border-[#242938] text-[#E6EAF2]"
                />
              </div>
              <div>
                <div className="text-xs text-[#9AA3B2] mb-1">Email</div>
                <Input
                  value={profile?.email || ""}
                  disabled
                  className="bg-[#0F1117] border-[#242938] text-[#9AA3B2]"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={saveProfile}
                disabled={saving}
                className="bg-[#5B5DFF] hover:bg-[#5B5DFF]/90 text-white"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? "Saving..." : "Save Profile"}
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  setRefreshing(true);
                  try {
                    await queryClient.invalidateQueries({
                      queryKey: ["profile-identity"],
                    });
                  } finally {
                    setRefreshing(false);
                  }
                }}
                disabled={refreshing}
                className="border-[#242938] text-[#E6EAF2] hover:bg-[#242938]"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                {refreshing ? "Refreshing..." : "Refresh"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#161A23]/80 backdrop-blur-sm border-[#242938]">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#00C2A8]" />
              <CardTitle className="text-[#E6EAF2]">
                Organization Access
              </CardTitle>
            </div>
            <CardDescription className="text-[#9AA3B2]">
              Your active organization and access context.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <div className="text-xs text-[#9AA3B2]">Organization</div>
              <div className="text-sm text-[#E6EAF2] font-medium wrap-break-word">
                {organization?.name || "No organization"}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-[#9AA3B2]">Organization ID</div>
              <button
                type="button"
                onClick={() =>
                  organization?.id &&
                  void copyValue(organization.id, "Organization ID")
                }
                className="w-full text-left text-xs text-[#B7C0D1] bg-[#0F1117] border border-[#242938] rounded-md px-3 py-2 hover:border-[#3A8DFF] transition-colors break-all"
              >
                {organization?.id || "Unavailable"}
              </button>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-[#9AA3B2]">Role</div>
              <div className="text-sm text-[#E6EAF2] capitalize">
                {session?.role || "member"}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-[#9AA3B2]">Plan</div>
              <div className="text-sm text-[#E6EAF2] capitalize">
                {session?.plan || organization?.plan || "free"}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#161A23]/80 backdrop-blur-sm border-[#242938]">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#3A8DFF]" />
              <CardTitle className="text-[#E6EAF2]">
                Identity Metadata
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-2 text-sm text-[#9AA3B2]">
              <User className="w-4 h-4 mt-0.5 text-[#5B5DFF]" />
              <div className="min-w-0">
                <div className="text-xs">User ID</div>
                <button
                  type="button"
                  onClick={() =>
                    profile?.id && void copyValue(profile.id, "User ID")
                  }
                  className="text-[#E6EAF2] break-all hover:text-[#B8BBFF] transition-colors"
                >
                  {profile?.id || "Unavailable"}
                </button>
              </div>
            </div>
            <div className="flex items-start gap-2 text-sm text-[#9AA3B2]">
              <Mail className="w-4 h-4 mt-0.5 text-[#00C2A8]" />
              <div className="min-w-0">
                <div className="text-xs">Email</div>
                <div className="text-[#E6EAF2] break-all">
                  {profile?.email || "Unavailable"}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2 text-sm text-[#9AA3B2]">
              <CalendarClock className="w-4 h-4 mt-0.5 text-[#F5B74F]" />
              <div>
                <div className="text-xs">Member Since</div>
                <div className="text-[#E6EAF2]">
                  {formatDate(profile?.created_at)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2 bg-[#161A23]/80 backdrop-blur-sm border-[#242938]">
          <CardHeader>
            <div className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-[#F5B74F]" />
              <CardTitle className="text-[#E6EAF2]">
                User-Centric Quick Actions
              </CardTitle>
            </div>
            <CardDescription className="text-[#9AA3B2]">
              Jump directly to your most common personal workflow areas.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Link href="/settings">
              <Button
                variant="outline"
                className="w-full justify-between border-[#242938] text-[#E6EAF2] hover:bg-[#242938]"
              >
                Account Settings
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/testing">
              <Button
                variant="outline"
                className="w-full justify-between border-[#242938] text-[#E6EAF2] hover:bg-[#242938]"
              >
                API Testing Workspace
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/apis">
              <Button
                variant="outline"
                className="w-full justify-between border-[#242938] text-[#E6EAF2] hover:bg-[#242938]"
              >
                My API Domains
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
