"use client";
import { motion } from "framer-motion";
import type { SVGProps } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Terminal,
  Activity,
  Database,
  Lock,
  Cpu,
  Zap,
  CheckCircle2,
  ChevronRight,
  Code2,
  Network,
} from "lucide-react";
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0F1117] text-[#E6EAF2] font-sans selection:bg-[#5B5DFF]/30 overflow-hidden">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#5B5DFF] rounded-full blur-[150px] opacity-20" />
        <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] bg-[#00C2A8] rounded-full blur-[150px] opacity-15" />
        <div className="absolute bottom-[-10%] left-[20%] w-[60%] h-[40%] bg-[#3A8DFF] rounded-full blur-[150px] opacity-10" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(to right, #E6EAF2 1px, transparent 1px), linear-gradient(to bottom, #E6EAF2 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
            maskImage:
              "radial-gradient(ellipse at center, black 40%, transparent 80%)",
            WebkitMaskImage:
              "radial-gradient(ellipse at center, black 40%, transparent 80%)",
          }}
        />
      </div>
      <nav className="relative z-50 border-b border-[#242938]/50 bg-[#0F1117]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#5B5DFF] to-[#00C2A8] flex items-center justify-center shadow-[0_0_15px_rgba(91,93,255,0.4)]">
              <Network className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight text-white">
              ApiCortex
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-[#9AA3B2]">
            <Link
              href="#features"
              className="hover:text-white transition-colors"
            >
              Features
            </Link>
            <Link
              href="#how-it-works"
              className="hover:text-white transition-colors"
            >
              How it Works
            </Link>
            <Link
              href="#dev-experience"
              className="hover:text-white transition-colors"
            >
              Developers
            </Link>
            <Link href="#" className="hover:text-white transition-colors">
              Documentation
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-[#9AA3B2] hover:text-white transition-colors"
            >
              Sign In
            </Link>
            <Link href="/login">
              <Button className="bg-[#5B5DFF]/10 text-[#5B5DFF] border border-[#5B5DFF]/30 hover:bg-[#5B5DFF]/20 backdrop-blur-md rounded-full px-6 transition-all">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </nav>
      <main className="relative z-10">
        <section className="relative min-h-[calc(100vh-4rem)] flex items-center py-14 lg:py-20 px-6">
          <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <div className="inline-flex flex-row items-center justify-center p-1 rounded-full bg-[#161A23] border border-[#242938] mb-8 pr-4">
                <span className="px-3 py-1 text-xs font-semibold bg-[#5B5DFF] text-white rounded-full mr-3 shadow-[0_0_10px_rgba(91,93,255,0.5)]">
                  New
                </span>
                <span className="text-sm text-[#9AA3B2]">
                  Machine Learning Anomaly Detection is live
                </span>
              </div>
              <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight leading-[1.1] mb-6 text-transparent bg-clip-text bg-gradient-to-r from-white via-[#E6EAF2] to-[#9AA3B2]">
                Predict API Failures <br />
                Before They Break <br className="hidden lg:block" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#5B5DFF] to-[#00C2A8]">
                  Production.
                </span>
              </h1>
              <p className="text-lg text-[#9AA3B2] mb-10 max-w-xl leading-relaxed">
                ApiCortex continuously analyzes API traffic, detects anomalies,
                and validates contracts — so your APIs stay reliable at scale.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/login">
                  <Button className="h-14 px-8 bg-[#5B5DFF] hover:bg-[#5B5DFF]/90 text-white rounded-full font-medium text-lg w-full sm:w-auto shadow-[0_0_30px_rgba(91,93,255,0.4)] transition-all hover:scale-105">
                    Start Testing APIs
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
                <Link href="#">
                  <Button
                    variant="outline"
                    className="h-14 px-8 border-[#242938] bg-[#161A23]/50 backdrop-blur-xl hover:bg-[#242938] text-white rounded-full font-medium text-lg w-full sm:w-auto transition-all"
                  >
                    View Documentation
                  </Button>
                </Link>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
              className="relative lg:h-[600px] flex items-center justify-center"
            >
              <div className="relative w-full max-w-lg aspect-square">
                <svg
                  className="absolute inset-0 w-full h-full z-0 opacity-40"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  <motion.path
                    d="M10,50 Q40,10 70,50 T90,80"
                    fill="none"
                    stroke="#5B5DFF"
                    strokeWidth="0.5"
                    strokeDasharray="2 2"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  />
                  <motion.path
                    d="M10,80 Q30,60 60,80 T90,20"
                    fill="none"
                    stroke="#00C2A8"
                    strokeWidth="0.5"
                    strokeDasharray="2 2"
                    initial={{ pathLength: 0, opacity: 0.5 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  />
                </svg>
                <motion.div
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-[#161A23]/90 backdrop-blur-xl border border-[#242938] rounded-2xl p-6 shadow-2xl z-20"
                  animate={{ y: [-5, 5, -5] }}
                  transition={{
                    duration: 6,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#5B5DFF]/20 flex items-center justify-center">
                        <Activity className="w-5 h-5 text-[#5B5DFF]" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">
                          Live Traffic Analysis
                        </h3>
                        <p className="text-xs text-[#00C2A8]">
                          Processing 42.1k req/s
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-[#0F1117] rounded-xl p-4 font-mono text-xs text-[#9AA3B2] space-y-2 relative overflow-hidden">
                    <div className="flex justify-between">
                      <span className="text-[#3A8DFF]">GET /api/v1/users</span>
                      <span className="text-[#2ED573]">200 OK</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#3A8DFF]">
                        POST /api/v1/orders
                      </span>
                      <span className="text-[#F5B74F]">Latency Warning</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#3A8DFF]">
                        PATCH /api/v1/profile
                      </span>
                      <span className="text-[#FF5C5C]">Schema Mismatch</span>
                    </div>
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-b from-transparent via-[#5B5DFF]/10 to-transparent"
                      animate={{ top: ["-100%", "200%"] }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                    />
                  </div>
                </motion.div>
                <motion.div
                  className="absolute top-10 right-0 lg:-right-10 w-48 bg-[#161A23]/80 backdrop-blur-xl border border-[#242938] rounded-xl p-4 shadow-xl z-30"
                  animate={{ y: [0, -10, 0] }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 1,
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-[#FF5C5C] animate-pulse" />
                    <span className="text-xs font-semibold text-white">
                      Anomaly Detected
                    </span>
                  </div>
                  <div className="h-10 w-full bg-gradient-to-r from-[#242938] via-[#FF5C5C]/20 to-[#242938] rounded opacity-50 relative overflow-hidden">
                    <svg
                      className="w-full h-full"
                      viewBox="0 0 100 20"
                      preserveAspectRatio="none"
                    >
                      <path
                        d="M0,10 L20,10 L30,5 L40,15 L50,10 L60,10 L70,18 L80,2 L90,10 L100,10"
                        fill="none"
                        stroke="#FF5C5C"
                        strokeWidth="2"
                      />
                    </svg>
                  </div>
                </motion.div>
                <motion.div
                  className="absolute -bottom-10 left-0 lg:-left-10 w-56 bg-[#161A23]/80 backdrop-blur-xl border border-[#00C2A8]/30 rounded-xl p-4 shadow-xl z-30"
                  animate={{ y: [0, 10, 0] }}
                  transition={{
                    duration: 5,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 0.5,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-[#00C2A8]" />
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-white">
                        Contract Verified
                      </span>
                      <span className="text-xs text-[#9AA3B2]">
                        No breaking changes
                      </span>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </section>
        <section
          id="features"
          className="py-24 relative z-10 bg-[#0F1117]/50 backdrop-blur-3xl border-y border-[#242938]"
        >
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl md:text-5xl font-bold mb-6 text-white">
                Everything Your APIs Need <br className="hidden sm:block" />
                To Stay Reliable
              </h2>
              <p className="text-[#9AA3B2] text-lg">
                Purpose-built tools for modern engineering teams to proactively
                monitor, test, and validate their API infrastructure.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              {[
                {
                  title: "Predict Failures Early",
                  desc: "Machine learning detects abnormal latency and error patterns before incidents occur.",
                  icon: <Activity className="w-6 h-6 text-[#5B5DFF]" />,
                  color: "from-[#5B5DFF]",
                  visual: (
                    <div className="h-full w-full bg-[#161A23] rounded-lg border border-[#242938] overflow-hidden relative p-4 flex items-end">
                      <div className="absolute top-4 left-4 text-xs font-mono text-[#9AA3B2]">
                        Failure Probability:{" "}
                        <span className="text-[#FF5C5C]">84%</span>
                      </div>
                      <div className="w-full flex items-end gap-1 h-20">
                        {[20, 30, 25, 40, 35, 60, 85, 90, 40].map((h, i) => (
                          <div
                            key={i}
                            className={`w-full rounded-t-sm transition-all ${h > 70 ? "bg-[#FF5C5C]" : "bg-[#5B5DFF]"}`}
                            style={{ height: `${h}%` }}
                          />
                        ))}
                      </div>
                    </div>
                  ),
                },
                {
                  title: "Test APIs Like Postman",
                  desc: "Built-in API testing kit with request builder, response viewer, and contract validation.",
                  icon: <Terminal className="w-6 h-6 text-[#3A8DFF]" />,
                  color: "from-[#3A8DFF]",
                  visual: (
                    <div className="h-full w-full bg-[#161A23] rounded-lg border border-[#242938] p-4 flex flex-col gap-2 font-mono text-xs">
                      <div className="flex gap-2">
                        <span className="bg-[#242938] text-[#3A8DFF] px-2 py-1 rounded">
                          GET
                        </span>
                        <span className="bg-[#0F1117] border border-[#242938] text-[#E6EAF2] px-2 py-1 rounded flex-1 truncate">
                          api.acme.com/users
                        </span>
                      </div>
                      <div className="flex-1 bg-[#0F1117] border border-[#242938] rounded p-2 text-[#00C2A8]">
                        {`{ "status": 200, "data": [] }`}
                      </div>
                    </div>
                  ),
                },
                {
                  title: "Contract Intelligence",
                  desc: "Automatically detect schema mismatches, missing fields, and breaking changes.",
                  icon: <Code2 className="w-6 h-6 text-[#00C2A8]" />,
                  color: "from-[#00C2A8]",
                  visual: (
                    <div className="h-full w-full bg-[#161A23] rounded-lg border border-[#242938] p-4 font-mono text-[10px] sm:text-xs">
                      <div className="flex justify-between mb-2">
                        <span className="text-[#9AA3B2]">
                          Expected (OpenAPI)
                        </span>
                        <span className="text-[#9AA3B2]">Actual (Traffic)</span>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1 bg-[#0F1117] p-2 rounded border border-[#242938] text-[#9AA3B2]">
                          age: number
                        </div>
                        <div className="flex-1 bg-[#FF5C5C]/10 p-2 rounded border border-[#FF5C5C]/30 text-[#FF5C5C] relative overflow-hidden">
                          age: string
                          <div className="absolute right-2 top-2 w-2 h-2 rounded-full bg-[#FF5C5C] animate-pulse" />
                        </div>
                      </div>
                    </div>
                  ),
                },
                {
                  title: "Telemetry Insights",
                  desc: "Track latency, error rates, and request patterns across all endpoints globally.",
                  icon: <Globe2Icon className="w-6 h-6 text-[#F5B74F]" />,
                  color: "from-[#F5B74F]",
                  visual: (
                    <div className="h-full w-full bg-[#161A23] rounded-lg border border-[#242938] p-4 relative overflow-hidden group">
                      <svg
                        className="w-full h-full"
                        viewBox="0 0 100 40"
                        preserveAspectRatio="none"
                      >
                        <path
                          d="M0,30 Q25,10 50,20 T100,5"
                          fill="none"
                          stroke="#F5B74F"
                          strokeWidth="2"
                          className="opacity-50 group-hover:opacity-100 transition-opacity"
                        />
                        <path
                          d="M0,40 L0,30 Q25,10 50,20 T100,5 L100,40 Z"
                          fill="url(#gradient-orange)"
                          stroke="none"
                          className="opacity-20"
                        />
                        <defs>
                          <linearGradient
                            id="gradient-orange"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop offset="0%" stopColor="#F5B74F" />
                            <stop
                              offset="100%"
                              stopColor="#161A23"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                      </svg>
                    </div>
                  ),
                },
              ].map((feature, i) => (
                <div
                  key={i}
                  className="group relative bg-[#161A23] border border-[#242938] rounded-3xl p-8 hover:border-[#5B5DFF]/50 transition-colors overflow-hidden flex flex-col h-[350px]"
                >
                  <div
                    className={`absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl ${feature.color} to-transparent opacity-5 rounded-full blur-3xl group-hover:opacity-20 transition-opacity`}
                  />
                  <div className="w-12 h-12 rounded-xl bg-[#0F1117] border border-[#242938] flex items-center justify-center mb-6 relative z-10 group-hover:scale-110 transition-transform">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-3 relative z-10">
                    {feature.title}
                  </h3>
                  <p className="text-[#9AA3B2] mb-8 relative z-10 flex-1">
                    {feature.desc}
                  </p>
                  <div className="h-32 mt-auto relative z-10">
                    {feature.visual}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section id="how-it-works" className="py-24 relative z-10">
          <div className="max-w-7xl mx-auto px-6">
            <h2 className="text-3xl md:text-5xl font-bold mb-16 text-center text-white">
              From Traffic to Insights
            </h2>
            <div className="flex flex-col md:flex-row items-start justify-between relative">
              <div className="hidden md:block absolute top-[45px] left-[10%] right-[10%] h-px bg-gradient-to-r from-[#242938] via-[#5B5DFF] to-[#242938] z-0" />
              {[
                {
                  step: "01",
                  title: "Connect APIs",
                  desc: "Upload OpenAPI specs or integrate live telemetry feeds.",
                  icon: <Database className="w-6 h-6" />,
                },
                {
                  step: "02",
                  title: "Analyze Traffic",
                  desc: "ApiCortex processes telemetry and extracts patterns.",
                  icon: <Activity className="w-6 h-6" />,
                },
                {
                  step: "03",
                  title: "Predict Risk",
                  desc: "ML models detect anomalies and forecast failures.",
                  icon: <Cpu className="w-6 h-6" />,
                },
                {
                  step: "04",
                  title: "Act Promptly",
                  desc: "Get alerts and fix issues before users notice.",
                  icon: <Zap className="w-6 h-6" />,
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="relative z-10 flex flex-col items-center text-center w-full md:w-1/4 px-4 mb-12 md:mb-0"
                >
                  <div className="w-24 h-24 rounded-full bg-[#0F1117] border-2 border-[#242938] flex flex-col items-center justify-center mb-6 shadow-xl relative overflow-hidden group">
                    <div className="absolute inset-0 bg-[#5B5DFF]/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="text-[#5B5DFF] mb-1 relative z-10">
                      {item.icon}
                    </div>
                    <span className="text-[#9AA3B2] font-mono text-xs relative z-10">
                      Step {item.step}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    {item.title}
                  </h3>
                  <p className="text-[#9AA3B2] text-sm">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section
          id="dev-experience"
          className="py-24 relative z-10 bg-gradient-to-b from-[#0F1117] to-[#161A23] border-t border-[#242938]"
        >
          <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="relative shadow-2xl rounded-2xl border border-[#242938] bg-[#0F1117] overflow-hidden"
            >
              <div className="h-10 border-b border-[#242938] bg-[#161A23] flex items-center px-4 gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[#FF5C5C]" />
                  <div className="w-3 h-3 rounded-full bg-[#F5B74F]" />
                  <div className="w-3 h-3 rounded-full bg-[#2ED573]" />
                </div>
                <div className="ml-4 flex-1 text-center text-xs font-mono text-[#9AA3B2]">
                  ApiCortex Testing Kit
                </div>
              </div>
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 h-[400px]">
                <div className="bg-[#161A23] border border-[#242938] rounded-xl flex flex-col">
                  <div className="p-3 border-b border-[#242938] flex gap-2">
                    <span className="bg-[#5B5DFF] text-white px-2 py-1 rounded text-xs font-bold">
                      POST
                    </span>
                    <span className="bg-[#0F1117] border border-[#242938] text-white px-2 py-1 rounded text-xs font-mono flex-1 truncate">
                      /api/v2/charge
                    </span>
                  </div>
                  <div className="flex-1 p-3">
                    <pre className="font-mono text-[10px] text-[#00C2A8]">
                      {`{
  "amount": 2000,
  "currency": "usd",
  "source": "tok_visa"
}`}
                    </pre>
                  </div>
                  <div className="p-3 border-t border-[#242938]">
                    <Button className="w-full bg-[#5B5DFF] text-white h-8 text-xs relative overflow-hidden group">
                      <span className="relative z-10">Send Request</span>
                      <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
                    </Button>
                  </div>
                </div>
                <div className="bg-[#161A23] border border-[#242938] border-r-4 border-r-[#2ED573] rounded-xl flex flex-col relative overflow-hidden">
                  <div className="p-3 border-b border-[#242938] flex justify-between items-center bg-[#2ED573]/5">
                    <span className="text-[#2ED573] font-bold text-xs">
                      200 OK
                    </span>
                    <span className="text-[#9AA3B2] text-[10px] font-mono">
                      142ms
                    </span>
                  </div>
                  <div className="flex-1 p-3">
                    <pre className="font-mono text-[10px] text-[#E6EAF2]">
                      {`{
  "id": "ch_12345",
  "object": "charge",
  "amount": 2000,
  "paid": true,
  "status": "succeeded"
}`}
                    </pre>
                  </div>
                  <div className="absolute bottom-3 right-3 bg-[#0F1117] border border-[#242938] px-2 py-1 rounded text-[10px] flex items-center gap-1 text-[#00C2A8]">
                    <CheckCircle2 className="w-3 h-3" /> Contract Matches
                  </div>
                </div>
              </div>
            </motion.div>
            <div className="space-y-8">
              <h2 className="text-3xl md:text-5xl font-bold text-white">
                Built for Developers
              </h2>
              <p className="text-[#9AA3B2] text-lg">
                No more guessing why your endpoint failed in production.
                ApiCortex gives you the tools to test, monitor, and enforce
                schema contracts seamlessly.
              </p>
              <ul className="space-y-4">
                {[
                  "OpenAPI & Swagger natively supported",
                  "Real-time telemetry ingestion via SDK or proxy",
                  "CI/CD integration for contract testing before merging",
                  "Fast, Postman-style API testing interface built-in",
                  "Developer-first layout with zero clutter",
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-white">
                    <div className="w-6 h-6 rounded-full bg-[#5B5DFF]/20 flex flex-shrink-0 items-center justify-center">
                      <CheckCircle2 className="w-4 h-4 text-[#5B5DFF]" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
              <Button className="mt-4 bg-transparent border border-[#5B5DFF] text-[#5B5DFF] hover:bg-[#5B5DFF]/10 h-12 px-6 rounded-full group">
                Explore the Docs{" "}
                <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>
        </section>
        <section className="py-20 border-t border-[#242938] bg-[#0F1117]">
          <div className="max-w-7xl mx-auto px-6 text-center">
            <p className="text-sm font-semibold text-[#9AA3B2] tracking-widest uppercase mb-10">
              Trusted by Engineering Teams at
            </p>
            <div className="flex flex-wrap justify-center gap-12 sm:gap-24 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
              <div className="text-2xl font-bold text-white flex items-center gap-2">
                <div className="w-6 h-6 bg-white rounded-sm drop-shadow-md" />{" "}
                Acme Corp
              </div>
              <div className="text-2xl font-bold text-white flex items-center gap-2">
                <div className="w-6 h-6 rounded-full border-[4px] border-white" />{" "}
                GlobalNet
              </div>
              <div className="text-2xl font-bold text-white flex items-center gap-2">
                <Network className="w-6 h-6" /> DataSystem
              </div>
              <div className="text-2xl font-bold text-white flex items-center gap-2">
                <Lock className="w-6 h-6" /> SecureAPI
              </div>
            </div>
          </div>
        </section>
        <section className="py-32 relative overflow-hidden">
          <div className="absolute inset-0 bg-[#5B5DFF] opacity-[0.03] z-0" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#5B5DFF]/20 via-[#0F1117]/0 to-transparent z-0" />
          <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
            <h2 className="text-4xl md:text-6xl font-black text-white leading-tight mb-6">
              Stop Guessing.
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#5B5DFF] to-[#00C2A8]">
                Start Predicting API Failures.
              </span>
            </h2>
            <p className="text-[#9AA3B2] text-xl mb-10 max-w-2xl mx-auto">
              Join the future of API observability. Get machine-learning driven
              insights and contract validation in seconds.
            </p>
            <div className="flex flex-col items-center gap-4">
              <Link href="/login">
                <Button className="h-16 px-10 bg-white text-[#0F1117] hover:bg-[#F8F9FA] rounded-full font-bold text-lg shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:scale-105 transition-all">
                  Start Using ApiCortex
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <p className="text-sm text-[#9AA3B2]">
                Free tier available. No credit card required.
              </p>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-[#242938] bg-[#0F1117] pt-20 pb-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 mb-16">
            <div className="col-span-2 lg:col-span-2">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#5B5DFF] to-[#00C2A8] flex items-center justify-center">
                  <Network className="w-3 h-3 text-white" />
                </div>
                <span className="font-bold text-xl tracking-tight text-white">
                  ApiCortex
                </span>
              </div>
              <p className="text-[#9AA3B2] text-sm max-w-xs leading-relaxed">
                The intelligence layer for your API infrastructure. Predicting
                failures, testing contracts, and analyzing telemetry at scale.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-6">Product</h4>
              <ul className="space-y-4 text-sm text-[#9AA3B2]">
                <li>
                  <Link href="#" className="hover:text-white transition-colors">
                    API Testing
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-white transition-colors">
                    Telemetry
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-white transition-colors">
                    Predictions
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-white transition-colors">
                    Pricing
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-6">Developers</h4>
              <ul className="space-y-4 text-sm text-[#9AA3B2]">
                <li>
                  <Link href="#" className="hover:text-white transition-colors">
                    Documentation
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-white transition-colors">
                    API Reference
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-white transition-colors">
                    SDKs
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-white transition-colors">
                    Status
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-6">Company</h4>
              <ul className="space-y-4 text-sm text-[#9AA3B2]">
                <li>
                  <Link href="#" className="hover:text-white transition-colors">
                    About
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-white transition-colors">
                    Blog
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-white transition-colors">
                    GitHub
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-white transition-colors">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-[#242938] pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-[#9AA3B2] text-sm">
              © 2026 ApiCortex, Inc. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm text-[#9AA3B2]">
              <Link href="#" className="hover:text-white transition-colors">
                Privacy Policy
              </Link>
              <Link href="#" className="hover:text-white transition-colors">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
function Globe2Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}
