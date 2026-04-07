"use client";

import { useEffect, useState } from "react";
import { User, Users, Building2, Trash2, KeyRound } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api-client";
import type {
  IngestKeyRotateResult,
  IngestKeyStatus,
  Membership,
  Organization,
} from "@/lib/api-types";
import { useQuery, useQueryClient } from "@tanstack/react-query";

type Profile = {
  id: string;
  email: string;
  name: string;
  provider: string;
  created_at: string;
};

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingOrg, setSavingOrg] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [rotatingIngestKey, setRotatingIngestKey] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);
  const [members, setMembers] = useState<Membership[]>([]);
  const [ingestKeyStatus, setIngestKeyStatus] =
    useState<IngestKeyStatus | null>(null);
  const [latestIngestKey, setLatestIngestKey] = useState("");

  const [profileName, setProfileName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [orgPlan, setOrgPlan] = useState<Organization["plan"]>("free");

  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Membership["role"]>("member");

  const settingsQuery = useQuery({
    queryKey: ["settings-data"],
    queryFn: async () => {
      const [profileRes, orgRes] = await Promise.all([
        apiClient.get<Profile>("/auth/profile"),
        apiClient.get<Organization>("/orgs/current"),
      ]);
      const [membersRes, ingestKeyRes] = await Promise.all([
        apiClient.get<Membership[]>(`/orgs/${orgRes.data.id}/members`),
        apiClient.get<IngestKeyStatus>(`/orgs/${orgRes.data.id}/ingest-key`),
      ]);
      return {
        profile: profileRes.data,
        org: orgRes.data,
        members: membersRes.data,
        ingestKeyStatus: ingestKeyRes.data,
      };
    },
    staleTime: 2 * 60 * 1000,
  });

  const loading = settingsQuery.isLoading;

  useEffect(() => {
    if (!settingsQuery.data) {
      return;
    }
    setProfile(settingsQuery.data.profile);
    setOrg(settingsQuery.data.org);
    setMembers(settingsQuery.data.members);
    setIngestKeyStatus(settingsQuery.data.ingestKeyStatus);
    setProfileName(settingsQuery.data.profile.name);
    setOrgName(settingsQuery.data.org.name);
    setOrgPlan(settingsQuery.data.org.plan);
  }, [settingsQuery.data]);

  const saveProfile = async () => {
    if (!profileName.trim()) {
      toast.error("Profile name is required.");
      return;
    }
    setSavingProfile(true);
    try {
      const res = await apiClient.patch<Profile>("/auth/profile", {
        name: profileName.trim(),
      });
      setProfile(res.data);
      toast.success("Profile updated.");
    } catch {
      toast.error("Failed to update profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const saveOrganization = async () => {
    if (!org) {
      return;
    }
    if (!orgName.trim()) {
      toast.error("Organization name is required.");
      return;
    }
    setSavingOrg(true);
    try {
      const res = await apiClient.patch<Organization>(`/orgs/${org.id}`, {
        name: orgName.trim(),
        plan: orgPlan,
      });
      setOrg(res.data);
      toast.success("Organization updated.");
    } catch {
      toast.error("Failed to update organization.");
    } finally {
      setSavingOrg(false);
    }
  };

  const inviteMember = async () => {
    if (!org) {
      return;
    }
    if (!inviteName.trim() || !inviteEmail.trim()) {
      toast.error("Invite name and email are required.");
      return;
    }
    setInviting(true);
    try {
      await apiClient.post<Membership>(`/orgs/${org.id}/members`, {
        name: inviteName.trim(),
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      setInviteName("");
      setInviteEmail("");
      setInviteRole("member");
      await queryClient.invalidateQueries({ queryKey: ["settings-data"] });
      toast.success("Member invitation applied.");
    } catch {
      toast.error("Failed to invite member.");
    } finally {
      setInviting(false);
    }
  };

  const updateRole = async (userId: string, role: Membership["role"]) => {
    if (!org) {
      return;
    }
    try {
      await apiClient.patch(`/orgs/${org.id}/members/${userId}`, { role });
      setMembers((prev) =>
        prev.map((member) =>
          member.user_id === userId ? { ...member, role } : member,
        ),
      );
      toast.success("Member role updated.");
    } catch {
      toast.error("Failed to update member role.");
    }
  };

  const removeMember = async (userId: string) => {
    if (!org) {
      return;
    }
    try {
      await apiClient.delete(`/orgs/${org.id}/members/${userId}`);
      setMembers((prev) => prev.filter((member) => member.user_id !== userId));
      toast.success("Member removed.");
    } catch {
      toast.error("Failed to remove member.");
    }
  };

  const rotateIngestKey = async () => {
    if (!org) {
      return;
    }
    setRotatingIngestKey(true);
    try {
      const result = await apiClient.post<IngestKeyRotateResult>(
        `/orgs/${org.id}/ingest-key/rotate`,
      );
      setLatestIngestKey(result.data.api_key);
      setIngestKeyStatus({
        configured: true,
        updated_at: result.data.updated_at,
      });
      toast.success("Ingest API key rotated.");
    } catch {
      toast.error("Failed to rotate ingest API key.");
    } finally {
      setRotatingIngestKey(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="space-y-2">
          <Skeleton className="h-10 w-40 bg-[#242938]" />
          <Skeleton className="h-4 w-96 bg-[#161A23]" />
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Skeleton className="h-80 w-full bg-[#161A23] border border-[#242938] rounded-xl" />
          <Skeleton className="h-80 w-full bg-[#161A23] border border-[#242938] rounded-xl" />
        </div>
        <Skeleton className="h-72 w-full bg-[#161A23] border border-[#242938] rounded-xl" />
        <Skeleton className="h-64 w-full bg-[#161A23] border border-[#242938] rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#E6EAF2] tracking-tight">
          Settings
        </h1>
        <p className="text-[#9AA3B2] mt-1">
          Manage your profile, organization, and team access.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="bg-[#161A23]/80 backdrop-blur-sm border-[#242938]">
          <CardHeader>
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-[#5B5DFF]" />
              <CardTitle className="text-[#E6EAF2]">User Profile</CardTitle>
            </div>
            <CardDescription className="text-[#9AA3B2]">
              Update your account display information.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-xs text-[#9AA3B2] mb-1">Email</div>
              <Input
                value={profile?.email || ""}
                disabled
                className="bg-[#0F1117] border-[#242938] text-[#9AA3B2]"
              />
            </div>
            <div>
              <div className="text-xs text-[#9AA3B2] mb-1">Name</div>
              <Input
                value={profileName}
                onChange={(event) => setProfileName(event.target.value)}
                className="bg-[#0F1117] border-[#242938] text-[#E6EAF2]"
              />
            </div>
            <Button
              onClick={saveProfile}
              disabled={savingProfile}
              className="bg-[#5B5DFF] hover:bg-[#5B5DFF]/90 text-white"
            >
              {savingProfile ? "Saving..." : "Save Profile"}
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-[#161A23]/80 backdrop-blur-sm border-[#242938]">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Building2 className="w-5 h-5 text-[#00C2A8]" />
              <CardTitle className="text-[#E6EAF2]">Organization</CardTitle>
            </div>
            <CardDescription className="text-[#9AA3B2]">
              Manage your organization identity and subscription plan.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-xs text-[#9AA3B2] mb-1">
                Organization Name
              </div>
              <Input
                value={orgName}
                onChange={(event) => setOrgName(event.target.value)}
                className="bg-[#0F1117] border-[#242938] text-[#E6EAF2]"
              />
            </div>
            <div>
              <div className="text-xs text-[#9AA3B2] mb-1">Plan</div>
              <Select
                value={orgPlan}
                onValueChange={(value) =>
                  setOrgPlan(value as Organization["plan"])
                }
              >
                <SelectTrigger className="bg-[#0F1117] border-[#242938] text-[#E6EAF2]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#161A23] border-[#242938] text-[#E6EAF2]">
                  <SelectItem value="free">free</SelectItem>
                  <SelectItem value="pro">pro</SelectItem>
                  <SelectItem value="business">business</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={saveOrganization}
              disabled={savingOrg}
              className="bg-[#00C2A8] hover:bg-[#00C2A8]/90 text-white"
            >
              {savingOrg ? "Saving..." : "Save Organization"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-[#161A23]/80 backdrop-blur-sm border-[#242938]">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-[#3A8DFF]" />
            <CardTitle className="text-[#E6EAF2]">Team Members</CardTitle>
          </div>
          <CardDescription className="text-[#9AA3B2]">
            Invite users and manage roles for this organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
            <Input
              value={inviteName}
              onChange={(event) => setInviteName(event.target.value)}
              placeholder="Name"
              className="bg-[#0F1117] border-[#242938] text-[#E6EAF2]"
            />
            <Input
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder="Email"
              className="bg-[#0F1117] border-[#242938] text-[#E6EAF2]"
            />
            <Select
              value={inviteRole}
              onValueChange={(value) =>
                setInviteRole(value as Membership["role"])
              }
            >
              <SelectTrigger className="bg-[#0F1117] border-[#242938] text-[#E6EAF2]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#161A23] border-[#242938] text-[#E6EAF2]">
                <SelectItem value="member">member</SelectItem>
                <SelectItem value="admin">admin</SelectItem>
                <SelectItem value="owner">owner</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={inviteMember}
              disabled={inviting}
              className="bg-[#5B5DFF] hover:bg-[#5B5DFF]/90 text-white"
            >
              {inviting ? "Inviting..." : "Invite Member"}
            </Button>
          </div>

          <div className="space-y-2">
            {members.map((member) => (
              <div
                key={member.user_id}
                className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 p-3 border border-[#242938] rounded-xl bg-[#0F1117]"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[#E6EAF2] font-medium truncate">
                    {member.name}
                  </div>
                  <div className="text-[#9AA3B2] text-sm truncate">
                    {member.email}
                  </div>
                </div>
                <div className="w-full md:w-40">
                  <Select
                    value={member.role}
                    onValueChange={(value) =>
                      updateRole(member.user_id, value as Membership["role"])
                    }
                  >
                    <SelectTrigger className="bg-[#161A23] border-[#242938] text-[#E6EAF2]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#161A23] border-[#242938] text-[#E6EAF2]">
                      <SelectItem value="member">member</SelectItem>
                      <SelectItem value="admin">admin</SelectItem>
                      <SelectItem value="owner">owner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="destructive"
                  onClick={() => removeMember(member.user_id)}
                  className="md:w-auto w-full bg-[#FF5C5C] hover:bg-[#FF5C5C]/90"
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Remove
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#161A23]/80 backdrop-blur-sm border-[#242938]">
        <CardHeader>
          <div className="flex items-center gap-3">
            <KeyRound className="w-5 h-5 text-[#F5B74F]" />
            <CardTitle className="text-[#E6EAF2]">Ingest API Key</CardTitle>
          </div>
          <CardDescription className="text-[#9AA3B2]">
            Rotate organization-scoped ingestion key used by the ingest service.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-[#9AA3B2]">
            Status:{" "}
            <span className="text-[#E6EAF2]">
              {ingestKeyStatus?.configured ? "configured" : "not configured"}
            </span>
          </div>
          <div className="text-sm text-[#9AA3B2]">
            Last rotated:{" "}
            <span className="text-[#E6EAF2]">
              {ingestKeyStatus?.updated_at
                ? new Date(ingestKeyStatus.updated_at).toLocaleString()
                : "never"}
            </span>
          </div>
          {latestIngestKey && (
            <Input
              value={latestIngestKey}
              readOnly
              className="bg-[#0F1117] border-[#242938] text-[#E6EAF2] font-mono"
            />
          )}
          <Button
            onClick={rotateIngestKey}
            disabled={rotatingIngestKey}
            className="bg-[#F5B74F] hover:bg-[#F5B74F]/90 text-[#111111]"
          >
            {rotatingIngestKey ? "Rotating..." : "Rotate Ingest Key"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
