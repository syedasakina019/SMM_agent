import React, { useState, useEffect, useRef } from 'react';
import {
  analyzeImage, uploadImage, savePost, getAllPosts,
  deletePost, cancelPost, publishNow,
} from '@/utils/api';
import {
  ChevronDown, Upload, Calendar, Check, ImageIcon,
  Clock, Trash2, X, Zap, AlertCircle, RefreshCw,
} from 'lucide-react';

// ─── Platform SVG icons ───────────────────────────────────────────────────────

const FacebookIcon = ({ size = 20, className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
    strokeLinejoin="round" className={className}>
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);

const InstagramIcon = ({ size = 20, className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
    strokeLinejoin="round" className={className}>
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

// ─── Status badge config ──────────────────────────────────────────────────────

const STATUS_CONFIG = {
  draft:      { label: 'Draft',      classes: 'text-gray-500 bg-gray-100' },
  scheduled:  { label: 'Scheduled',  classes: 'text-blue-600 bg-blue-50' },
  publishing: { label: 'Publishing', classes: 'text-amber-600 bg-amber-50' },
  published:  { label: 'Published',  classes: 'text-emerald-600 bg-emerald-50' },
  failed:     { label: 'Failed',     classes: 'text-red-600 bg-red-50' },
  cancelled:  { label: 'Cancelled',  classes: 'text-gray-400 bg-gray-50' },
};

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status?.toLowerCase()] || STATUS_CONFIG.draft;
  return (
    <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider ${cfg.classes}`}>
      {cfg.label}
    </span>
  );
};

// ─── Date formatter ───────────────────────────────────────────────────────────

const formatScheduledTime = (isoString) => {
  if (!isoString) return null;
  const str = isoString.endsWith('Z') || isoString.includes('+') ? isoString : `${isoString}Z`;
  const d = new Date(str);
  return d.toLocaleString('en-US', {
    timeZone: 'Asia/Karachi',
    month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
};

const formatCreatedAt = (isoString) => {
  if (!isoString) return '';
  return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// ─── Confirmation modal ───────────────────────────────────────────────────────

const ConfirmModal = ({ message, onConfirm, onCancel, confirmLabel = 'Confirm', danger = false }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center">
    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
    <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${danger ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
          <AlertCircle size={18} />
        </div>
        <p className="text-sm font-medium text-gray-700 leading-relaxed pt-1">{message}</p>
      </div>
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className={`px-4 py-2 rounded-xl text-sm font-bold text-white transition-colors ${danger ? 'bg-red-500 hover:bg-red-600' : 'bg-amber-500 hover:bg-amber-600'}`}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
);

// ─── Post card component ──────────────────────────────────────────────────────

const PostCard = ({ post, onDelete, onCancel, onPublishNow }) => {
  const status = post.status?.toLowerCase();
  const scheduledStr = formatScheduledTime(post.scheduled_time);
  const createdStr = formatCreatedAt(post.created_at);

  const platforms = (post.platforms || '').split(',').filter(Boolean);

  return (
    <div className="card p-4 flex flex-col gap-3 hover:border-accent-purple/30 transition-all duration-200">
      {/* Top row: image thumb + content */}
      <div className="flex items-start gap-3">
        <div className="w-14 h-14 rounded-xl bg-surface border border-border flex items-center justify-center shrink-0 text-text-secondary overflow-hidden">
          {post.image_path
            ? <img src={`http://127.0.0.1:8000${post.image_path}`} alt="" className="w-full h-full object-cover" />
            : <ImageIcon size={20} />
          }
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text-primary line-clamp-2 leading-snug">
            {post.caption || 'Untitled Post'}
          </p>

          {/* Platforms */}
          <div className="flex items-center gap-1.5 mt-1.5">
            {platforms.map(p => (
              <span key={p} className="flex items-center gap-1 text-text-secondary">
                {p.includes('instagram') ? <InstagramIcon size={13} /> : <FacebookIcon size={13} />}
              </span>
            ))}
            <StatusBadge status={status} />
            <span className="text-xs text-text-secondary ml-auto">{createdStr}</span>
          </div>
        </div>
      </div>

      {/* Scheduled time */}
      {status === 'scheduled' && scheduledStr && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700 font-medium">
          <Clock size={13} className="shrink-0" />
          Scheduled for: {scheduledStr}
        </div>
      )}

      {/* Published time */}
      {status === 'published' && post.published_at && (
        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-700 font-medium">
          <Check size={13} className="shrink-0" />
          Published: {formatScheduledTime(post.published_at)}
        </div>
      )}

      {/* Error message */}
      {status === 'failed' && post.error_message && (
        <div className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-100 rounded-xl text-xs text-red-700 font-medium leading-relaxed">
          <AlertCircle size={13} className="shrink-0 mt-0.5" />
          {post.error_message}
        </div>
      )}

      {/* Cancelled info */}
      {status === 'cancelled' && post.cancelled_at && (
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs text-gray-500 font-medium">
          <X size={13} className="shrink-0" />
          Cancelled: {formatScheduledTime(post.cancelled_at)}
        </div>
      )}

      {/* Action buttons — only show contextually relevant actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-border">
        {/* Publish Now — available for draft, scheduled, failed, cancelled */}
        {['draft', 'scheduled', 'failed', 'cancelled'].includes(status) && (
          <button
            onClick={() => onPublishNow(post.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-purple/10 text-accent-purple hover:bg-accent-purple/20 text-xs font-bold transition-colors"
          >
            <Zap size={12} />
            Publish Now
          </button>
        )}

        {/* Cancel Schedule — only for scheduled */}
        {status === 'scheduled' && (
          <button
            onClick={() => onCancel(post.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 text-xs font-bold transition-colors"
          >
            <X size={12} />
            Cancel Schedule
          </button>
        )}

        {/* Re-try publish for failed */}
        {status === 'failed' && (
          <button
            onClick={() => onPublishNow(post.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-xs font-bold transition-colors"
          >
            <RefreshCw size={12} />
            Retry
          </button>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Delete — not available for 'publishing' status */}
        {status !== 'publishing' && (
          <button
            onClick={() => onDelete(post.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 text-xs font-bold transition-colors"
          >
            <Trash2 size={12} />
            Delete
          </button>
        )}
      </div>
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Posts() {
  // List state
  const [activeTab, setActiveTab] = useState('All Posts');
  const [recentPosts, setRecentPosts] = useState([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);

  // Confirmation modal state
  const [modal, setModal] = useState(null); // { type, postId, message }

  // Create-post state
  const [postType, setPostType] = useState('Single Post');
  const [selectedPlatforms, setSelectedPlatforms] = useState(['Instagram']);
  const [topic, setTopic] = useState('');
  const [caption, setCaption] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleMode, setScheduleMode] = useState('ai');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleError, setScheduleError] = useState('');
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePath, setImagePath] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const fileInputRef = useRef(null);

  // User's local timezone label
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const tzAbbr = new Date().toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop();

  // ── Fetch posts ─────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    setIsLoadingPosts(true);
    try {
      const posts = await getAllPosts();
      setRecentPosts(posts);
    } catch (error) {
      console.error('Failed to fetch posts', error);
    } finally {
      setIsLoadingPosts(false);
    }
  };

  // ── Tab filtering ───────────────────────────────────────────────────────────

  const filteredPosts = recentPosts.filter(p => {
    if (activeTab === 'All Posts') return true;
    if (activeTab === 'Scheduled') return p.status === 'scheduled';
    if (activeTab === 'Published') return p.status === 'published';
    if (activeTab === 'Drafts') return p.status === 'draft';
    return true;
  });

  // ── Image upload ────────────────────────────────────────────────────────────

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      try {
        const result = await uploadImage(file);
        if (result.image_path) {
          setImagePath(result.image_path);
        }
      } catch (error) {
        console.error('Failed to upload image', error);
      }
    }
  };

  // ── Generate caption ────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!imageFile) return;
    setIsGenerating(true);
    try {
      const result = await analyzeImage(imageFile, topic);
      console.log('[DEBUG - posts.jsx] Result received in handleGenerate:', {
        caption: typeof result.caption,
        hashtags: typeof result.hashtags,
        isArray: Array.isArray(result.hashtags)
      });
      const hashtagsText = Array.isArray(result.hashtags) ? result.hashtags.join(' ') : result.hashtags;
      setCaption(`${result.caption}\n\n${hashtagsText}`);
      setImagePath(result.image_path);
    } catch (error) {
      console.error('Failed to generate content', error);
      setCaption(error.message || 'Failed to generate content. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Platform toggle ─────────────────────────────────────────────────────────

  const togglePlatform = (platform) => {
    if (selectedPlatforms.includes(platform)) {
      if (selectedPlatforms.length > 1) {
        setSelectedPlatforms(selectedPlatforms.filter(p => p !== platform));
      }
    } else {
      setSelectedPlatforms([...selectedPlatforms, platform]);
    }
  };

  // ── Schedule date/time validation ───────────────────────────────────────────

  const validateSchedule = () => {
    if (!scheduleDate || !scheduleTime) {
      setScheduleError('Please pick both a date and time.');
      return null;
    }
    // Treat the selected date and time as Pakistan Standard Time (Asia/Karachi, UTC+5)
    const pktIsoString = `${scheduleDate}T${scheduleTime}:00+05:00`;
    const selected = new Date(pktIsoString);
    if (selected <= new Date()) {
      setScheduleError('Scheduled time must be in the future.');
      return null;
    }
    setScheduleError('');
    return pktIsoString;
  };

  // ── Save post ───────────────────────────────────────────────────────────────

  const handleSavePost = async () => {
    if (!caption.trim()) {
      setSaveMessage('Please enter a caption before saving.');
      return;
    }

    let scheduledIso = null;
    let mode = 'immediate';

    if (isScheduled) {
      if (scheduleMode === 'manual') {
        scheduledIso = validateSchedule();
        if (!scheduledIso) return;
        mode = 'manual';
      } else {
        // AI best-time: fetch suggestion from backend, use as scheduled_time
        try {
          const btResp = await fetch(`http://127.0.0.1:8000/api/best-time?timezone=${encodeURIComponent(userTimezone)}`);
          if (!btResp.ok) throw new Error('API error');
          const bt = await btResp.json();
          scheduledIso = bt.suggested_time;
        } catch {
          scheduledIso = new Date(Date.now() + 19 * 3600 * 1000).toISOString();
        }
        mode = 'ai';
      }
    }

    setIsSaving(true);
    setSaveMessage('');
    try {
      const result = await savePost({
        caption,
        hashtags: '',
        image_path: imagePath,
        platforms: selectedPlatforms,
        schedule_mode: mode,
        scheduled_time: scheduledIso,
      });

      if (result.success || result.post_id) {
        const newPost = result.post;
        setSaveMessage(isScheduled ? '✓ Post scheduled successfully!' : '✓ Post saved as draft!');
        // Optimistic: prepend to list
        if (newPost) {
          setRecentPosts(prev => [newPost, ...prev]);
        } else {
          fetchPosts();
        }
        // Reset form
        setCaption('');
        setTopic('');
        setImageFile(null);
        setImagePreview(null);
        setImagePath('');
        setIsScheduled(false);
        setScheduleDate('');
        setScheduleTime('');
        setTimeout(() => setSaveMessage(''), 4000);
      }
    } catch (error) {
      console.error('Failed to save post', error);
      setSaveMessage('Failed to save post. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────

  const handleDeleteRequest = (postId) => {
    setModal({
      type: 'delete',
      postId,
      message: 'Are you sure you want to permanently delete this post? This cannot be undone.',
    });
  };

  const confirmDelete = async () => {
    const postId = modal.postId;
    setModal(null);
    try {
      await deletePost(postId);
      setRecentPosts(prev => prev.filter(p => p.id !== postId));
    } catch (error) {
      alert(error.message || 'Failed to delete post.');
    }
  };

  // ── Cancel schedule ─────────────────────────────────────────────────────────

  const handleCancelRequest = (postId) => {
    setModal({
      type: 'cancel',
      postId,
      message: 'Cancel the scheduled publishing for this post? The post will remain as "Cancelled".',
    });
  };

  const confirmCancel = async () => {
    const postId = modal.postId;
    setModal(null);
    try {
      const result = await cancelPost(postId);
      if (result.post) {
        setRecentPosts(prev => prev.map(p => p.id === postId ? result.post : p));
      }
    } catch (error) {
      alert(error.message || 'Failed to cancel post.');
    }
  };

  // ── Publish now ─────────────────────────────────────────────────────────────

  const handlePublishNow = (postId) => {
    setModal({
      type: 'publish',
      postId,
      message: 'Publish this post to Meta right now? This will attempt an immediate API call.',
    });
  };

  const confirmPublish = async () => {
    const postId = modal.postId;
    setModal(null);
    // Optimistic: set to publishing
    setRecentPosts(prev => prev.map(p => p.id === postId ? { ...p, status: 'publishing' } : p));
    try {
      const result = await publishNow(postId);
      if (result.post) {
        setRecentPosts(prev => prev.map(p => p.id === postId ? result.post : p));
      }
    } catch (error) {
      alert(error.message || 'Failed to publish post.');
      fetchPosts(); // re-sync on error
    }
  };

  // ── Modal router ────────────────────────────────────────────────────────────

  const handleModalConfirm = () => {
    if (!modal) return;
    if (modal.type === 'delete') confirmDelete();
    else if (modal.type === 'cancel') confirmCancel();
    else if (modal.type === 'publish') confirmPublish();
  };

  // ── Min date for date picker (today) ────────────────────────────────────────
  const todayStr = new Date().toISOString().split('T')[0];

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Confirmation modal */}
      {modal && (
        <ConfirmModal
          message={modal.message}
          onConfirm={handleModalConfirm}
          onCancel={() => setModal(null)}
          confirmLabel={modal.type === 'delete' ? 'Delete' : modal.type === 'cancel' ? 'Cancel Schedule' : 'Publish Now'}
          danger={modal.type === 'delete'}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-8">

        {/* ══ LEFT COLUMN: Post list ══════════════════════════════════════════ */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div>
            <h1 className="text-3xl font-bold text-text-primary tracking-tight">Create &amp; Manage Posts</h1>
            <p className="text-text-secondary mt-1.5 font-medium">Plan, create and schedule your social media content.</p>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-6 border-b border-border">
            {['All Posts', 'Scheduled', 'Published', 'Drafts'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 font-semibold text-sm transition-colors border-b-2 ${
                  activeTab === tab
                    ? 'border-accent-purple text-accent-purple'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Filter bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
            <button className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl bg-white text-sm font-semibold text-text-primary hover:bg-surface transition-colors shadow-sm self-start">
              All Platforms <ChevronDown size={16} className="text-text-secondary" />
            </button>
            <button
              onClick={fetchPosts}
              className="flex items-center gap-2 px-3 py-2 border border-border rounded-xl bg-white text-xs font-semibold text-text-secondary hover:bg-surface transition-colors self-start"
            >
              <RefreshCw size={13} /> Refresh
            </button>
          </div>

          {/* Post list */}
          <div className="flex flex-col gap-4 mt-2">
            {isLoadingPosts ? (
              <div className="py-8 text-center text-text-secondary font-medium">Loading posts...</div>
            ) : filteredPosts.length === 0 ? (
              <div className="py-12 px-6 text-center text-text-secondary font-medium bg-white border border-dashed border-border rounded-2xl">
                {activeTab === 'All Posts'
                  ? 'No posts yet. Create your first one using the panel on the right.'
                  : `No ${activeTab.toLowerCase()} posts.`}
              </div>
            ) : (
              filteredPosts.map(post => (
                <PostCard
                  key={post.id}
                  post={post}
                  onDelete={handleDeleteRequest}
                  onCancel={handleCancelRequest}
                  onPublishNow={handlePublishNow}
                />
              ))
            )}
          </div>
        </div>

        {/* ══ RIGHT COLUMN: Create new post ══════════════════════════════════ */}
        <div className="lg:col-span-5 relative">
          <div className="card p-6 flex flex-col gap-6 sticky top-24">
            <h2 className="text-xl font-bold text-text-primary tracking-tight">Create New Post</h2>

            {/* Post type toggle */}
            <div className="flex p-1 bg-surface rounded-xl border border-border">
              {['Single Post', 'Carousel'].map(type => (
                <button
                  key={type}
                  onClick={() => setPostType(type)}
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
                    postType === type ? 'bg-white text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            {/* Platform selection */}
            <div className="flex flex-col gap-3">
              <label className="text-sm font-bold text-text-primary">Select Platforms</label>
              <div className="flex gap-3">
                {[
                  { id: 'Instagram', Icon: InstagramIcon },
                  { id: 'Facebook', Icon: FacebookIcon },
                ].map(({ id, Icon }) => (
                  <button
                    key={id}
                    onClick={() => togglePlatform(id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border font-semibold text-sm transition-colors ${
                      selectedPlatforms.includes(id)
                        ? 'bg-accent-purple/10 border-accent-purple text-accent-purple'
                        : 'bg-white border-border text-text-secondary hover:bg-surface'
                    }`}
                  >
                    <Icon size={18} />
                    {id}
                    {selectedPlatforms.includes(id) && <Check size={16} />}
                  </button>
                ))}
              </div>
            </div>

            {/* Media upload */}
            <div className="flex flex-col gap-3">
              <label className="text-sm font-bold text-text-primary">Media</label>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full relative overflow-hidden min-h-[160px] border-2 border-dashed border-border hover:border-accent-purple/50 bg-surface/50 hover:bg-accent-purple/5 rounded-xl flex flex-col items-center justify-center gap-3 transition-colors group cursor-pointer"
              >
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-full bg-white border border-border flex items-center justify-center text-text-secondary group-hover:text-accent-purple group-hover:border-accent-purple/30 transition-colors">
                      <Upload size={18} />
                    </div>
                    <span className="text-sm font-bold text-text-secondary group-hover:text-accent-purple transition-colors">
                      Upload Image / Video
                    </span>
                  </>
                )}
              </button>
            </div>

            {/* Instructions + Generate button */}
            <div className="flex flex-col gap-3">
              <label className="text-sm font-bold text-text-primary">Add any specific instructions (optional)</label>
              <input
                type="text"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="e.g. mention a sale or event"
                className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent-purple focus:ring-2 focus:ring-accent-purple/20 transition-all text-sm font-medium"
                disabled={isGenerating}
              />
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !imagePreview}
                className="self-start px-5 py-2.5 rounded-xl bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/20 font-bold text-sm transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isGenerating ? 'Analyzing...' : 'Analyze Image & Generate Caption'}
              </button>
            </div>

            {/* Caption textarea */}
            <div className="flex flex-col gap-3">
              <label className="text-sm font-bold text-text-primary">Caption</label>
              <textarea
                value={caption}
                onChange={e => setCaption(e.target.value)}
                placeholder="Write your caption here..."
                className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent-purple focus:ring-2 focus:ring-accent-purple/20 transition-all text-sm font-medium min-h-[120px] resize-none"
              />
            </div>

            {/* Schedule toggle */}
            <div className="flex flex-col gap-4 border-t border-border pt-6 mt-2">
              {/* Toggle header */}
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setIsScheduled(!isScheduled)}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isScheduled ? 'bg-accent-purple/10 text-accent-purple' : 'bg-surface text-text-secondary'}`}>
                    <Calendar size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-text-primary">Schedule Post</h3>
                    <p className="text-xs font-medium text-text-secondary">Publish at a specific time</p>
                  </div>
                </div>
                <div className={`w-11 h-6 rounded-full flex items-center px-1 transition-colors ${isScheduled ? 'bg-accent-purple' : 'bg-border'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${isScheduled ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
              </div>

              {/* Schedule options */}
              {isScheduled && (
                <div className="flex flex-col gap-4">
                  {/* Mode radios */}
                  <div className="flex flex-col gap-3 pl-13">
                    {[
                      { value: 'ai', label: 'Let AI pick the best time' },
                      { value: 'manual', label: 'Choose time manually' },
                    ].map(opt => (
                      <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                        <div className="relative flex items-center justify-center">
                          <input
                            type="radio"
                            name="scheduleMode"
                            value={opt.value}
                            checked={scheduleMode === opt.value}
                            onChange={() => setScheduleMode(opt.value)}
                            className="peer sr-only"
                          />
                          <div className="w-4 h-4 rounded-full border-2 border-border peer-checked:border-accent-purple peer-checked:bg-accent-purple transition-colors" />
                          <div className="absolute w-1.5 h-1.5 rounded-full bg-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                        </div>
                        <span className={`text-sm font-semibold ${scheduleMode === opt.value ? 'text-text-primary' : 'text-text-secondary'}`}>
                          {opt.label}
                        </span>
                      </label>
                    ))}
                  </div>

                  {/* Mode-specific content */}
                  <div className="pl-13">
                    {scheduleMode === 'ai' ? (
                      <div className="p-3 bg-surface border border-border rounded-xl flex items-start gap-3">
                        <div className="text-accent-blue mt-0.5 shrink-0"><Clock size={16} /></div>
                        <p className="text-xs font-medium text-text-secondary leading-relaxed">
                          AI will analyze when your audience is most active and schedule automatically. The backend will publish even if your browser is closed.
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {/* Timezone note */}
                        <p className="text-xs text-text-secondary font-medium flex items-center gap-1.5">
                          <Clock size={12} />
                          Your timezone: <strong>{tzAbbr}</strong> ({userTimezone})
                        </p>

                        <div className="flex gap-3">
                          <input
                            type="date"
                            min={todayStr}
                            value={scheduleDate}
                            onChange={e => { setScheduleDate(e.target.value); setScheduleError(''); }}
                            className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-surface text-text-primary text-sm font-medium focus:outline-none focus:border-accent-purple focus:ring-2 focus:ring-accent-purple/20"
                          />
                          <input
                            type="time"
                            value={scheduleTime}
                            onChange={e => { setScheduleTime(e.target.value); setScheduleError(''); }}
                            className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-surface text-text-primary text-sm font-medium focus:outline-none focus:border-accent-purple focus:ring-2 focus:ring-accent-purple/20"
                          />
                        </div>

                        {scheduleError && (
                          <p className="text-xs text-red-500 font-medium flex items-center gap-1.5">
                            <AlertCircle size={12} /> {scheduleError}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Save message */}
            {saveMessage && (
              <p className={`text-sm font-semibold text-center ${saveMessage.startsWith('✓') ? 'text-emerald-600' : 'text-red-500'}`}>
                {saveMessage}
              </p>
            )}

            {/* Save button */}
            <button
              onClick={handleSavePost}
              disabled={isSaving}
              className="w-full py-3.5 mt-2 rounded-xl bg-accent-purple hover:bg-accent-purple/90 text-white font-bold transition-colors shadow-sm shadow-accent-purple/20 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : isScheduled ? 'Schedule Post' : 'Save Post'}
            </button>
          </div>
        </div>

      </div>
    </>
  );
}
