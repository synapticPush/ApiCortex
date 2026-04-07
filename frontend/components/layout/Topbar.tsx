"use client";
import {
  Bell,
  Search,
  ChevronDown,
  User,
  Settings,
  LogOut,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import type {
  AuthSession,
  Organization,
  User as AppUser,
} from "@/lib/api-types";

export function Topbar() {
  const router = useRouter();

  const [profile, setProfile] = useState<AppUser | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadIdentity = async () => {
      try {
        const [profileRes, orgRes, sessionRes] = await Promise.all([
          apiClient.get<AppUser>("/auth/profile"),
          apiClient.get<Organization>("/orgs/current"),
          apiClient.get<AuthSession>("/auth/me"),
        ]);
        if (!mounted) {
          return;
        }
        setProfile(profileRes.data);
        setOrganization(orgRes.data);
        setSession(sessionRes.data);
      } catch {
        if (!mounted) {
          return;
        }
        setProfile(null);
        setOrganization(null);
        setSession(null);
      }
    };
    void loadIdentity();
    return () => {
      mounted = false;
    };
  }, []);

  const displayName = profile?.name?.trim() || "User";
  const displayEmail = profile?.email?.trim() || "No email";
  const displayOrg = organization?.name?.trim() || "No Organization";
  const roleLabel = session?.role
    ? `${session.role.charAt(0).toUpperCase()}${session.role.slice(1)}`
    : "Member";

  const userInitials = useMemo(() => {
    const seed = displayName.trim();
    const value = seed
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    return value || "U";
  }, [displayName]);

  const orgInitials = useMemo(() => {
    const seed = displayOrg.trim();
    const value = seed
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    return value || "OR";
  }, [displayOrg]);

  const handleLogout = async () => {
    try {
      await apiClient.post("/auth/logout");
    } catch {
    } finally {
      document.cookie =
        "acx_access=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie =
        "acx_refresh=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie =
        "acx_csrf=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      router.push("/login");
      router.refresh();
    }
  };

  return (
    <div className="h-16 border-b border-[#242938] bg-[#0F1117]/80 backdrop-blur-xl sticky top-0 z-40 flex items-center justify-between px-6">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9AA3B2]" />
          <Input
            type="text"
            placeholder="Search APIs, endpoints, tests..."
            className="pl-9 bg-[#161A23] border-[#242938] text-[#E6EAF2] placeholder:text-[#9AA3B2] focus-visible:ring-[#5B5DFF] h-9 rounded-lg"
          />
        </div>
      </div>
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2 cursor-pointer hover:bg-[#161A23] px-3 py-1.5 rounded-lg transition-colors border border-transparent hover:border-[#242938]">
          <div className="w-5 h-5 rounded bg-linear-to-tr from-[#5B5DFF] to-[#3A8DFF] flex items-center justify-center text-[10px] font-bold text-white shadow-sm">
            {orgInitials}
          </div>
          <span className="text-sm font-medium text-[#E6EAF2]">
            {displayOrg}
          </span>
          <ChevronDown className="w-4 h-4 text-[#9AA3B2]" />
        </div>
        <div className="flex items-center gap-4 border-l border-[#242938] pl-5">
          <button className="relative text-[#9AA3B2] hover:text-[#E6EAF2] transition-colors rounded-full p-1 hover:bg-[#161A23]">
            <Bell className="w-5 h-5" />
            <span className="absolute top-0.5 right-1 w-2 h-2 bg-[#FF5C5C] rounded-full border border-[#0F1117]"></span>
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger className="outline-none">
              <Avatar className="w-8 h-8 cursor-pointer ring-2 ring-transparent hover:ring-[#5B5DFF] transition-all">
                <AvatarImage src="" />
                <AvatarFallback>{userInitials}</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-56 bg-[#161A23] border-[#242938] text-[#E6EAF2] rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)]"
              align="end"
            >
              <div className="px-2 py-1.5 text-sm font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none text-white">
                    {displayName}
                  </p>
                  <p className="text-xs leading-none text-[#9AA3B2]">
                    {displayEmail}
                  </p>
                  <p className="text-xs leading-none text-[#9AA3B2]">
                    {roleLabel}
                  </p>
                </div>
              </div>
              <DropdownMenuSeparator className="bg-[#242938]" />
              <DropdownMenuGroup>
                <Link href="/profile" prefetch>
                  <DropdownMenuItem className="cursor-pointer focus:bg-[#242938] focus:text-white group">
                    <User className="mr-2 h-4 w-4 text-[#9AA3B2] group-hover:text-white" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                </Link>
                <Link href="/settings" prefetch>
                  <DropdownMenuItem className="cursor-pointer focus:bg-[#242938] focus:text-white group">
                    <Settings className="mr-2 h-4 w-4 text-[#9AA3B2] group-hover:text-white" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                </Link>
              </DropdownMenuGroup>
              <DropdownMenuSeparator className="bg-[#242938]" />
              <DropdownMenuItem
                className="cursor-pointer focus:bg-[#242938] text-[#FF5C5C] focus:text-[#FF5C5C] group"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4 text-[#FF5C5C]" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
