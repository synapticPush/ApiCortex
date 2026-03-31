import { BarChart3 } from "lucide-react";

export default function TelemetryPage() {
  return (
    <div className="h-[calc(100vh-8rem)] w-full flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background illustration */}
      <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
        <div className="w-[800px] h-[400px] border border-[#00C2A8] rounded-full blur-[100px] absolute mix-blend-screen" />
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" className="absolute">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#242938" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <div className="z-10 bg-[#161A23]/80 backdrop-blur-xl border border-[#242938] rounded-2xl p-10 max-w-lg w-full text-center shadow-[0_20px_60px_rgba(0,0,0,0.4)] relative mt-[-10%]">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#00C2A8] to-[#3A8DFF]" />
        
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-[#00C2A8]/20 to-[#3A8DFF]/20 flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(0,194,168,0.2)] border border-[#00C2A8]/30">
          <BarChart3 className="w-10 h-10 text-[#00C2A8]" />
        </div>
        
        <h2 className="text-2xl font-bold text-[#E6EAF2] mb-3 tracking-tight">API Telemetry Tracking</h2>
        <p className="text-[#9AA3B2] mb-6">Deep visibility into your API performance, endpoint latency, error rates, and traffic patterns is currently under development.</p>
        
        <div className="inline-block px-4 py-2 rounded-full bg-[#161A23] border border-[#242938] text-[#E6EAF2] text-sm font-medium shadow-inner">
          <span className="text-[#00C2A8] mr-2">●</span> Coming Soon
        </div>
      </div>
    </div>
  );
}
