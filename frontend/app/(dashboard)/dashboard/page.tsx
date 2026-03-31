import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Network, FlaskConical, AlertTriangle, ArrowUpRight, BarChart3, Database } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="w-full space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[#E6EAF2] tracking-tight">Dashboard</h1>
        <p className="text-[#9AA3B2] mt-1">Welcome back. Here is the overview of your APIs and active tests.</p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-[#161A23]/80 backdrop-blur-sm border-[#242938] transition-all hover:translate-y-[-2px] hover:shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-[#9AA3B2]">Total APIs</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-[#5B5DFF]/10 flex items-center justify-center">
              <Network className="w-4 h-4 text-[#5B5DFF]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#E6EAF2]">12</div>
            <p className="text-xs text-[#00C2A8] flex items-center mt-1">
              <ArrowUpRight className="w-3 h-3 mr-1" /> +2 this week
            </p>
          </CardContent>
        </Card>
        
        <Card className="bg-[#161A23]/80 backdrop-blur-sm border-[#242938] transition-all hover:translate-y-[-2px] hover:shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-[#9AA3B2]">Total Endpoints</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-[#00C2A8]/10 flex items-center justify-center">
              <Database className="w-4 h-4 text-[#00C2A8]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#E6EAF2]">148</div>
            <p className="text-xs text-[#00C2A8] flex items-center mt-1">
              <ArrowUpRight className="w-3 h-3 mr-1" /> +14 this week
            </p>
          </CardContent>
        </Card>
        
        <Card className="bg-[#161A23]/80 backdrop-blur-sm border-[#242938] transition-all hover:translate-y-[-2px] hover:shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-[#9AA3B2]">Last Prediction Status</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-[#2ED573]/10 flex items-center justify-center">
              <Activity className="w-4 h-4 text-[#2ED573]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#2ED573]">Healthy</div>
            <p className="text-xs text-[#9AA3B2] mt-1">All systems normal</p>
          </CardContent>
        </Card>
        
        <Card className="bg-[#161A23]/80 backdrop-blur-sm border-[#242938] transition-all hover:translate-y-[-2px] hover:shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-[#9AA3B2]">Recent Tests</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-[#3A8DFF]/10 flex items-center justify-center">
              <FlaskConical className="w-4 h-4 text-[#3A8DFF]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#E6EAF2]">1,204</div>
            <p className="text-xs text-[#FF5C5C] flex items-center mt-1">
              <AlertTriangle className="w-3 h-3 mr-1" /> 12 failed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Coming Soon Features */}
      <div>
        <h2 className="text-xl font-bold text-[#E6EAF2] mb-4 tracking-tight">Upcoming Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-gradient-to-b from-[#161A23] to-[#0F1117] border-[#242938] overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-tr from-[#5B5DFF]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardHeader>
              <FlaskConical className="w-8 h-8 text-[#5B5DFF] mb-2" />
              <CardTitle className="text-lg text-[#E6EAF2]">ML Predictions</CardTitle>
              <CardDescription className="text-[#9AA3B2]">Predict API failures before they happen using our advanced machine learning engine.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="inline-block px-3 py-1 rounded-full bg-[#5B5DFF]/20 text-[#5B5DFF] text-xs font-semibold uppercase tracking-wider border border-[#5B5DFF]/30">
                Coming Soon
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-b from-[#161A23] to-[#0F1117] border-[#242938] overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-tr from-[#00C2A8]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardHeader>
              <BarChart3 className="w-8 h-8 text-[#00C2A8] mb-2" />
              <CardTitle className="text-lg text-[#E6EAF2]">API Telemetry</CardTitle>
              <CardDescription className="text-[#9AA3B2]">Deep visibility into endpoint latency, error rates, and traffic patterns.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="inline-block px-3 py-1 rounded-full bg-[#00C2A8]/20 text-[#00C2A8] text-xs font-semibold uppercase tracking-wider border border-[#00C2A8]/30">
                Coming Soon
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-b from-[#161A23] to-[#0F1117] border-[#242938] overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-tr from-[#F5B74F]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardHeader>
              <AlertTriangle className="w-8 h-8 text-[#F5B74F] mb-2" />
              <CardTitle className="text-lg text-[#E6EAF2]">Smart Alerts</CardTitle>
              <CardDescription className="text-[#9AA3B2]">Get notified about contract drifts and latency degradation over Slack and PagerDuty.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="inline-block px-3 py-1 rounded-full bg-[#F5B74F]/20 text-[#F5B74F] text-xs font-semibold uppercase tracking-wider border border-[#F5B74F]/30">
                Coming Soon
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
