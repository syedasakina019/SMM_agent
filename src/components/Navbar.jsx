import { Search, Bell } from "lucide-react";

export default function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-border z-50 flex items-center justify-between px-6 transition-all duration-300">
      
      {/* Left side: Search */}
      <div className="flex items-center w-full max-w-md">
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-secondary">
            <Search size={18} />
          </div>
          <input
            type="text"
            placeholder="Search anything..."
            className="w-full pl-10 pr-4 py-2 bg-surface border border-transparent rounded-lg focus:bg-white focus:border-border focus:ring-2 focus:ring-accent-purple/20 outline-none text-sm text-text-primary placeholder:text-text-secondary transition-all"
          />
        </div>
      </div>

      {/* Right side: Notifications & Profile */}
      <div className="flex items-center gap-6">
        
        {/* Notifications */}
        <button className="relative p-2 text-text-secondary hover:text-text-primary hover:bg-surface rounded-full transition-colors">
          <Bell size={20} />
          {/* Red dot */}
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-danger border border-white"></span>
        </button>

        {/* Vertical divider */}
        <div className="h-8 w-[1px] bg-border"></div>

        {/* Profile Section */}
        <div className="flex items-center gap-3 cursor-pointer group">
          <div className="w-9 h-9 rounded-full bg-accent-blue/10 flex items-center justify-center border border-accent-blue/20 overflow-hidden shrink-0 group-hover:border-accent-purple/40 transition-colors">
            {/* Avatar placeholder image or initials */}
            <span className="text-accent-blue font-bold text-sm">BO</span>
          </div>
          <div className="flex flex-col hidden sm:flex">
            <span className="text-sm font-bold text-text-primary leading-tight">
              Business Owner
            </span>
            <span className="text-xs font-medium text-text-secondary leading-tight mt-0.5">
              Client
            </span>
          </div>
        </div>
        
      </div>
    </nav>
  );
}
