import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="space-y-2">
        <Skeleton className="h-10 w-64 bg-[#242938]" />
        <Skeleton className="h-4 w-96 bg-[#161A23]" />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-32 w-full rounded-xl bg-[#161A23] border border-[#242938]" />
        ))}
      </div>
      
      <div className="space-y-4 pt-8">
        <Skeleton className="h-8 w-48 bg-[#242938]" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-64 w-full rounded-xl bg-[#161A23] border border-[#242938]" />
          ))}
        </div>
      </div>
    </div>
  );
}
