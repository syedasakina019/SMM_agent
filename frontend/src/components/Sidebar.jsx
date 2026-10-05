import { useRouter } from "next/router";
import Link from "next/link";
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  Megaphone, 
  BarChart3,
  Calendar,
  Settings,
  Sparkles,
  Bot
} from "lucide-react";

export default function Sidebar() {
  const router = useRouter();

  const navItems = [
    { name: "Dashboard", path: "/", icon: LayoutDashboard },
    { name: "Content", path: "/posts", icon: FileText },
    { name: "Community", path: "/community", icon: Users },
    { name: "Ads", path: "/ads", icon: Megaphone },
    { name: "Analytics", path: "/analytics", icon: BarChart3 },
    { name: "Calendar", path: "/calendar", icon: Calendar },
    { name: "Settings", path: "/settings", icon: Settings },
    { name: "Privacy Policy", path: "/privacy-policy", icon: FileText },
  ];

  return (
    <aside className="fixed left-0 top-16 w-[240px] h-[calc(100vh-4rem)] bg-primary-navy hidden md:flex flex-col z-40 transition-all duration-300">
      
      {/* Logo & Tagline Area */}
      <div className="pt-6 pb-6 px-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-accent-purple to-accent-blue text-white shadow-md shadow-accent-purple/20">
            <Sparkles size={18} />
          </div>
          <span className="font-bold text-xl text-white tracking-tight">
            SocialMind AI
          </span>
        </div>
        <p className="text-white/50 text-xs font-medium mt-2">
          Smarter Social. Bigger Impact.
        </p>
      </div>
      
      {/* Navigation */}
      <div className="flex-1 py-6 px-4 flex flex-col gap-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = router.pathname === item.path;
          const Icon = item.icon;

          return (
            <Link 
              key={item.name} 
              href={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-all duration-200 group ${
                isActive 
                  ? "bg-accent-purple text-white shadow-sm" 
                  : "text-white/60 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon 
                size={20} 
                className={`transition-colors duration-200 ${
                  isActive ? "text-white" : "text-white/50 group-hover:text-white/80"
                }`}
              />
              {item.name}
            </Link>
          );
        })}
      </div>

      {/* AI Agent Status Card */}
      <div className="p-4 mb-4 mx-4 rounded-xl bg-white/5 border border-white/10">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded-md bg-accent-blue/20 text-accent-blue">
            <Bot size={16} />
          </div>
          <span className="text-white text-sm font-semibold">AI Agent</span>
        </div>
        <p className="text-white/50 text-xs leading-relaxed mb-3">
          Your social media assistant is working 24/7
        </p>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-success"></div>
          <span className="text-success text-xs font-medium">Online</span>
        </div>
      </div>
    </aside>
  );
}
