import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Users, Heart, DollarSign, Eye, ChevronDown, 
  Bot, ArrowRight, FileText 
} from 'lucide-react';
import { getDashboardSummary } from '../utils/api';

const FacebookIcon = ({ size = 20, className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
  </svg>
);

const InstagramIcon = ({ size = 20, className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
  </svg>
);
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';

const sparklineData = [
  { value: 400 }, { value: 300 }, { value: 550 }, { value: 480 }, { value: 700 }, { value: 680 }, { value: 850 }
];

const performanceData = [
  { name: 'Mon', reach: 4000, engagement: 2400 },
  { name: 'Tue', reach: 3000, engagement: 1398 },
  { name: 'Wed', reach: 2000, engagement: 9800 },
  { name: 'Thu', reach: 2780, engagement: 3908 },
  { name: 'Fri', reach: 1890, engagement: 4800 },
  { name: 'Sat', reach: 2390, engagement: 3800 },
  { name: 'Sun', reach: 3490, engagement: 4300 },
];

export default function Dashboard() {
  const [dashboardData, setDashboardData] = useState(null);
  const [today, setToday] = useState('');

  useEffect(() => {
    setToday(new Date().toLocaleDateString('en-US', { 
      timeZone: 'Asia/Karachi', 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    }));
    getDashboardSummary().then(data => {
      if (data) setDashboardData(data);
    });
  }, []);

  return (
    <div className="flex flex-col gap-8 pb-8">
      {/* 1. Greeting Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mt-2">
        <div>
          <h1 className="text-3xl font-bold text-text-primary flex items-center gap-2 tracking-tight">
            Good Morning, Sakina! <span>👋</span>
          </h1>
          <p className="text-text-secondary mt-1.5 font-medium">
            Here's what's happening with your social media today.
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-text-secondary">{today}</span>
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-border rounded-xl text-sm font-semibold text-text-primary hover:bg-surface transition-colors shadow-sm">
            Last 7 days <ChevronDown size={16} className="text-text-secondary" />
          </button>
        </div>
      </div>

      {/* 2. Stat Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 lg:grid-cols-3 gap-6">
        <StatCard 
          title="Total Followers" 
          value="24,592" 
          change="+12.5%" 
          icon={Users} 
          color="accent-purple" 
          previewLabel="Preview data — connect your account for live stats"
        />
        <StatCard 
          title="Total Engagement" 
          value="1,204" 
          change="+5.2%" 
          icon={Heart} 
          color="danger" 
          previewLabel="Preview data — connect your account for live stats"
        />
        <StatCard 
          title="Ad Spend" 
          value="$4,320" 
          change="+2.1%" 
          icon={DollarSign} 
          color="warning" 
          previewLabel="Preview data — connect your account for live stats"
        />
        <StatCard 
          title="Total Reach" 
          value="89,430" 
          change="+18.4%" 
          icon={Eye} 
          color="accent-blue" 
          previewLabel="Preview data — connect your account for live stats"
        />
        <StatCard 
          title="Posts Created" 
          value={dashboardData?.total_posts || 0} 
          change="" 
          icon={FileText} 
          color="success" 
          customSubtitle={`${dashboardData?.draft_count || 0} drafts · ${dashboardData?.scheduled_count || 0} scheduled · ${dashboardData?.published_count || 0} published`}
        />
      </div>

      {/* 3. Two-Column Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Performance Overview Chart */}
        <div className="card p-6 lg:col-span-2 flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold text-text-primary">Performance Overview</h2>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-4 text-sm font-medium">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-accent-purple"></div>
                  <span className="text-text-secondary">Reach</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-accent-blue"></div>
                  <span className="text-text-secondary">Engagement</span>
                </div>
              </div>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface transition-colors">
                Last 7 days <ChevronDown size={14} />
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={performanceData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12, fontWeight: 500 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12, fontWeight: 500 }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ fontWeight: 600 }}
                />
                <Line type="monotone" dataKey="reach" stroke="#6C4CF6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                <Line type="monotone" dataKey="engagement" stroke="#3B82F6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Stack */}
        <div className="flex flex-col gap-6 lg:col-span-1">
          {/* Connected Accounts */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-text-primary">Connected Accounts</h2>
              <a href="#" className="text-sm font-semibold text-accent-blue hover:underline">Manage</a>
            </div>
            <div className="flex flex-col gap-3">
              <div className={`flex flex-wrap items-center justify-between p-3 rounded-xl border border-border transition-colors gap-3 ${dashboardData?.accounts_connected?.instagram ? 'hover:border-accent-purple/30' : 'opacity-80'}`}>
                <div className="flex items-center gap-3 min-w-[140px]">
                  <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center ${dashboardData?.accounts_connected?.instagram ? 'bg-pink-50 text-pink-500' : 'bg-surface text-text-secondary'}`}>
                    <InstagramIcon size={20} />
                  </div>
                  <span className="font-semibold text-text-primary truncate">@yourbrand</span>
                </div>
                {dashboardData?.accounts_connected?.instagram ? (
                  <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-success/10 text-success shrink-0">Connected</span>
                ) : (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-surface text-text-secondary whitespace-nowrap">Not Connected</span>
                    <button className="px-3 py-1 text-xs font-bold rounded-md bg-accent-purple text-white hover:bg-accent-purple/90 transition-colors whitespace-nowrap">Connect</button>
                  </div>
                )}
              </div>
              <div className={`flex flex-wrap items-center justify-between p-3 rounded-xl border border-border transition-colors gap-3 ${dashboardData?.accounts_connected?.facebook ? 'hover:border-accent-blue/30' : 'opacity-80'}`}>
                <div className="flex items-center gap-3 min-w-[140px]">
                  <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center ${dashboardData?.accounts_connected?.facebook ? 'bg-blue-50 text-blue-600' : 'bg-surface text-text-secondary'}`}>
                    <FacebookIcon size={20} />
                  </div>
                  <span className="font-semibold text-text-primary truncate">Your Facebook Page</span>
                </div>
                {dashboardData?.accounts_connected?.facebook ? (
                  <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-success/10 text-success shrink-0">Connected</span>
                ) : (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-surface text-text-secondary whitespace-nowrap">Not Connected</span>
                    <button className="px-3 py-1 text-xs font-bold rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors whitespace-nowrap">Connect</button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* AI Status */}
          <div className="card p-6 bg-gradient-to-br from-surface to-white border border-accent-purple/20 flex-1">
            <div className="w-12 h-12 rounded-xl bg-accent-purple/10 text-accent-purple flex items-center justify-center mb-4">
              <Bot size={24} />
            </div>
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-lg font-bold text-text-primary">AI Status</h2>
              <div className={`w-2.5 h-2.5 rounded-full shadow-sm ${dashboardData?.ai_agent_status === 'online' ? 'bg-success' : 'bg-gray-400'}`}></div>
            </div>
            <p className="text-text-secondary text-sm font-medium leading-relaxed">
              {dashboardData?.ai_agent_status === 'online' 
                ? "AI Agent is actively monitoring, creating content and managing your social media."
                : "AI Agent is currently paused."}
            </p>
          </div>
        </div>
      </div>

      {/* 4. Promotional Banner */}
      <div className="card p-8 sm:p-10 bg-gradient-to-r from-primary-navy to-accent-purple border-none flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl shadow-accent-purple/20 mt-2">
        <div className="text-center sm:text-left">
          <h2 className="text-2xl font-bold text-white mb-2">Let AI Handle Your Social Media</h2>
          <p className="text-white/80 font-medium text-sm sm:text-base">
            Generate full campaigns, analyze sentiments, and publish on autopilot.
          </p>
        </div>
        <Link 
          href="/posts" 
          className="shrink-0 flex items-center gap-2 px-6 py-3.5 bg-white text-primary-navy font-bold rounded-xl hover:bg-surface transition-colors shadow-sm"
        >
          View Content <ArrowRight size={18} />
        </Link>
      </div>
    </div>
  );
}

function StatCard({ title, value, change, icon: Icon, color, previewLabel, customSubtitle }) {
  // Map our generic color string to tailwind class names
  const colorMap = {
    "accent-purple": { bg: "bg-accent-purple/10", text: "text-accent-purple", stroke: "#6C4CF6" },
    "danger": { bg: "bg-danger/10", text: "text-danger", stroke: "#EF4444" },
    "warning": { bg: "bg-warning/10", text: "text-warning", stroke: "#F59E0B" },
    "accent-blue": { bg: "bg-accent-blue/10", text: "text-accent-blue", stroke: "#3B82F6" },
    "success": { bg: "bg-success/10", text: "text-success", stroke: "#10B981" },
  };

  const theme = colorMap[color] || colorMap["accent-purple"];

  return (
    <div className="card p-5 flex flex-col relative overflow-hidden group">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 ${theme.bg} ${theme.text}`}>
          <Icon size={20} />
        </div>
        <span className="font-semibold text-text-secondary text-sm">{title}</span>
      </div>
      
      {previewLabel && (
        <div className="mb-2 -mt-1 text-[11px] text-text-secondary/80 italic font-medium">
          {previewLabel}
        </div>
      )}
      
      <div className="flex items-end justify-between mt-auto">
        <div>
          <h3 className="text-3xl font-extrabold text-text-primary tracking-tight">{value}</h3>
          {customSubtitle ? (
            <div className="flex items-center gap-1 mt-1 text-sm font-bold text-text-secondary">
              <span>{customSubtitle}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 mt-1 text-sm font-bold text-success">
              <span>{change}</span>
              <span className="text-text-secondary text-xs font-semibold ml-1">vs last 7 days</span>
            </div>
          )}
        </div>
        
        {/* Tiny Sparkline */}
        <div className="w-24 h-12 opacity-80 group-hover:opacity-100 transition-opacity">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparklineData}>
              <defs>
                <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={theme.stroke} stopOpacity={0.2}/>
                  <stop offset="95%" stopColor={theme.stroke} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke={theme.stroke} 
                strokeWidth={2.5} 
                fillOpacity={1} 
                fill={`url(#gradient-${color})`} 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
