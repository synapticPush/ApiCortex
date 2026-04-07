"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  BarChart3,
  FlaskConical,
  LayoutDashboard,
  Network,
  User,
  Settings,
  TerminalSquare,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "API Testing", href: "/testing", icon: TerminalSquare },
  { name: "APIs", href: "/apis", icon: Network },
  { name: "Telemetry", href: "/telemetry", icon: BarChart3 },
  { name: "Predictions", href: "/predictions", icon: FlaskConical },
  { name: "Profile", href: "/profile", icon: User },
  { name: "Settings", href: "/settings", icon: Settings },
];
interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}
export function Sidebar({ isCollapsed, setIsCollapsed }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    for (const item of navItems) {
      router.prefetch(item.href);
    }
  }, [router]);

  return (
    <div
      className={cn(
        "border-r border-[#242938] bg-[#0F1117] h-screen fixed top-0 left-0 hidden md:flex flex-col z-50 transition-all duration-300",
        isCollapsed ? "w-20" : "w-64",
      )}
    >
      <div className="h-16 flex items-center justify-between px-4 border-b border-[#242938]">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 rounded-lg shrink-0 bg-gradient-to-tr from-[#5B5DFF] to-[#00C2A8] flex items-center justify-center shadow-[0_0_15px_rgba(91,93,255,0.4)]">
            <Network className="text-white w-5 h-5" />
          </div>
          {!isCollapsed && (
            <span className="font-bold text-xl text-[#E6EAF2] tracking-tight whitespace-nowrap">
              ApiCortex
            </span>
          )}
        </div>
        {!isCollapsed && (
          <button
            onClick={() => setIsCollapsed(true)}
            className="text-[#9AA3B2] hover:text-[#E6EAF2] transition-colors"
          >
            <PanelLeftClose className="w-5 h-5" />
          </button>
        )}
      </div>
      {isCollapsed && (
        <div className="flex justify-center pt-4">
          <button
            onClick={() => setIsCollapsed(false)}
            className="text-[#9AA3B2] hover:text-[#E6EAF2] transition-colors"
          >
            <PanelLeftOpen className="w-5 h-5" />
          </button>
        </div>
      )}
      <div className="flex-1 overflow-y-auto py-6 px-3 overflow-x-hidden">
        <div className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                scroll={false}
                onMouseEnter={() => router.prefetch(item.href)}
                title={isCollapsed ? item.name : undefined}
                className={cn(
                  "flex items-center gap-3 py-2.5 rounded-xl transition-all duration-200 group text-sm font-medium relative",
                  isCollapsed ? "justify-center px-0" : "px-3",
                  isActive
                    ? "bg-[#161A23] text-[#E6EAF2]"
                    : "text-[#9AA3B2] hover:bg-[#161A23] hover:text-[#E6EAF2]",
                )}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-[#3A8DFF] rounded-r-full shadow-[0_0_10px_2px_rgba(58,141,255,0.4)]" />
                )}
                <item.icon
                  className={cn(
                    "w-5 h-5 shrink-0 transition-colors",
                    isActive
                      ? "text-[#3A8DFF]"
                      : "text-[#9AA3B2] group-hover:text-[#E6EAF2]",
                  )}
                />
                {!isCollapsed && <span className="truncate">{item.name}</span>}
              </Link>
            );
          })}
        </div>
      </div>
      {!isCollapsed && (
        <div className="p-4 border-t border-[#242938]">
          <div className="bg-[#161A23] rounded-xl p-4 border border-[#242938]">
            <p className="text-xs text-[#E6EAF2] mb-3 font-medium flex justify-between">
              <span>Monthly Requests</span>
              <span className="text-[#3A8DFF]">45%</span>
            </p>
            <div className="w-full bg-[#0F1117] rounded-full h-1.5 mb-2 overflow-hidden">
              <div className="bg-gradient-to-r from-[#5B5DFF] to-[#00C2A8] h-full rounded-full w-[45%]"></div>
            </div>
            <p className="text-[10px] text-[#9AA3B2]">4.5M / 10M Limit</p>
          </div>
        </div>
      )}
    </div>
  );
}
