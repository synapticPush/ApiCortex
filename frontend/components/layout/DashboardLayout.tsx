"use client";
import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { cn } from "@/lib/utils";

/**
 * Shared dashboard shell with sidebar navigation, topbar identity controls,
 * and a responsive content container for nested pages.
 */
export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  return (
    <div className="min-h-screen bg-[#0F1117] flex">
      <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
      <div className={cn(
        "flex-1 flex flex-col transition-all duration-300",
        isCollapsed ? "md:pl-20" : "md:pl-64"
      )}>
        <Topbar />
        <main className="flex-1 p-6 overflow-x-hidden relative flex flex-col min-w-0">
          <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-br from-[#5B5DFF]/[0.03] via-transparent to-transparent pointer-events-none z-0" />
          <div className="relative z-10 flex-1 flex flex-col">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
