import React, { useState, useEffect } from 'react';
import { ChevronDown, AlertTriangle, Send, Sparkles, MessageSquare, Clock, CheckCircle2, UserCheck, ShieldAlert, SlidersHorizontal } from 'lucide-react';
import { getConversations, getConversationMessages, sendReply, getCommunitySettings, updateCommunitySettings } from '../utils/api';


const FacebookIcon = ({ size = 16, className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
  </svg>
);

const InstagramIcon = ({ size = 16, className = "" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
  </svg>
);

export default function Community() {
  const [activeTab, setActiveTab] = useState("Comments");
  const [conversations, setConversations] = useState([]);
  const [selectedConvoId, setSelectedConvoId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  // Auto-Reply Settings state
  const [settings, setSettings] = useState({ comments_auto_reply: true, dm_auto_reply: true });
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [updatingKey, setUpdatingKey] = useState(null);
  const [settingsError, setSettingsError] = useState("");

  // Load settings when Community page mounts
  useEffect(() => {
    const fetchSettings = async () => {
      setLoadingSettings(true);
      try {
        const data = await getCommunitySettings();
        setSettings({
          comments_auto_reply: Boolean(data.comments_auto_reply),
          dm_auto_reply: Boolean(data.dm_auto_reply),
        });
      } catch (err) {
        console.error("Failed to load community settings:", err);
      } finally {
        setLoadingSettings(false);
      }
    };
    fetchSettings();
  }, []);

  const handleToggleSetting = async (key) => {
    const currentVal = settings[key];
    const newVal = !currentVal;
    const updatedSettings = { ...settings, [key]: newVal };

    // Optimistically update UI
    setSettings(updatedSettings);
    setUpdatingKey(key);
    setSettingsError("");

    try {
      await updateCommunitySettings(updatedSettings);
    } catch (err) {
      console.error("Setting update failed:", err);
      // Revert state on error
      setSettings(prev => ({ ...prev, [key]: currentVal }));
      setSettingsError(err.message || "Failed to update auto-reply setting.");
      setTimeout(() => setSettingsError(""), 4000);
    } finally {
      setUpdatingKey(null);
    }
  };

  // Fetch conversations when tab changes & poll every 4s for live inbox updates
  useEffect(() => {
    let isMounted = true;
    const fetchConvos = async (isTabChange = false) => {
      const data = await getConversations(activeTab);
      if (!isMounted) return;
      setConversations(data);
      if (isTabChange) {
        if (data.length > 0) {
          setSelectedConvoId(data[0].id);
        } else {
          setSelectedConvoId(null);
          setMessages([]);
        }
      }
    };

    fetchConvos(true);

    const interval = setInterval(() => {
      fetchConvos(false);
    }, 4000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeTab]);

  // Fetch messages when selected convo changes & poll every 4s for new replies/auto-replies
  useEffect(() => {
    let isMounted = true;
    const fetchMessages = async (isConvoChange = false) => {
      if (selectedConvoId) {
        const data = await getConversationMessages(selectedConvoId);
        if (!isMounted) return;
        setMessages(data);
        
        if (isConvoChange) {
          setReplyText("");
        }
        
        setConversations(prev => prev.map(c => c.id === selectedConvoId ? { ...c, unread: false } : c));
      } else {
        if (!isMounted) return;
        setMessages([]);
      }
    };

    fetchMessages(true);

    const interval = setInterval(() => {
      if (selectedConvoId) {
        fetchMessages(false);
      }
    }, 4000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [selectedConvoId]);

  const selectedConvo = conversations.find(c => c.id === selectedConvoId);
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  const hasAutoReply = messages.some(m => m.sender === 'brand' && m.is_auto_replied);
  const hasBrandReply = messages.some(m => m.sender === 'brand');

  // Show suggested reply card if last message is from user and has an AI suggestion, AND either flagged or not auto-replied yet
  const showSuggestedReply = lastMessage && lastMessage.sender === 'user' && lastMessage.ai_suggested_reply && (!hasBrandReply || selectedConvo?.flagged);

  const handleUseReply = () => {
    if (lastMessage && lastMessage.ai_suggested_reply) {
      setReplyText(lastMessage.ai_suggested_reply);
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedConvoId) return;
    setSending(true);
    try {
      await sendReply(selectedConvoId, replyText);
      setReplyText("");
      
      // Refresh messages
      const updatedMessages = await getConversationMessages(selectedConvoId);
      setMessages(updatedMessages);
      
      // Refresh convos to update status/flagged state
      const updatedConvos = await getConversations(activeTab);
      setConversations(updatedConvos);
    } catch (error) {
      console.error("Failed to send reply:", error);
      alert("Failed to send reply. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return "";
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const PlatformBadge = ({ platform }) => (
    <div className={`flex items-center justify-center p-1.5 rounded-full ${platform === 'instagram' ? 'bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500 text-white shadow-sm' : 'bg-blue-600 text-white shadow-sm'}`}>
      {platform === 'instagram' ? <InstagramIcon size={12} /> : <FacebookIcon size={12} />}
    </div>
  );

  const StatusBadge = ({ status, flagged }) => {
    if (flagged || status === 'NEEDS_REVIEW') {
      return (
        <div className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded bg-danger/10 border border-danger/20 text-danger text-[11px] font-extrabold uppercase tracking-wider">
          <AlertTriangle size={11} strokeWidth={2.5} />
          NEEDS REVIEW
        </div>
      );
    }
    if (status === 'AI_AUTO_REPLIED') {
      return (
        <div className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-extrabold uppercase tracking-wider">
          <Sparkles size={11} className="text-emerald-600" />
          AI AUTO-REPLIED ✓
        </div>
      );
    }
    if (status === 'MANUAL_REPLIED') {
      return (
        <div className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-extrabold uppercase tracking-wider">
          <UserCheck size={11} />
          MANUAL REPLIED
        </div>
      );
    }
    return (
      <div className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-extrabold uppercase tracking-wider">
        <Clock size={11} />
        PENDING
      </div>
    );
  };

  const totalConvos = conversations.length;
  const needsReviewCount = conversations.filter(c => c.flagged || c.status === 'NEEDS_REVIEW').length;

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] max-w-[1600px] mx-auto gap-6 pb-6">
      
      {/* ── HEADER ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-extrabold text-text-primary tracking-tight">Community</h1>
          <p className="text-text-secondary mt-1.5 font-medium">Monitor customer conversations, AI auto-replies, and flagged reviews.</p>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-2xl font-bold text-text-primary">{totalConvos}</span>
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Total</span>
          </div>
          <div className="w-px h-8 bg-border"></div>
          <div className="flex flex-col items-end">
            <span className="text-2xl font-bold text-danger">{needsReviewCount}</span>
            <span className="text-xs font-semibold text-danger uppercase tracking-wider">Needs Review</span>
          </div>
        </div>
      </div>

      {/* ── AUTO-REPLY SETTINGS BAR ────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-border p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-purple/10 text-accent-purple flex items-center justify-center shrink-0">
            <SlidersHorizontal size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
              Auto-Reply Settings
              <span className="text-[10px] font-extrabold uppercase bg-accent-purple/10 text-accent-purple px-2 py-0.5 rounded-md">
                Live Configuration
              </span>
            </h3>
            <p className="text-xs text-text-secondary font-medium">Configure whether AI automatically dispatches replies to incoming engagement.</p>
          </div>
        </div>

        {settingsError && (
          <div className="text-xs text-danger font-semibold bg-danger/10 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
            <AlertTriangle size={14} /> {settingsError}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          {/* Comments Auto-Reply Toggle */}
          <div className="flex items-center gap-3 bg-surface/60 border border-border/80 px-4 py-2 rounded-xl">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-text-primary">Comments Auto-Reply</span>
              <span className="text-[11px] font-semibold text-text-secondary">
                {loadingSettings ? "Loading..." : settings.comments_auto_reply ? "ON (Auto-reply enabled)" : "OFF (Manual only)"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleToggleSetting('comments_auto_reply')}
              disabled={loadingSettings || updatingKey === 'comments_auto_reply'}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                settings.comments_auto_reply ? 'bg-accent-purple' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  settings.comments_auto_reply ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Direct Messages Auto-Reply Toggle */}
          <div className="flex items-center gap-3 bg-surface/60 border border-border/80 px-4 py-2 rounded-xl">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-text-primary">DMs Auto-Reply</span>
              <span className="text-[11px] font-semibold text-text-secondary">
                {loadingSettings ? "Loading..." : settings.dm_auto_reply ? "ON (Auto-reply enabled)" : "OFF (Manual only)"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleToggleSetting('dm_auto_reply')}
              disabled={loadingSettings || updatingKey === 'dm_auto_reply'}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                settings.dm_auto_reply ? 'bg-accent-purple' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  settings.dm_auto_reply ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0 flex-1">
        
        {/* ── LEFT COLUMN (INBOX) ─────────────────────────────────────────────── */}
        <div className="lg:col-span-4 flex flex-col h-full bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          
          {/* Top Controls */}
          <div className="p-4 border-b border-border bg-surface/50 flex flex-col gap-4 shrink-0">
            <button className="flex items-center justify-between w-full px-4 py-2.5 border border-border rounded-xl bg-white text-sm font-bold text-text-primary hover:border-accent-purple/50 transition-colors shadow-sm">
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-accent-purple"></div>
                All Platforms
              </span>
              <ChevronDown size={16} className="text-text-secondary" />
            </button>

            {/* Segmented Tabs */}
            <div className="flex p-1 bg-border/40 rounded-xl">
              {["Comments", "Direct Messages", "Flagged"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    activeTab === tab
                      ? "bg-white text-text-primary shadow-sm"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    {tab}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 custom-scrollbar">
            {conversations.map((convo) => (
              <div 
                key={convo.id}
                onClick={() => setSelectedConvoId(convo.id)}
                className={`relative p-4 rounded-2xl cursor-pointer transition-all border ${
                  selectedConvoId === convo.id 
                    ? 'border-accent-purple bg-accent-purple/5 shadow-sm' 
                    : 'border-transparent hover:border-border hover:bg-surface'
                }`}
              >
                {/* Needs Review Indicator Line */}
                {(convo.flagged || convo.status === 'NEEDS_REVIEW') && (
                  <div className="absolute left-0 top-4 bottom-4 w-1 rounded-r-md bg-danger" />
                )}

                <div className="flex gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-surface border border-border text-text-primary flex items-center justify-center font-bold text-sm shrink-0">
                      {getInitials(convo.user)}
                    </div>
                    <div className="absolute -bottom-1 -right-1 border-2 border-white rounded-full">
                      <PlatformBadge platform={convo.platform} />
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                      <span className={`font-bold text-sm truncate pr-2 ${convo.unread ? 'text-text-primary' : 'text-text-secondary'}`}>{convo.user}</span>
                      <span className="text-[11px] font-semibold text-text-secondary whitespace-nowrap">{convo.time}</span>
                    </div>
                    <div className="text-xs text-text-secondary font-medium mb-1 truncate">{convo.handle}</div>
                    
                    <p className={`text-sm line-clamp-2 leading-relaxed ${selectedConvoId === convo.id || convo.unread ? 'text-text-primary font-medium' : 'text-text-secondary'}`}>
                      {convo.message}
                    </p>
                    
                    {/* Status Badge */}
                    <StatusBadge status={convo.status} flagged={convo.flagged} />
                  </div>
                </div>
              </div>
            ))}
            {conversations.length === 0 && (
              <div className="p-8 text-center text-text-secondary font-medium text-sm">
                No {activeTab.toLowerCase()} found.
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT COLUMN (DETAIL & COMPOSER) ────────────────────────────────── */}
        <div className="lg:col-span-8 flex flex-col h-full bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          {selectedConvo ? (
            <>
              {/* Header */}
              <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-white shrink-0 z-10">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-surface border border-border text-text-primary flex items-center justify-center font-bold text-lg">
                      {getInitials(selectedConvo.user)}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-extrabold text-text-primary text-lg">{selectedConvo.user}</h2>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-text-secondary mt-0.5">
                      <span>{selectedConvo.handle}</span>
                      <span className="w-1 h-1 rounded-full bg-border"></span>
                      <span className="flex items-center gap-1.5 capitalize text-text-primary">
                        <PlatformBadge platform={selectedConvo.platform} />
                        {selectedConvo.platform} {selectedConvo.type === 'dm' ? 'DM' : 'Comment'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Status Indicator */}
                  {selectedConvo.flagged || selectedConvo.status === 'NEEDS_REVIEW' ? (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-danger/10 border border-danger/30 text-danger text-xs font-extrabold uppercase tracking-wider">
                      <ShieldAlert size={14} />
                      NEEDS HUMAN REVIEW
                    </div>
                  ) : hasAutoReply || selectedConvo.status === 'AI_AUTO_REPLIED' ? (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-extrabold uppercase tracking-wider">
                      <Sparkles size={14} className="text-emerald-600" />
                      AI AUTO-REPLIED ✓
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-extrabold uppercase tracking-wider">
                      <Clock size={14} />
                      PENDING REVIEW
                    </div>
                  )}

                  {selectedConvo.sentiment && selectedConvo.sentiment !== "neutral" && (
                    <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold capitalize ${
                      selectedConvo.sentiment === 'positive' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 
                      selectedConvo.sentiment === 'negative' ? 'bg-danger/5 border-danger/20 text-danger-700' : 
                      'bg-surface border-border text-text-secondary'
                    }`}>
                      <CheckCircle2 size={14} />
                      Sentiment: {selectedConvo.sentiment}
                    </div>
                  )}
                </div>
              </div>

              {/* Chat Thread */}
              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 bg-surface/30 custom-scrollbar">
                
                {/* Flagged Banner */}
                {selectedConvo.flagged && (
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-danger/5 border border-danger/20">
                    <div className="text-danger mt-0.5">
                      <AlertTriangle size={20} strokeWidth={2.5} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-danger-700">NEEDS HUMAN REVIEW</h4>
                      <p className="text-sm text-danger-700/80 mt-0.5 font-medium">This message was flagged as sensitive or low-confidence. AI auto-reply was suppressed. Please review the suggested response below and reply manually.</p>
                    </div>
                  </div>
                )}

                {/* Messages List */}
                {messages.map((msg) => {
                  const isBrand = msg.sender === 'brand';
                  const isAutoReplied = isBrand && msg.is_auto_replied;

                  return (
                    <div key={msg.id} className={`flex flex-col gap-1 max-w-[85%] ${isBrand ? 'self-end items-end' : 'self-start'}`}>
                      
                      {/* AI Auto-Replied Label Header for Brand Auto-Reply */}
                      {isAutoReplied && (
                        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-100/80 border border-emerald-300 text-emerald-800 text-[11px] font-extrabold uppercase tracking-wider mb-0.5">
                          <Sparkles size={11} className="text-emerald-700" />
                          AI AUTO-REPLIED ✓
                        </div>
                      )}

                      <div className={`flex gap-3 ${isBrand ? 'flex-row-reverse' : ''}`}>
                        {!isBrand && (
                          <div className="w-8 h-8 rounded-full bg-surface border border-border text-text-primary flex items-center justify-center font-bold text-xs shrink-0 mt-1">
                            {getInitials(selectedConvo.user)}
                          </div>
                        )}
                        <div className="flex flex-col gap-1.5">
                          <div className={`px-5 py-3.5 rounded-2xl shadow-sm border text-[15px] leading-relaxed ${
                            isBrand 
                              ? isAutoReplied 
                                ? 'bg-gradient-to-r from-emerald-800 to-teal-900 text-white rounded-tr-sm border-emerald-700 shadow-emerald-900/10' 
                                : 'bg-primary-navy text-white rounded-tr-sm border-transparent' 
                              : 'bg-white border-border text-text-primary rounded-tl-sm'
                          }`}>
                            {msg.text}

                            {/* Media preview if customer attached an image */}
                            {msg.media_url && (
                              <div className="mt-2">
                                <img src={msg.media_url} alt="Attachment" className="max-w-xs rounded-xl border border-border/40 shadow-sm" />
                              </div>
                            )}
                          </div>
                          
                          <div className={`flex items-center gap-2 text-[11px] font-semibold text-text-secondary ${isBrand ? 'justify-end mr-1' : 'ml-1'}`}>
                            {isAutoReplied ? (
                              <span className="text-emerald-700 font-bold flex items-center gap-1">
                                <Sparkles size={11} /> Automatically handled by AI
                              </span>
                            ) : isBrand ? (
                              <span className="text-text-secondary">Manual Reply</span>
                            ) : null}
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock size={11} />
                              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {/* AI Suggested Reply Card (For Human Review or Draft) */}
                {showSuggestedReply && (
                  <div className="ml-12 mr-8 mt-2">
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-accent-purple/5 to-accent-blue/5 border border-accent-purple/20 shadow-sm relative overflow-hidden group">
                      <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-accent-purple to-accent-blue opacity-50"></div>
                      
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-accent-purple/10 text-accent-purple flex items-center justify-center">
                            <Sparkles size={14} />
                          </div>
                          <h3 className="text-xs font-extrabold text-accent-purple tracking-wide uppercase">
                            {selectedConvo.flagged ? "AI Suggested Reply (Needs Human Review)" : "AI Suggested Reply"}
                          </h3>
                        </div>
                        <span className="text-[10px] font-bold text-accent-purple/60 uppercase tracking-wider bg-accent-purple/10 px-2 py-0.5 rounded-md">Draft</span>
                      </div>
                      
                      <p className="text-sm text-text-primary leading-relaxed font-medium mb-5">
                        {lastMessage.ai_suggested_reply}
                      </p>
                      
                      <div className="flex flex-wrap gap-2">
                        <button 
                          onClick={handleUseReply}
                          className="flex items-center gap-2 px-4 py-2 bg-accent-purple hover:bg-accent-purple/90 text-white text-sm font-bold rounded-xl shadow-sm shadow-accent-purple/20 transition-all active:scale-95"
                        >
                          <CheckCircle2 size={16} />
                          Use This Reply
                        </button>
                        <button 
                          onClick={() => setReplyText("")}
                          className="flex items-center gap-2 px-4 py-2 bg-white text-text-primary border border-border text-sm font-bold rounded-xl hover:bg-surface transition-all active:scale-95"
                        >
                          Write My Own
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                
              </div>

              {/* Composer */}
              <div className="p-4 border-t border-border bg-white shrink-0 z-10">
                <div className="flex flex-col gap-2">
                  
                  {/* Composer Helper Label */}
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-bold text-text-primary">
                      {hasAutoReply 
                        ? "Manual Reply (Optional)" 
                        : selectedConvo.flagged 
                          ? "Send Manual Reply (Human Review Required)" 
                          : "Send Manual Reply"}
                    </span>
                    <span className="text-[11px] font-medium text-text-secondary">
                      {hasAutoReply 
                        ? "AI has already handled this message. Send a manual reply only if needed." 
                        : selectedConvo.flagged 
                          ? "Review AI suggested reply above or compose custom message." 
                          : "Choose 'Use This Reply' above or compose custom message."}
                    </span>
                  </div>

                  <div className="flex flex-col gap-3 rounded-2xl border-2 border-border focus-within:border-accent-purple/50 focus-within:shadow-[0_0_0_4px_rgba(107,70,193,0.1)] transition-all bg-surface/50 p-2">
                    <textarea 
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder={`Write a reply to ${selectedConvo.handle}...`}
                      className="w-full min-h-[70px] p-2 bg-transparent text-sm text-text-primary placeholder:text-text-secondary focus:outline-none resize-none font-medium"
                    />
                    <div className="flex items-center justify-between px-2 pb-1">
                      <div className="text-xs text-text-secondary font-medium">
                        {hasAutoReply && !replyText.trim() && (
                          <span className="text-emerald-700 font-bold flex items-center gap-1">
                            <CheckCircle2 size={12} /> Auto-reply completed
                          </span>
                        )}
                      </div>
                      <button 
                        onClick={handleSendReply}
                        disabled={!replyText.trim() || sending}
                        className="flex items-center gap-2 px-6 py-2 bg-text-primary text-white text-sm font-bold rounded-xl shadow-sm hover:bg-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {sending ? 'Sending...' : 'Send Reply'} <Send size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center text-text-secondary mb-4">
                <MessageSquare size={24} />
              </div>
              <h3 className="text-lg font-bold text-text-primary mb-1">No Conversation Selected</h3>
              <p className="text-sm font-medium text-text-secondary max-w-[250px]">Choose a message from the inbox to read and respond to it.</p>
            </div>
          )}
        </div>
        
      </div>
      
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #E5E7EB;
          border-radius: 20px;
        }
      `}</style>
    </div>
  );
}
