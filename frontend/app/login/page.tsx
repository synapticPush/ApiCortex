"use client";

import { Button } from "@/components/ui/button";
import { Network } from "lucide-react";

export default function LoginPage() {
  const handleLogin = () => {
    // In actual implementation, this would redirect to Neon Auth
    document.cookie = "authToken=mock_jwt_token_for_mvp; path=/";
    window.location.href = "/dashboard";
  };

  return (
    <div className="min-h-screen bg-[#0F1117] flex relative overflow-hidden">
      {/* Abstract Background Elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#5B5DFF]/20 blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#00C2A8]/20 blur-[120px]" />
      
      {/* Grid Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#242938_1px,transparent_1px),linear-gradient(to_bottom,#242938_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20" />

      <div className="flex-1 flex flex-col justify-center items-center z-10 px-6">
        <div className="w-full max-w-md bg-[#161A23]/80 backdrop-blur-xl border border-[#242938] rounded-2xl p-8 shadow-[0_10px_40px_rgba(0,0,0,0.25)] relative overflow-hidden">
          
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#5B5DFF] via-[#00C2A8] to-[#3A8DFF]" />
          
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#5B5DFF] to-[#00C2A8] flex items-center justify-center shadow-[0_0_20px_rgba(91,93,255,0.4)] mb-6">
              <Network className="text-white w-7 h-7" />
            </div>
            <h1 className="text-3xl font-bold text-[#E6EAF2] tracking-tight mb-2">Welcome to ApiCortex</h1>
            <p className="text-[#9AA3B2] text-center text-sm">Predict API failures before they happen and validate contracts in real-time.</p>
          </div>

          <div className="space-y-4">
            <Button 
              onClick={handleLogin}
              className="w-full h-12 bg-white text-black hover:bg-gray-100 flex items-center justify-center gap-3 transition-all rounded-xl font-semibold border border-transparent hover:border-[#242938]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5">
                <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
                <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
                <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
                <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
              </svg>
              Sign in with Google
            </Button>
            
            <p className="text-xs text-center text-[#9AA3B2] px-4">
              By clicking continue, you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
