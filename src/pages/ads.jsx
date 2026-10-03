import React, { useState, useEffect } from 'react';
import { 
  Megaphone, Plus, Target, DollarSign, TrendingUp, Layers, 
  Play, Pause, Trash2, Edit3, Eye, UploadCloud, Sparkles, 
  CheckCircle2, AlertCircle, X, Calendar, MapPin, Users, 
  RefreshCw, Check, AlertTriangle, ArrowRight, Wand2, Copy, Send,
  BarChart2, MousePointer, Activity, ShieldAlert, RotateCcw, Clock, ShieldCheck
} from 'lucide-react';
import { 
  getAds, createAd, updateAd, deleteAd, uploadImage, 
  generateAdCampaign, generateAdCreative, publishAdToMeta, 
  getAdsAnalyticsInsights, getImageUrl, updateAdMetaStatus, 
  syncAdMetaStatus, getAdActivityLogs, retryAdPublish, syncAllAds,
  analyzeAdOptimization, getAdRecommendations, handleRecommendationAction,
  generateAdVariations, getAdVariations, publishVariationToMeta,
  syncVariationsMetaPerformance
} from '../utils/api';

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

export default function AdsManager() {
  const [activeTab, setActiveTab] = useState("All Ads");
  const [ads, setAds] = useState([]);
  const [summary, setSummary] = useState({
    total_campaigns: 0,
    active_campaigns: 0,
    total_spend: 0,
    total_results: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modals & Active Selections
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingAd, setEditingAd] = useState(null);
  const [viewingAd, setViewingAd] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [publishingMetaId, setPublishingMetaId] = useState(null);
  const [metaNotice, setMetaNotice] = useState(null);

  // Phase 6 & 7 Automation, Management & Audit Log State
  const [syncingMetaId, setSyncingMetaId] = useState(null);
  const [metaActionKey, setMetaActionKey] = useState(null); // e.g. "campaign-12-pause"
  const [activityLogs, setActivityLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [retryingId, setRetryingId] = useState(null);
  const [syncingAll, setSyncingAll] = useState(false);

  const handlePublishToMeta = async (adId) => {
    setPublishingMetaId(adId);
    setMetaNotice(null);
    try {
      const res = await publishAdToMeta(adId);
      if (res && res.success) {
        setMetaNotice({
          type: 'success',
          message: `Successfully published campaign to Meta Ads Manager (PAUSED)! Campaign ID: ${res.meta_campaign_id || 'Created'}`
        });
      } else {
        setMetaNotice({
          type: 'error',
          message: res.error || 'Failed to publish to Meta Ads Manager.'
        });
      }
      await loadAdsData();
      if (viewingAd && viewingAd.id === adId && res?.ad) {
        setViewingAd(res.ad);
        loadLogsForAd(adId);
      }
    } catch (err) {
      console.error("Publish to Meta error:", err);
      setMetaNotice({
        type: 'error',
        message: err.message || "Failed to publish campaign to Meta Ads Manager."
      });
    } finally {
      setPublishingMetaId(null);
    }
  };

  const handleRetryPublish = async (adId) => {
    setRetryingId(adId);
    setMetaNotice(null);
    try {
      const res = await retryAdPublish(adId);
      if (res && res.success) {
        setMetaNotice({
          type: 'success',
          message: res.message || 'Successfully retried & published campaign to Meta Ads Manager (PAUSED)!'
        });
      } else {
        setMetaNotice({
          type: 'error',
          message: res.error || 'Retry publishing failed.'
        });
      }
      await loadAdsData();
      if (viewingAd && viewingAd.id === adId && res?.ad) {
        setViewingAd(res.ad);
        loadLogsForAd(adId);
      }
    } catch (err) {
      console.error("Retry publish error:", err);
      setMetaNotice({
        type: 'error',
        message: err.message || "Failed to retry publishing campaign to Meta."
      });
    } finally {
      setRetryingId(null);
    }
  };

  const handleSyncMetaStatus = async (adId) => {
    setSyncingMetaId(adId);
    setMetaNotice(null);
    try {
      const res = await syncAdMetaStatus(adId);
      if (res && res.success) {
        setMetaNotice({
          type: 'success',
          message: `Synced with Meta successfully! Campaign status: ${res.campaign_status}`
        });
      } else {
        setMetaNotice({
          type: 'error',
          message: res.message || 'Failed to sync with Meta.'
        });
      }
      await loadAdsData();
      if (viewingAd && viewingAd.id === adId && res.ad) {
        setViewingAd(res.ad);
        loadLogsForAd(adId);
      }
    } catch (err) {
      console.error("Sync error:", err);
      setMetaNotice({
        type: 'error',
        message: err.message || "Failed to sync Meta status."
      });
    } finally {
      setSyncingMetaId(null);
    }
  };

  const handleSyncAllAds = async () => {
    setSyncingAll(true);
    setMetaNotice(null);
    try {
      const res = await syncAllAds();
      if (res && res.success) {
        const count = res.res?.synced_count || 0;
        setMetaNotice({
          type: 'success',
          message: `Auto-Sync Executed! Synchronized ${count} published campaign(s) with Meta.`
        });
      } else {
        setMetaNotice({
          type: 'error',
          message: 'Failed to complete auto-sync.'
        });
      }
      await loadAdsData();
      if (viewingAd && viewingAd.id) {
        loadLogsForAd(viewingAd.id);
      }
    } catch (err) {
      console.error("Sync all error:", err);
      setMetaNotice({
        type: 'error',
        message: err.message || "Failed to sync all ads."
      });
    } finally {
      setSyncingAll(false);
    }
  };

  const handleUpdateMetaStatus = async (adId, action, target = 'campaign') => {
    const actionKey = `${adId}-${target}-${action}`;
    setMetaActionKey(actionKey);
    setMetaNotice(null);
    try {
      const res = await updateAdMetaStatus(adId, { action, target });
      if (res && res.success) {
        setMetaNotice({
          type: 'success',
          message: `Meta ${target.toUpperCase()} ${action}d successfully! Meta Status: ${res.meta_status}`
        });
      } else {
        setMetaNotice({
          type: 'error',
          message: res.message || `Failed to ${action} Meta ${target}.`
        });
      }
      await loadAdsData();
      if (viewingAd && viewingAd.id === adId && res.ad) {
        setViewingAd(res.ad);
        loadLogsForAd(adId);
      }
    } catch (err) {
      console.error("Meta status update error:", err);
      setMetaNotice({
        type: 'error',
        message: err.message || `Failed to ${action} Meta ${target}.`
      });
    } finally {
      setMetaActionKey(null);
    }
  };

  const loadLogsForAd = async (adId) => {
    setLoadingLogs(true);
    try {
      const res = await getAdActivityLogs(adId);
      if (res && res.logs) {
        setActivityLogs(res.logs);
      } else {
        setActivityLogs([]);
      }
    } catch (err) {
      console.error("Failed to load activity logs:", err);
      setActivityLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (viewingAd && viewingAd.id) {
      loadLogsForAd(viewingAd.id);
    } else {
      setActivityLogs([]);
    }
  }, [viewingAd?.id]);



  // Analytics State (Phase 5)
  const [showAnalyticsView, setShowAnalyticsView] = useState(false);
  const [analyticsPreset, setAnalyticsPreset] = useState("last_7d");
  const [analyticsSince, setAnalyticsSince] = useState("");
  const [analyticsUntil, setAnalyticsUntil] = useState("");
  const [analyticsAdId, setAnalyticsAdId] = useState("");
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsRes, setAnalyticsRes] = useState(null);

  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const data = await getAdsAnalyticsInsights({
        datePreset: analyticsPreset,
        since: analyticsSince,
        until: analyticsUntil,
        adId: analyticsAdId || null,
      });
      setAnalyticsRes(data);
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
      setAnalyticsRes({
        success: false,
        has_data: false,
        metrics: { impressions: 0, reach: 0, clicks: 0, spend: 0, ctr: 0, cpc: 0, cpm: 0, results: 0 },
        message: err.message || "Failed to load Meta performance analytics."
      });
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    if (showAnalyticsView) {
      fetchAnalytics();
    }
  }, [showAnalyticsView, analyticsPreset, analyticsSince, analyticsUntil, analyticsAdId]);

  // Phase 8 AI Optimization State
  const [showOptimizationView, setShowOptimizationView] = useState(false);
  const [optimizationAdId, setOptimizationAdId] = useState("");
  const [optimizationLoading, setOptimizationLoading] = useState(false);
  const [optimizationData, setOptimizationData] = useState(null);
  const [optimizationError, setOptimizationError] = useState("");
  const [variationsLoading, setVariationsLoading] = useState(false);
  const [variationPromptHint, setVariationPromptHint] = useState("");
  const [publishingVarId, setPublishingVarId] = useState(null);
  const [syncingVars, setSyncingVars] = useState(false);
  
  // Explicit User Approval Flow State
  const [approvalModalRec, setApprovalModalRec] = useState(null);
  const [applyingRec, setApplyingRec] = useState(false);

  const fetchOptimizationData = async (targetAdId) => {
    const idToAnalyze = targetAdId || optimizationAdId || (ads.length > 0 ? ads[0].id : null);
    if (!idToAnalyze) {
      setOptimizationError("Please select a campaign to analyze.");
      return;
    }
    
    setOptimizationLoading(true);
    setOptimizationError("");
    try {
      const res = await analyzeAdOptimization(idToAnalyze);
      if (res && res.success) {
        setOptimizationData(res);
      } else {
        setOptimizationError(res.message || "Failed to analyze ad performance.");
      }
    } catch (err) {
      console.error("Optimization analysis error:", err);
      setOptimizationError(err.message || "Failed to generate AI performance optimization.");
    } finally {
      setOptimizationLoading(false);
    }
  };


  const handleGenerateVariationsClick = async () => {
    const targetAdId = optimizationAdId || (optimizationData?.ad?.id) || (ads.length > 0 ? ads[0].id : null);
    if (!targetAdId) return;

    setVariationsLoading(true);
    try {
      await generateAdVariations(targetAdId, variationPromptHint);
      setVariationPromptHint("");
      await fetchOptimizationData(targetAdId);
    } catch (err) {
      console.error("Failed to generate variations:", err);
      alert(err.message || "Failed to generate ad variations.");
    } finally {
      setVariationsLoading(false);
    }
  };

  const handlePublishVariationToMeta = async (variantId) => {
    const targetAdId = optimizationAdId || (optimizationData?.ad?.id) || (ads.length > 0 ? ads[0].id : null);
    if (!targetAdId || !variantId) return;

    setPublishingVarId(variantId);
    setMetaNotice(null);
    try {
      const res = await publishVariationToMeta(targetAdId, variantId);
      if (res && res.success) {
        setMetaNotice({
          type: 'success',
          message: `Successfully published variation to Meta Ads Manager (PAUSED)! Meta Ad ID: ${res.meta_ad_id || 'Created'}`
        });
      } else {
        setMetaNotice({
          type: 'error',
          message: res.error || 'Failed to publish variation to Meta Ads Manager.'
        });
      }
      await fetchOptimizationData(targetAdId);
      await loadAdsData();
    } catch (err) {
      console.error("Publish variation error:", err);
      setMetaNotice({
        type: 'error',
        message: err.message || "Failed to publish variation to Meta Ads."
      });
    } finally {
      setPublishingVarId(null);
    }
  };

  const handleSyncVariationsPerformance = async () => {
    const targetAdId = optimizationAdId || (optimizationData?.ad?.id) || (ads.length > 0 ? ads[0].id : null);
    if (!targetAdId) return;

    setSyncingVars(true);
    setMetaNotice(null);
    try {
      const res = await syncVariationsMetaPerformance(targetAdId);
      if (res && res.success) {
        setMetaNotice({
          type: 'success',
          message: `Synced Meta metrics for variation(s)!`
        });
      } else {
        setMetaNotice({
          type: 'error',
          message: 'Failed to sync variation performance.'
        });
      }
      await fetchOptimizationData(targetAdId);
    } catch (err) {
      console.error("Sync variations error:", err);
      setMetaNotice({
        type: 'error',
        message: err.message || "Failed to sync variation performance."
      });
    } finally {
      setSyncingVars(false);
    }
  };



  const handleExecuteRecAction = async (recId, action) => {
    const targetAdId = optimizationAdId || (optimizationData?.ad?.id) || (ads.length > 0 ? ads[0].id : null);
    if (!targetAdId || !recId) return;

    setApplyingRec(true);
    try {
      const res = await handleRecommendationAction(targetAdId, recId, action);
      if (res && res.success) {
        setMetaNotice({
          type: 'success',
          message: res.message || `Recommendation ${action}ed successfully!`
        });
      } else {
        setMetaNotice({
          type: 'error',
          message: res.message || `Failed to ${action} recommendation.`
        });
      }
      setApprovalModalRec(null);
      await fetchOptimizationData(targetAdId);
      await loadAdsData();
    } catch (err) {
      console.error("Recommendation action error:", err);
      alert(err.message || "Failed to process recommendation action.");
    } finally {
      setApplyingRec(false);
    }
  };

  useEffect(() => {
    if (showOptimizationView) {
      if (!optimizationAdId && ads.length > 0) {
        setOptimizationAdId(ads[0].id);
        fetchOptimizationData(ads[0].id);
      } else if (optimizationAdId) {
        fetchOptimizationData(optimizationAdId);
      }
    }
  }, [showOptimizationView, optimizationAdId]);

  // Form State
  const initialFormState = {
    name: "",
    objective: "Awareness",
    platform: "instagram,facebook",
    status: "draft",
    primary_text: "",
    headline: "",
    cta: "Learn More",
    media_path: "",
    audience_location: "United States",
    audience_age_min: 18,
    audience_age_max: 65,
    audience_gender: "all",
    audience_interests: "",
    daily_budget: 10,
    total_budget: 100,
    start_date: "",
    end_date: "",
    ai_optimized: true,
  };

  const [formData, setFormData] = useState(initialFormState);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // AI Campaign Assistant State (Phase 2)
  const [showAiGenerator, setShowAiGenerator] = useState(false);
  const [aiInputs, setAiInputs] = useState({
    product_service: "",
    objective: "Awareness",
    platform: "instagram,facebook",
    target_audience: "",
    campaign_description: "",
    daily_budget: "",
    duration_days: "",
  });
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiError, setAiError] = useState("");

  // AI Creative Generator State (Phase 3)
  const [creativeGenerating, setCreativeGenerating] = useState(false);
  const [creativeResult, setCreativeResult] = useState(null);
  const [creativeError, setCreativeError] = useState("");
  const [creativePromptInput, setCreativePromptInput] = useState("");
  const [showCreativeSection, setShowCreativeSection] = useState(false);

  // Fetch Ads Data
  const loadAdsData = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getAds(activeTab);
      if (data) {
        setSummary(data.summary || { total_campaigns: 0, active_campaigns: 0, total_spend: 0, total_results: 0 });
        setAds(data.ads || []);
      }
    } catch (err) {
      console.error("Failed to load ads:", err);
      setError("Failed to load campaigns. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdsData();
  }, [activeTab]);

  const handleOpenCreateModal = () => {
    setEditingAd(null);
    setFormData(initialFormState);
    setShowAiGenerator(false);
    setAiResult(null);
    setAiError("");
    setCreativeGenerating(false);
    setCreativeResult(null);
    setCreativeError("");
    setCreativePromptInput("");
    setShowCreativeSection(false);
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (ad) => {
    setEditingAd(ad);
    setFormData({
      name: ad.name || "",
      objective: ad.objective || "Awareness",
      platform: ad.platform || "instagram,facebook",
      status: ad.status || "draft",
      primary_text: ad.primary_text || "",
      headline: ad.headline || "",
      cta: ad.cta || "Learn More",
      media_path: ad.media_path || "",
      audience_location: ad.audience_location || "United States",
      audience_age_min: ad.audience_age_min || 18,
      audience_age_max: ad.audience_age_max || 65,
      audience_gender: ad.audience_gender || "all",
      audience_interests: ad.audience_interests || "",
      daily_budget: ad.daily_budget || 10,
      total_budget: ad.total_budget || 100,
      start_date: ad.start_date ? ad.start_date.substring(0, 16) : "",
      end_date: ad.end_date ? ad.end_date.substring(0, 16) : "",
      ai_optimized: Boolean(ad.ai_optimized),
    });
    setShowAiGenerator(false);
    setAiResult(null);
    setCreativeGenerating(false);
    setCreativeResult(null);
    setCreativeError("");
    setCreativePromptInput("");
    setShowCreativeSection(false);
    setIsCreateModalOpen(true);
  };

  const handleGenerateCreative = async () => {
    setCreativeGenerating(true);
    setCreativeError("");

    try {
      const payload = {
        product_service: aiInputs.product_service || formData.name || "",
        objective: formData.objective || "Awareness",
        target_audience: aiInputs.target_audience || formData.audience_interests || "",
        headline: formData.headline || "",
        primary_text: formData.primary_text || "",
        cta: formData.cta || "Learn More",
        prompt_description: creativePromptInput.trim(),
      };

      const res = await generateAdCreative(payload);
      if (res && res.media_path) {
        setCreativeResult(res);
      } else {
        throw new Error("No media asset returned from visual creative generator.");
      }
    } catch (err) {
      console.error("Creative generation error:", err);
      setCreativeError(err.message || "Failed to generate visual ad creative.");
    } finally {
      setCreativeGenerating(false);
    }
  };

  const handleSelectCreative = () => {
    if (creativeResult && creativeResult.media_path) {
      setFormData((prev) => ({ ...prev, media_path: creativeResult.media_path }));
      setCreativeResult(null);
      setCreativeError("");
    }
  };


  const handleMediaUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingMedia(true);
    try {
      const res = await uploadImage(file);
      if (res && res.image_path) {
        setFormData((prev) => ({ ...prev, media_path: res.image_path }));
      }
    } catch (err) {
      console.error("Media upload failed:", err);
      alert("Failed to upload image asset.");
    } finally {
      setUploadingMedia(false);
    }
  };

  // AI Campaign Generation
  const handleGenerateAiCampaign = async () => {
    setAiGenerating(true);
    setAiError("");
    setAiResult(null);

    try {
      const payload = {
        product_service: aiInputs.product_service.trim(),
        objective: aiInputs.objective || formData.objective || "Awareness",
        platform: aiInputs.platform || formData.platform || "instagram,facebook",
        target_audience: aiInputs.target_audience.trim(),
        campaign_description: aiInputs.campaign_description.trim(),
        daily_budget: aiInputs.daily_budget ? parseFloat(aiInputs.daily_budget) : null,
        duration_days: aiInputs.duration_days ? parseInt(aiInputs.duration_days) : null,
      };

      const res = await generateAdCampaign(payload);
      if (res && res.campaign) {
        setAiResult(res.campaign);
      } else {
        throw new Error("No campaign structure returned from AI.");
      }
    } catch (err) {
      console.error("AI Generation error:", err);
      setAiError(err.message || "AI campaign generation failed. Please check parameters and try again.");
    } finally {
      setAiGenerating(false);
    }
  };

  const handleUseAiCampaign = (selectedVariation = null) => {
    if (!aiResult) return;

    const chosenText = selectedVariation ? selectedVariation.primary_text : aiResult.primary_text;
    const chosenHeadline = selectedVariation ? selectedVariation.headline : aiResult.headline;
    const chosenCta = selectedVariation ? selectedVariation.cta : aiResult.cta;

    const interestsStr = Array.isArray(aiResult.audience?.interests) 
      ? aiResult.audience.interests.join(", ") 
      : (aiResult.audience?.interests || "");

    const dailyBudgetVal = aiResult.budget?.daily || formData.daily_budget || 15;
    const durationVal = aiResult.budget?.recommended_duration_days || 7;
    const totalBudgetVal = dailyBudgetVal * durationVal;

    setFormData((prev) => ({
      ...prev,
      name: aiResult.campaign_name || prev.name,
      objective: aiInputs.objective || prev.objective,
      platform: aiInputs.platform || prev.platform,
      primary_text: chosenText || prev.primary_text,
      headline: chosenHeadline || prev.headline,
      cta: chosenCta || prev.cta,
      audience_location: aiResult.audience?.location || prev.audience_location,
      audience_age_min: aiResult.audience?.age_min || prev.audience_age_min,
      audience_age_max: aiResult.audience?.age_max || prev.audience_age_max,
      audience_gender: aiResult.audience?.gender || prev.audience_gender,
      audience_interests: interestsStr || prev.audience_interests,
      daily_budget: dailyBudgetVal,
      total_budget: totalBudgetVal,
      ai_optimized: true,
    }));

    // Switch view back to main edit form with pre-populated values
    setShowAiGenerator(false);
  };

  const handleSubmitAd = async (targetStatus) => {
    if (!formData.name.trim()) {
      alert("Please enter a campaign name.");
      return;
    }

    setSubmitting(true);
    const payload = {
      ...formData,
      status: targetStatus || formData.status,
      daily_budget: parseFloat(formData.daily_budget) || 0,
      total_budget: parseFloat(formData.total_budget) || 0,
      audience_age_min: parseInt(formData.audience_age_min) || 18,
      audience_age_max: parseInt(formData.audience_age_max) || 65,
    };

    try {
      if (editingAd) {
        await updateAd(editingAd.id, payload);
      } else {
        await createAd(payload);
      }
      setIsCreateModalOpen(false);
      setFormData(initialFormState);
      setEditingAd(null);
      await loadAdsData();
    } catch (err) {
      console.error("Ad save error:", err);
      alert(err.message || "Failed to save ad campaign.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePause = async (ad) => {
    const newStatus = ad.status === "active" ? "paused" : "active";
    try {
      await updateAd(ad.id, { status: newStatus });
      await loadAdsData();
    } catch (err) {
      console.error("Toggle status error:", err);
      alert("Failed to update status.");
    }
  };

  const handleDeleteAd = async (id) => {
    try {
      await deleteAd(id);
      setDeleteConfirmId(null);
      await loadAdsData();
    } catch (err) {
      console.error("Delete error:", err);
      alert("Failed to delete ad campaign.");
    }
  };

  const StatusBadge = ({ status }) => {
    const s = (status || "draft").toLowerCase();
    const map = {
      active: "bg-emerald-50 border-emerald-200 text-emerald-700",
      scheduled: "bg-blue-50 border-blue-200 text-blue-700",
      draft: "bg-surface border-border text-text-secondary",
      paused: "bg-amber-50 border-amber-200 text-amber-700",
      completed: "bg-purple-50 border-purple-200 text-purple-700",
      failed: "bg-danger/10 border-danger/20 text-danger",
    };

    const style = map[s] || map.draft;

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-extrabold uppercase tracking-wider ${style}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${s === 'active' ? 'bg-emerald-500 animate-pulse' : s === 'scheduled' ? 'bg-blue-500' : s === 'paused' ? 'bg-amber-500' : s === 'completed' ? 'bg-purple-500' : s === 'failed' ? 'bg-danger' : 'bg-gray-400'}`}></span>
        {status}
      </span>
    );
  };

  const PlatformBadges = ({ platform }) => {
    const p = (platform || "").toLowerCase();
    const hasIg = p.includes("instagram");
    const hasFb = p.includes("facebook");

    return (
      <div className="flex items-center gap-1.5">
        {hasIg && (
          <div className="p-1 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500 text-white shadow-sm" title="Instagram">
            <InstagramIcon size={12} />
          </div>
        )}
        {hasFb && (
          <div className="p-1 rounded-full bg-blue-600 text-white shadow-sm" title="Facebook">
            <FacebookIcon size={12} />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 max-w-[1600px] mx-auto pb-10">
      
      {/* ── A. HEADER ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-text-primary tracking-tight">Ads Manager</h1>
          <p className="text-text-secondary mt-1.5 font-medium">Create, manage and monitor social media advertising campaigns.</p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-accent-purple hover:bg-accent-purple/90 text-white font-bold rounded-xl shadow-md shadow-accent-purple/20 transition-all active:scale-95 shrink-0"
        >
          <Plus size={18} />
          <span>+ Create Ad</span>
        </button>
      </div>

      {/* Meta Notice Alert */}
      {metaNotice && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 shadow-sm ${
          metaNotice.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-900'
        }`}>
          <div className="flex items-center gap-3">
            {metaNotice.type === 'success' ? (
              <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle size={20} className="text-amber-600 shrink-0" />
            )}
            <span className="text-xs font-bold">{metaNotice.message}</span>
          </div>
          <button onClick={() => setMetaNotice(null)} className="p-1 rounded-lg hover:bg-black/5">
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── B. SUMMARY CARDS ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Total Campaigns */}
        <div className="bg-white rounded-2xl border border-border p-5 shadow-sm flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">Total Campaigns</span>
            <span className="text-3xl font-extrabold text-text-primary">{summary.total_campaigns}</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-accent-purple/10 text-accent-purple flex items-center justify-center">
            <Layers size={22} />
          </div>
        </div>

        {/* Active Campaigns */}
        <div className="bg-white rounded-2xl border border-border p-5 shadow-sm flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">Active Campaigns</span>
            <span className="text-3xl font-extrabold text-emerald-600">{summary.active_campaigns}</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Target size={22} />
          </div>
        </div>

        {/* Total Ad Spend */}
        <div className="bg-white rounded-2xl border border-border p-5 shadow-sm flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">Total Ad Spend</span>
            <span className="text-3xl font-extrabold text-text-primary">${summary.total_spend.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <DollarSign size={22} />
          </div>
        </div>

        {/* Total Results */}
        <div className="bg-white rounded-2xl border border-border p-5 shadow-sm flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">Total Results</span>
            <span className="text-3xl font-extrabold text-text-primary">{summary.total_results.toLocaleString()}</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <TrendingUp size={22} />
          </div>
        </div>
      </div>

      {/* ── C. TABS & CONTROLS ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-4 bg-surface/40">
          
          <div className="flex items-center gap-2 p-1 bg-border/40 rounded-xl overflow-x-auto max-w-full">
            {["All Ads", "Active", "Scheduled", "Drafts", "Completed"].map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setShowAnalyticsView(false);
                  setShowOptimizationView(false);
                  setActiveTab(tab);
                }}
                className={`py-2 px-4 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                  !showAnalyticsView && !showOptimizationView && activeTab === tab
                    ? "bg-white text-text-primary shadow-sm"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {tab}
              </button>
            ))}

            <button
              onClick={() => {
                setShowOptimizationView(false);
                setShowAnalyticsView(!showAnalyticsView);
              }}
              className={`py-2 px-4 text-xs font-bold rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5 ${
                showAnalyticsView
                  ? "bg-accent-purple text-white shadow-sm font-extrabold"
                  : "bg-accent-purple/10 text-accent-purple hover:bg-accent-purple/20"
              }`}
            >
              <BarChart2 size={14} />
              <span>📊 Analytics & Insights</span>
            </button>

            <button
              onClick={() => {
                setShowAnalyticsView(false);
                setShowOptimizationView(!showOptimizationView);
              }}
              className={`py-2 px-4 text-xs font-bold rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5 ${
                showOptimizationView
                  ? "bg-gradient-to-r from-accent-purple to-accent-blue text-white shadow-sm font-extrabold"
                  : "bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/20"
              }`}
            >
              <Sparkles size={14} />
              <span>🤖 AI Optimization</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>⚡ Auto-Sync Active (Every 15m)</span>
            </span>

            <button
              type="button"
              onClick={handleSyncAllAds}
              disabled={syncingAll}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-accent-blue/30 bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/20 transition-all shadow-sm disabled:opacity-50"
              title="Sync all Meta campaigns and refresh performance metrics"
            >
              <RefreshCw size={14} className={syncingAll ? "animate-spin" : ""} />
              <span>{syncingAll ? "Syncing Meta..." : "Sync All Meta Ads"}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (showAnalyticsView) fetchAnalytics();
                else loadAdsData();
              }}
              className="p-2.5 rounded-xl border border-border bg-white text-text-secondary hover:text-text-primary hover:bg-surface transition-colors shadow-sm"
              title="Refresh Local Data"
            >
              <RefreshCw size={16} className={(loading || analyticsLoading) ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* ── ANALYTICS & INSIGHTS VIEW (Phase 5) ────────────────────────── */}
        {showAnalyticsView ? (
          <div className="p-6 flex flex-col gap-6 bg-surface/30 animate-in fade-in duration-200">
            
            {/* Filters Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white rounded-2xl border border-border shadow-sm">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-extrabold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar size={14} className="text-accent-purple" /> Date Range:
                </span>

                <div className="flex p-1 bg-surface rounded-xl border border-border">
                  {[
                    { label: "Today", value: "today" },
                    { label: "Last 7 Days", value: "last_7d" },
                    { label: "Last 30 Days", value: "last_30d" },
                    { label: "Custom", value: "custom" },
                  ].map((p) => (
                    <button
                      key={p.value}
                      onClick={() => setAnalyticsPreset(p.value)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                        analyticsPreset === p.value
                          ? "bg-accent-purple text-white shadow-sm"
                          : "text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {analyticsPreset === "custom" && (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={analyticsSince}
                      onChange={(e) => setAnalyticsSince(e.target.value)}
                      className="px-2.5 py-1.5 text-xs bg-white border border-border rounded-xl font-bold"
                    />
                    <span className="text-xs text-text-secondary">to</span>
                    <input
                      type="date"
                      value={analyticsUntil}
                      onChange={(e) => setAnalyticsUntil(e.target.value)}
                      className="px-2.5 py-1.5 text-xs bg-white border border-border rounded-xl font-bold"
                    />
                  </div>
                )}
              </div>

              {/* Campaign Filter */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-bold text-text-secondary">Campaign:</span>
                <select
                  value={analyticsAdId}
                  onChange={(e) => setAnalyticsAdId(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-border rounded-xl text-xs font-bold text-text-primary focus:outline-none focus:border-accent-purple max-w-[220px] truncate"
                >
                  <option value="">All Account Campaigns</option>
                  {ads.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.meta_campaign_id ? 'Synced' : 'Local'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Analytics Content */}
            {analyticsLoading ? (
              <div className="p-16 text-center text-text-secondary font-medium">
                <RefreshCw size={28} className="animate-spin mx-auto mb-3 text-accent-purple" />
                Fetching live Meta Marketing API performance metrics...
              </div>
            ) : analyticsRes && !analyticsRes.has_data ? (
              /* Explicit Empty State — No fake numbers */
              <div className="p-12 text-center bg-white rounded-2xl border border-border shadow-sm flex flex-col items-center justify-center">
                <div className="w-14 h-14 rounded-2xl bg-accent-purple/10 text-accent-purple flex items-center justify-center mb-3">
                  <BarChart2 size={26} />
                </div>
                <h3 className="text-base font-extrabold text-text-primary mb-1">
                  No performance data yet. Your ad has not started delivering.
                </h3>
                <p className="text-xs text-text-secondary max-w-md font-medium">
                  {analyticsRes.message || "Meta Ads API returns metrics after campaigns receive active impressions and engagement."}
                </p>
              </div>
            ) : analyticsRes && analyticsRes.metrics ? (
              /* Performance Metrics Grid */
              <div className="flex flex-col gap-6">
                
                {analyticsRes.date_start && (
                  <div className="text-xs font-bold text-text-secondary flex items-center gap-2">
                    <span>Period: {analyticsRes.date_start} to {analyticsRes.date_stop}</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-extrabold uppercase text-[10px]">
                      Live Meta Insights
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Impressions */}
                  <div className="bg-white p-5 rounded-2xl border border-border shadow-sm flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1">Impressions</span>
                      <span className="text-2xl font-extrabold text-text-primary">{analyticsRes.metrics.impressions.toLocaleString()}</span>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                      <Eye size={20} />
                    </div>
                  </div>

                  {/* Reach */}
                  <div className="bg-white p-5 rounded-2xl border border-border shadow-sm flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1">Reach</span>
                      <span className="text-2xl font-extrabold text-text-primary">{analyticsRes.metrics.reach.toLocaleString()}</span>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Users size={20} />
                    </div>
                  </div>

                  {/* Clicks */}
                  <div className="bg-white p-5 rounded-2xl border border-border shadow-sm flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1">Clicks</span>
                      <span className="text-2xl font-extrabold text-text-primary">{analyticsRes.metrics.clicks.toLocaleString()}</span>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                      <MousePointer size={20} />
                    </div>
                  </div>

                  {/* Spend */}
                  <div className="bg-white p-5 rounded-2xl border border-border shadow-sm flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1">Spend</span>
                      <span className="text-2xl font-extrabold text-emerald-600">${analyticsRes.metrics.spend.toFixed(2)}</span>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <DollarSign size={20} />
                    </div>
                  </div>

                  {/* CTR */}
                  <div className="bg-white p-5 rounded-2xl border border-border shadow-sm flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1">CTR</span>
                      <span className="text-2xl font-extrabold text-text-primary">{analyticsRes.metrics.ctr.toFixed(2)}%</span>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <TrendingUp size={20} />
                    </div>
                  </div>

                  {/* CPC */}
                  <div className="bg-white p-5 rounded-2xl border border-border shadow-sm flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1">CPC</span>
                      <span className="text-2xl font-extrabold text-text-primary">${analyticsRes.metrics.cpc.toFixed(2)}</span>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center">
                      <Target size={20} />
                    </div>
                  </div>

                  {/* CPM */}
                  <div className="bg-white p-5 rounded-2xl border border-border shadow-sm flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1">CPM</span>
                      <span className="text-2xl font-extrabold text-text-primary">${analyticsRes.metrics.cpm.toFixed(2)}</span>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
                      <Layers size={20} />
                    </div>
                  </div>

                  {/* Results / Conversions */}
                  <div className="bg-white p-5 rounded-2xl border border-border shadow-sm flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1">Conversions</span>
                      <span className="text-2xl font-extrabold text-text-primary">{analyticsRes.metrics.results.toLocaleString()}</span>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <CheckCircle2 size={20} />
                    </div>
                  </div>

                </div>
              </div>
            ) : null}

          </div>
        ) : null}

        {/* ── AI PERFORMANCE OPTIMIZATION VIEW (Phase 8) ──────────────────── */}
        {showOptimizationView ? (
          <div className="p-6 flex flex-col gap-6 bg-surface/30 animate-in fade-in duration-200">
            
            {/* Top Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white rounded-2xl border border-border shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-accent-purple to-accent-blue text-white flex items-center justify-center font-bold shadow-md">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-text-primary">AI Performance Optimizer</h3>
                  <p className="text-xs text-text-secondary font-medium">Real Meta performance evaluation & AI copy variations (No auto-spending or auto-activation).</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={optimizationAdId}
                  onChange={(e) => setOptimizationAdId(e.target.value)}
                  className="px-3.5 py-2 bg-white border border-border rounded-xl text-xs font-bold text-text-primary focus:outline-none focus:border-accent-purple max-w-[240px] truncate shadow-sm"
                >
                  {ads.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.meta_campaign_id ? 'Synced' : 'Local'})
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => fetchOptimizationData(optimizationAdId)}
                  disabled={optimizationLoading}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-accent-purple hover:bg-accent-purple/90 text-white transition-all shadow-sm disabled:opacity-50"
                >
                  <RefreshCw size={14} className={optimizationLoading ? "animate-spin" : ""} />
                  <span>{optimizationLoading ? "Analyzing..." : "Refresh Analysis"}</span>
                </button>
              </div>
            </div>

            {/* Error state */}
            {optimizationError && (
              <div className="p-4 rounded-2xl bg-danger/10 border border-danger/20 text-danger text-xs font-semibold flex items-center gap-2">
                <AlertCircle size={18} /> {optimizationError}
              </div>
            )}

            {/* Smart Alerts Section */}
            {optimizationData?.alerts && optimizationData.alerts.length > 0 && (
              <div className="flex flex-col gap-2">
                <h4 className="text-xs font-extrabold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert size={14} className="text-amber-500" /> Active Smart Alerts ({optimizationData.alerts.length})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {optimizationData.alerts.map((alert, idx) => (
                    <div key={idx} className={`p-4 rounded-2xl border flex items-start gap-3 shadow-sm ${
                      alert.alert_type === 'billing' || alert.alert_type === 'permission' || alert.alert_type === 'expired_token'
                        ? 'bg-danger/5 border-danger/20 text-danger'
                        : alert.alert_type === 'no_delivery'
                        ? 'bg-amber-50 border-amber-200 text-amber-900'
                        : 'bg-blue-50 border-blue-200 text-blue-900'
                    }`}>
                      <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                      <div className="flex flex-col text-xs">
                        <span className="font-extrabold uppercase tracking-wide text-[11px] mb-0.5">{alert.title || alert.alert_type}</span>
                        <span className="font-medium leading-relaxed">{alert.message}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Performance Summary & AI Analysis */}
            {optimizationLoading ? (
              <div className="p-16 text-center text-text-secondary font-medium bg-white rounded-2xl border border-border">
                <RefreshCw size={28} className="animate-spin mx-auto mb-3 text-accent-purple" />
                Analyzing real Meta Insights & evaluating ad delivery...
              </div>
            ) : optimizationData ? (
              <div className="flex flex-col gap-6">

                {/* Insufficient Data Alert if no impressions */}
                {!optimizationData.has_sufficient_data && (
                  <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3 shadow-sm">
                    <AlertCircle size={20} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-extrabold text-sm mb-1">Insufficient Meta Delivery Data</h4>
                      <p className="text-xs font-medium leading-relaxed">
                        This ad campaign has 0 impressions. AI optimization requires real delivery metrics (impressions, clicks, spend) to provide data-backed recommendations. Once Meta delivers this ad, full metric evaluation will appear here automatically.
                      </p>
                    </div>
                  </div>
                )}

                {/* Overall Summary Card */}
                <div className="bg-white p-6 rounded-2xl border border-border shadow-sm flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-extrabold text-text-primary uppercase tracking-wider flex items-center gap-2">
                      <Activity size={16} className="text-accent-purple" /> Overall AI Performance Analysis
                    </h4>
                    <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-surface border border-border text-text-secondary uppercase">
                      Ad: {optimizationData.ad?.name}
                    </span>
                  </div>

                  <p className="text-sm text-text-primary font-medium leading-relaxed bg-surface/50 p-4 rounded-xl border border-border/60">
                    {optimizationData.analysis?.overall_summary || "No analysis available."}
                  </p>

                  {/* 4 Quadrants: Positive, Attention, Reasons, Next Steps */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Positive Observations */}
                    <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200/60 flex flex-col gap-2">
                      <span className="text-xs font-extrabold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                        <CheckCircle2 size={14} className="text-emerald-600" /> Positive Observations
                      </span>
                      <ul className="text-xs text-emerald-900 space-y-1.5 pl-4 list-disc font-medium">
                        {(optimizationData.analysis?.positive_observations || []).map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Areas Needing Attention */}
                    <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200/60 flex flex-col gap-2">
                      <span className="text-xs font-extrabold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                        <AlertTriangle size={14} className="text-amber-600" /> Areas Needing Attention
                      </span>
                      <ul className="text-xs text-amber-900 space-y-1.5 pl-4 list-disc font-medium">
                        {(optimizationData.analysis?.areas_needing_attention || []).map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Possible Reasons (Marked as AI Suggestions) */}
                    <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-200/60 flex flex-col gap-2">
                      <span className="text-xs font-extrabold text-purple-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles size={14} className="text-purple-600" /> Possible Reasons (AI Suggestions)
                      </span>
                      <ul className="text-xs text-purple-900 space-y-1.5 pl-4 list-disc font-medium">
                        {(optimizationData.analysis?.possible_reasons || []).map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Recommended Next Steps */}
                    <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-200/60 flex flex-col gap-2">
                      <span className="text-xs font-extrabold text-blue-800 uppercase tracking-wider flex items-center gap-1.5">
                        <ArrowRight size={14} className="text-blue-600" /> Recommended Next Steps
                      </span>
                      <ul className="text-xs text-blue-900 space-y-1.5 pl-4 list-disc font-medium">
                        {(optimizationData.analysis?.recommended_next_steps || []).map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* AI Recommendations List */}
                <div className="flex flex-col gap-3">
                  <h4 className="text-sm font-extrabold text-text-primary uppercase tracking-wider flex items-center gap-2">
                    <Target size={16} className="text-accent-blue" /> Actionable Recommendations
                  </h4>

                  {(!optimizationData.recommendations || optimizationData.recommendations.length === 0) ? (
                    <div className="p-6 text-center text-xs text-text-secondary bg-white rounded-2xl border border-border font-medium">
                      No active recommendations at this time.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {optimizationData.recommendations.map((rec) => (
                        <div key={rec.id} className="bg-white p-5 rounded-2xl border border-border shadow-sm flex flex-col justify-between gap-4">
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-accent-purple/10 text-accent-purple">
                                {rec.category}
                              </span>
                              <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${
                                rec.confidence_strength === 'high' ? 'bg-emerald-100 text-emerald-800' :
                                rec.confidence_strength === 'medium' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'
                              }`} title="Confidence indicator (suggestions, not guaranteed outcomes)">
                                Strength: {rec.confidence_strength || 'medium'}
                              </span>
                            </div>

                            <h5 className="font-extrabold text-sm text-text-primary">{rec.title}</h5>
                            <p className="text-xs text-text-secondary font-medium leading-relaxed">{rec.explanation}</p>

                            {rec.supporting_metrics && (
                              <div className="text-[11px] font-mono text-accent-blue bg-accent-blue/5 p-2 rounded-lg border border-accent-blue/10">
                                📊 Supporting Metrics: {rec.supporting_metrics}
                              </div>
                            )}

                            {rec.suggested_action && (
                              <div className="text-xs font-bold text-text-primary bg-surface p-2.5 rounded-lg border border-border">
                                💡 Suggested Action: {rec.suggested_action}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                            <button
                              type="button"
                              onClick={() => handleExecuteRecAction(rec.id, 'ignore')}
                              className="px-3 py-1.5 text-xs font-bold rounded-lg border border-border bg-white text-text-secondary hover:text-text-primary transition-colors"
                            >
                              Ignore
                            </button>
                            <button
                              type="button"
                              onClick={() => setApprovalModalRec(rec)}
                              className="px-4 py-1.5 text-xs font-bold rounded-lg bg-accent-purple text-white hover:bg-accent-purple/90 transition-colors shadow-sm flex items-center gap-1.5"
                            >
                              <Check size={14} /> Apply Recommendation...
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* AI Ad Variations & A/B Testing Section */}
                <div className="bg-white p-6 rounded-2xl border border-border shadow-sm flex flex-col gap-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-extrabold text-text-primary uppercase tracking-wider flex items-center gap-2">
                        <Wand2 size={16} className="text-accent-purple" /> AI Ad Variations & A/B Comparison
                      </h4>
                      <p className="text-xs text-text-secondary font-medium mt-0.5">
                        Generate & test alternative ad copy options. Variations remain PAUSED on Meta until explicitly activated by user.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="text"
                        placeholder="Hint e.g. Focus on free shipping"
                        value={variationPromptHint}
                        onChange={(e) => setVariationPromptHint(e.target.value)}
                        className="px-3 py-1.5 text-xs bg-surface border border-border rounded-xl focus:outline-none focus:border-accent-purple max-w-[200px]"
                      />
                      <button
                        type="button"
                        onClick={handleGenerateVariationsClick}
                        disabled={variationsLoading}
                        className="px-4 py-1.5 bg-gradient-to-r from-accent-purple to-accent-blue text-white text-xs font-bold rounded-xl shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1.5"
                      >
                        <Sparkles size={14} className={variationsLoading ? "animate-spin" : ""} />
                        <span>{variationsLoading ? "Generating..." : "+ Draft Variations"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleSyncVariationsPerformance}
                        disabled={syncingVars}
                        className="px-3 py-1.5 bg-surface border border-border text-text-primary text-xs font-bold rounded-xl hover:bg-border/40 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                        title="Sync performance metrics for published variations from Meta"
                      >
                        <RefreshCw size={13} className={syncingVars ? "animate-spin" : ""} />
                        <span>{syncingVars ? "Syncing..." : "Sync Metrics"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Grid of Variations */}
                  {(!optimizationData.variations || optimizationData.variations.length === 0) ? (
                    <div className="p-6 text-center text-xs text-text-secondary bg-surface/50 rounded-xl font-medium">
                      No ad variations generated yet. Click "+ Draft Variations" to create AI copy alternatives.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {optimizationData.variations.map((variant, idx) => (
                        <div key={variant.id || idx} className="p-5 rounded-2xl border border-border bg-surface/40 flex flex-col justify-between gap-4 shadow-sm">
                          <div className="flex flex-col gap-2.5 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-extrabold text-accent-purple text-xs flex items-center gap-1">
                                <span className="w-5 h-5 rounded-full bg-accent-purple/10 flex items-center justify-center text-[10px]">
                                  {idx + 1}
                                </span>
                                {variant.variation_name || `Variation ${idx + 1}`}
                              </span>

                              <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${
                                variant.meta_publish_status === 'published'
                                  ? 'bg-blue-50 border-blue-200 text-blue-800'
                                  : variant.meta_publish_status === 'failed'
                                  ? 'bg-danger/10 border-danger/20 text-danger'
                                  : 'bg-surface border-border text-text-secondary'
                              }`}>
                                {variant.meta_publish_status === 'published'
                                  ? 'Published (PAUSED)'
                                  : variant.meta_publish_status === 'publishing'
                                  ? 'Publishing...'
                                  : variant.meta_publish_status === 'failed'
                                  ? 'Publish Failed'
                                  : 'Draft Variant'}
                              </span>
                            </div>

                            {variant.meta_ad_id && (
                              <div className="text-[10px] font-mono text-text-secondary flex items-center gap-2 bg-white px-2.5 py-1 rounded-lg border border-border">
                                <span>Meta Ad ID: <strong className="text-text-primary">{variant.meta_ad_id}</strong></span>
                                <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 font-bold uppercase text-[9px]">PAUSED</span>
                              </div>
                            )}

                            <div>
                              <span className="text-[10px] text-text-secondary font-bold uppercase block mb-0.5">Headline</span>
                              <p className="font-extrabold text-text-primary text-xs bg-white p-2 rounded-lg border border-border/60">{variant.headline || "N/A"}</p>
                            </div>

                            <div>
                              <span className="text-[10px] text-text-secondary font-bold uppercase block mb-0.5">Primary Text</span>
                              <p className="text-text-primary font-medium leading-relaxed text-xs bg-white p-2.5 rounded-lg border border-border/60">{variant.primary_text || "N/A"}</p>
                            </div>

                            {variant.creative_concept && (
                              <div>
                                <span className="text-[10px] text-text-secondary font-bold uppercase block mb-0.5">Creative Concept</span>
                                <p className="text-text-secondary text-xs italic bg-purple-50/40 p-2 rounded-lg border border-purple-100">{variant.creative_concept}</p>
                              </div>
                            )}

                            <div className="flex items-center justify-between text-xs pt-1">
                              <span className="text-[10px] text-text-secondary font-bold uppercase">Call To Action</span>
                              <span className="font-extrabold text-accent-blue bg-accent-blue/10 px-2 py-0.5 rounded">{variant.cta || "Learn More"}</span>
                            </div>

                            {variant.meta_error_message && (
                              <div className="p-2 rounded-lg bg-danger/5 border border-danger/20 text-danger text-[11px] font-medium flex items-start gap-1.5">
                                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                                <span>{variant.meta_error_message}</span>
                              </div>
                            )}

                            {/* Performance Delivery Comparison */}
                            <div className="pt-3 border-t border-border/60">
                              <span className="text-[10px] font-extrabold uppercase text-text-secondary tracking-wider block mb-1.5">
                                📊 Variation Performance Metrics
                              </span>
                              {variant.impressions > 0 ? (
                                <div className="grid grid-cols-3 gap-2 bg-white p-2.5 rounded-xl border border-border text-center text-xs">
                                  <div>
                                    <span className="text-[10px] text-text-secondary block font-bold">Imps</span>
                                    <span className="font-extrabold text-text-primary">{variant.impressions.toLocaleString()}</span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-text-secondary block font-bold">Clicks</span>
                                    <span className="font-extrabold text-text-primary">{variant.clicks.toLocaleString()}</span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-text-secondary block font-bold">CTR</span>
                                    <span className="font-extrabold text-emerald-600">{(variant.ctr || 0).toFixed(2)}%</span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-text-secondary block font-bold">CPC</span>
                                    <span className="font-extrabold text-text-primary">${(variant.cpc || 0).toFixed(2)}</span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-text-secondary block font-bold">Spend</span>
                                    <span className="font-extrabold text-text-primary">${(variant.spend || 0).toFixed(2)}</span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-text-secondary block font-bold">Results</span>
                                    <span className="font-extrabold text-text-primary">{variant.results || 0}</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="p-2.5 text-center bg-white rounded-xl border border-border text-[11px] text-text-secondary font-medium italic">
                                  No performance data yet.
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Explicit User Action: Publish Variation Button */}
                          <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-2">
                            {variant.meta_publish_status === 'published' ? (
                              <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-extrabold">
                                <CheckCircle2 size={16} className="text-emerald-600" />
                                <span>Published to Meta (PAUSED)</span>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handlePublishVariationToMeta(variant.id)}
                                disabled={publishingVarId === variant.id}
                                className="w-full py-2 bg-accent-purple hover:bg-accent-purple/90 text-white font-bold text-xs rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                title="Publish this specific variation as a Meta Ad under the parent Ad Set (PAUSED by default)"
                              >
                                {publishingVarId === variant.id ? (
                                  <>
                                    <RefreshCw size={14} className="animate-spin" />
                                    <span>Publishing to Meta...</span>
                                  </>
                                ) : (
                                  <>
                                    <Send size={14} />
                                    <span>Publish Variation to Meta (PAUSED)</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>


              </div>
            ) : null}

          </div>
        ) : null}

        {/* ── D. ADS TABLE ─────────────────────────────────────────────────── */}
        {!showAnalyticsView && !showOptimizationView && (
          <>
        {error ? (
          <div className="p-12 text-center text-danger font-semibold bg-danger/5">
            <AlertCircle size={32} className="mx-auto mb-2 text-danger" />
            {error}
          </div>
        ) : loading ? (
          <div className="p-16 text-center text-text-secondary font-medium">
            <RefreshCw size={28} className="animate-spin mx-auto mb-3 text-accent-purple" />
            Loading campaigns...
          </div>
        ) : ads.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center text-text-secondary mb-4">
              <Megaphone size={28} />
            </div>
            <h3 className="text-lg font-bold text-text-primary mb-1">No campaigns found</h3>
            <p className="text-sm text-text-secondary max-w-sm mb-6 font-medium">
              {activeTab === "All Ads" 
                ? "You haven't created any ad campaigns yet. Launch your first ad or use AI to generate high-converting copy."
                : `No campaigns currently marked as '${activeTab}'.`}
            </p>
            <button
              onClick={handleOpenCreateModal}
              className="flex items-center gap-2 px-5 py-2.5 bg-accent-purple text-white text-sm font-bold rounded-xl shadow-sm hover:bg-accent-purple/90 transition-colors"
            >
              <Plus size={16} /> Create Campaign
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface/60 text-[11px] font-extrabold uppercase text-text-secondary tracking-wider">
                  <th className="py-3.5 px-6">Ad / Campaign</th>
                  <th className="py-3.5 px-4">Platform</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Budget</th>
                  <th className="py-3.5 px-4">Spend</th>
                  <th className="py-3.5 px-4">Results</th>
                  <th className="py-3.5 px-4">Start / End</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-sm font-medium">
                {ads.map((ad) => (
                  <tr key={ad.id} className="hover:bg-surface/50 transition-colors">
                    
                    {/* Ad / Campaign */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-surface border border-border overflow-hidden shrink-0 flex items-center justify-center">
                          {ad.media_path ? (
                            <img src={getImageUrl(ad.media_path)} alt={ad.name} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
                          ) : (
                            <Megaphone size={18} className="text-text-secondary" />
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-text-primary text-sm flex items-center gap-1.5">
                            {ad.name}
                            {ad.ai_optimized && (
                              <span className="text-[10px] bg-accent-purple/10 text-accent-purple px-1.5 py-0.5 rounded font-extrabold" title="AI Optimized">
                                ✨ AI
                              </span>
                            )}
                          </span>
                          <span className="text-xs text-text-secondary truncate max-w-[200px]">
                            {ad.objective} • {ad.headline || ad.primary_text || "No creative text"}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Platform */}
                    <td className="py-4 px-4">
                      <PlatformBadges platform={ad.platform} />
                    </td>

                    {/* Status */}
                    <td className="py-4 px-4">
                      <StatusBadge status={ad.status} />
                    </td>

                    {/* Budget */}
                    <td className="py-4 px-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-text-primary">
                          ${ad.daily_budget ? `${ad.daily_budget}/day` : `$${ad.total_budget}`}
                        </span>
                        <span className="text-[11px] text-text-secondary">
                          {ad.daily_budget ? "Daily" : "Lifetime"}
                        </span>
                      </div>
                    </td>

                    {/* Spend */}
                    <td className="py-4 px-4 font-bold text-text-primary">
                      ${(ad.spend || 0).toFixed(2)}
                    </td>

                    {/* Results */}
                    <td className="py-4 px-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-text-primary">{ad.results || 0}</span>
                        <span className="text-[11px] text-text-secondary">Conversions</span>
                      </div>
                    </td>

                    {/* Dates */}
                    <td className="py-4 px-4 text-xs text-text-secondary">
                      <div>Start: {ad.start_date ? new Date(ad.start_date).toLocaleDateString() : "Immediate"}</div>
                      <div>End: {ad.end_date ? new Date(ad.end_date).toLocaleDateString() : "Ongoing"}</div>
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {ad.meta_campaign_id ? (
                          <>
                            {/* Sync with Meta */}
                            <button
                              onClick={() => handleSyncMetaStatus(ad.id)}
                              disabled={syncingMetaId === ad.id}
                              className="p-1.5 rounded-lg text-accent-blue hover:bg-accent-blue/10 transition-colors disabled:opacity-50"
                              title="Sync status with Meta API"
                            >
                              <RefreshCw size={16} className={syncingMetaId === ad.id ? "animate-spin text-accent-blue" : ""} />
                            </button>

                            {/* Meta Pause / Resume Campaign */}
                            {ad.meta_campaign_status === 'ACTIVE' ? (
                              <button
                                onClick={() => handleUpdateMetaStatus(ad.id, 'pause', 'campaign')}
                                disabled={Boolean(metaActionKey)}
                                className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-50"
                                title="Pause Campaign on Meta"
                              >
                                {metaActionKey === `${ad.id}-campaign-pause` ? (
                                  <RefreshCw size={16} className="animate-spin" />
                                ) : (
                                  <Pause size={16} />
                                )}
                              </button>
                            ) : (
                              <button
                                onClick={() => handleUpdateMetaStatus(ad.id, 'resume', 'campaign')}
                                disabled={Boolean(metaActionKey)}
                                className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50"
                                title="Resume Campaign on Meta (User Action Required)"
                              >
                                {metaActionKey === `${ad.id}-campaign-resume` ? (
                                  <RefreshCw size={16} className="animate-spin" />
                                ) : (
                                  <Play size={16} />
                                )}
                              </button>
                            )}
                          </>
                        ) : (
                          <button
                            onClick={() => handlePublishToMeta(ad.id)}
                            disabled={publishingMetaId === ad.id}
                            className="p-1.5 rounded-lg text-accent-purple hover:bg-accent-purple/10 transition-colors disabled:opacity-50"
                            title="Publish to Meta Ads Manager (PAUSED)"
                          >
                            {publishingMetaId === ad.id ? (
                              <RefreshCw size={16} className="animate-spin text-accent-purple" />
                            ) : (
                              <Send size={16} />
                            )}
                          </button>
                        )}

                        {ad.meta_publish_status === 'failed' && (
                          <button
                            type="button"
                            onClick={() => handleRetryPublish(ad.id)}
                            disabled={retryingId === ad.id}
                            className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-50"
                            title="Retry Publishing to Meta Ads Manager"
                          >
                            <RotateCcw size={16} className={retryingId === ad.id ? "animate-spin text-amber-600" : ""} />
                          </button>
                        )}

                        <button
                          onClick={() => setViewingAd(ad)}
                          className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface transition-colors"
                          title="View Details & Meta Control"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(ad)}
                          className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface transition-colors"
                          title="Edit Campaign"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          onClick={() => handleTogglePause(ad)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            ad.status === 'active' 
                              ? 'text-amber-600/60 hover:bg-amber-50' 
                              : 'text-emerald-600/60 hover:bg-emerald-50'
                          }`}
                          title={ad.status === 'active' ? "Pause Local Status" : "Resume Local Status"}
                        >
                          {ad.status === 'active' ? <Pause size={16} /> : <Play size={16} />}
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(ad.id)}
                          className="p-1.5 rounded-lg text-danger/70 hover:text-danger hover:bg-danger/10 transition-colors"
                          title="Delete Campaign"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </>
        )}
      </div>

      {/* ── E. CREATE / EDIT AD MODAL ─────────────────────────────────────── */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full border border-border shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-border flex items-center justify-between bg-surface/40">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent-purple/10 text-accent-purple flex items-center justify-center">
                  <Megaphone size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-text-primary">
                    {editingAd ? "Edit Ad Campaign" : "Create New Ad Campaign"}
                  </h2>
                  <p className="text-xs text-text-secondary font-medium mt-0.5">Configure targeting, creative, and campaign budget.</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAiGenerator(!showAiGenerator)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
                    showAiGenerator
                      ? "bg-accent-purple text-white"
                      : "bg-gradient-to-r from-accent-purple/15 to-accent-blue/15 text-accent-purple hover:bg-accent-purple/25 border border-accent-purple/30"
                  }`}
                >
                  <Sparkles size={14} />
                  <span>{showAiGenerator ? "Back to Form" : "✨ Generate with AI"}</span>
                </button>
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="p-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-surface transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body: AI Campaign Generator Panel OR Manual Form */}
            {showAiGenerator ? (
              <div className="p-6 max-h-[75vh] overflow-y-auto flex flex-col gap-6 custom-scrollbar bg-gradient-to-br from-surface/40 to-white">
                
                {/* AI Assistant Intro Banner */}
                <div className="p-5 rounded-2xl bg-gradient-to-r from-primary-navy via-slate-900 to-accent-purple text-white shadow-md">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-accent-purple">
                      <Sparkles size={18} />
                    </div>
                    <h3 className="text-base font-extrabold">AI Campaign Assistant</h3>
                  </div>
                  <p className="text-xs text-white/80 font-medium leading-relaxed">
                    Provide a brief overview of your product or offer. AI will generate high-converting copy, audience parameters, daily budget suggestions, and 3 ad copy variations.
                  </p>
                </div>

                {aiError && (
                  <div className="p-4 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs font-semibold flex items-center gap-2">
                    <AlertCircle size={16} /> {aiError}
                  </div>
                )}

                {/* AI Input Form */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-text-primary">Product / Service Name *</label>
                    <input
                      type="text"
                      placeholder="e.g., Wireless Noise-Canceling Headphones"
                      value={aiInputs.product_service}
                      onChange={(e) => setAiInputs({ ...aiInputs, product_service: e.target.value })}
                      className="px-3.5 py-2.5 bg-white border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:border-accent-purple"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-text-primary">Campaign Objective</label>
                    <select
                      value={aiInputs.objective}
                      onChange={(e) => setAiInputs({ ...aiInputs, objective: e.target.value })}
                      className="px-3.5 py-2.5 bg-white border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:border-accent-purple"
                    >
                      <option value="Awareness">Awareness (Reach & Brand Recall)</option>
                      <option value="Traffic">Traffic (Website Clicks)</option>
                      <option value="Engagement">Engagement (Post Likes & Comments)</option>
                      <option value="Leads">Leads (Form Submissions)</option>
                      <option value="Sales">Sales (Direct Purchases)</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-text-primary">Target Audience Description</label>
                  <input
                    type="text"
                    placeholder="e.g., Tech enthusiasts, remote workers, audio lovers aged 20-45"
                    value={aiInputs.target_audience}
                    onChange={(e) => setAiInputs({ ...aiInputs, target_audience: e.target.value })}
                    className="px-3.5 py-2.5 bg-white border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:border-accent-purple"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-text-primary">Campaign Description / Offer Details</label>
                  <textarea
                    rows={3}
                    placeholder="e.g., Summer Flash Sale: 30% off all premium headphones with free shipping worldwide..."
                    value={aiInputs.campaign_description}
                    onChange={(e) => setAiInputs({ ...aiInputs, campaign_description: e.target.value })}
                    className="px-3.5 py-2.5 bg-white border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:border-accent-purple"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-text-primary">Target Daily Budget ($) (Optional)</label>
                    <input
                      type="number"
                      placeholder="e.g., 20"
                      value={aiInputs.daily_budget}
                      onChange={(e) => setAiInputs({ ...aiInputs, daily_budget: e.target.value })}
                      className="px-3.5 py-2.5 bg-white border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:border-accent-purple"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-text-primary">Duration (Days) (Optional)</label>
                    <input
                      type="number"
                      placeholder="e.g., 7"
                      value={aiInputs.duration_days}
                      onChange={(e) => setAiInputs({ ...aiInputs, duration_days: e.target.value })}
                      className="px-3.5 py-2.5 bg-white border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:border-accent-purple"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={handleGenerateAiCampaign}
                    disabled={aiGenerating || !aiInputs.product_service.trim()}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-accent-purple to-accent-blue text-white font-bold text-sm rounded-xl shadow-md hover:opacity-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {aiGenerating ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        <span>AI is creating your campaign...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} />
                        <span>✨ Generate with AI</span>
                      </>
                    )}
                  </button>
                </div>

                {/* AI Output / Results Preview */}
                {aiResult && (
                  <div className="flex flex-col gap-5 pt-5 border-t border-border animate-in fade-in duration-300">
                    <div className="flex items-center justify-between">
                      <h4 className="text-base font-extrabold text-accent-purple flex items-center gap-2">
                        <CheckCircle2 size={18} /> Generated Campaign Proposal
                      </h4>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleGenerateAiCampaign}
                          disabled={aiGenerating}
                          className="px-3.5 py-1.5 text-xs font-bold rounded-lg border border-border bg-white text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1.5"
                        >
                          <RefreshCw size={12} className={aiGenerating ? "animate-spin" : ""} /> Regenerate
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUseAiCampaign()}
                          className="px-4 py-1.5 text-xs font-bold rounded-lg bg-accent-purple text-white hover:bg-accent-purple/90 transition-colors shadow-sm flex items-center gap-1.5"
                        >
                          <Check size={14} /> Use This Campaign
                        </button>
                      </div>
                    </div>

                    {/* Main Proposed Concept */}
                    <div className="p-4 rounded-2xl bg-white border border-accent-purple/20 shadow-sm flex flex-col gap-3">
                      <div>
                        <span className="text-[11px] font-extrabold text-accent-purple uppercase tracking-wider">Campaign Name</span>
                        <h5 className="font-extrabold text-base text-text-primary">{aiResult.campaign_name}</h5>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-surface/60 p-3 rounded-xl">
                        <div>
                          <span className="text-text-secondary font-bold block mb-0.5">Headline</span>
                          <span className="font-bold text-text-primary">{aiResult.headline}</span>
                        </div>
                        <div>
                          <span className="text-text-secondary font-bold block mb-0.5">Call to Action</span>
                          <span className="font-bold text-accent-purple">{aiResult.cta}</span>
                        </div>
                      </div>

                      <div>
                        <span className="text-[11px] font-bold text-text-secondary block mb-1">Primary Ad Copy</span>
                        <p className="text-sm text-text-primary font-medium leading-relaxed bg-surface/40 p-3 rounded-xl border border-border/40">
                          {aiResult.primary_text}
                        </p>
                      </div>

                      {/* Audience & Budget Info */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs">
                        <div className="p-2.5 rounded-xl bg-surface border border-border">
                          <span className="text-text-secondary font-semibold block text-[10px]">Location</span>
                          <span className="font-bold text-text-primary truncate block">{aiResult.audience?.location}</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-surface border border-border">
                          <span className="text-text-secondary font-semibold block text-[10px]">Age Target</span>
                          <span className="font-bold text-text-primary">{aiResult.audience?.age_min} - {aiResult.audience?.age_max}</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-surface border border-border">
                          <span className="text-text-secondary font-semibold block text-[10px]">Suggested Budget</span>
                          <span className="font-bold text-emerald-600">${aiResult.budget?.daily}/day</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-surface border border-border">
                          <span className="text-text-secondary font-semibold block text-[10px]">Duration</span>
                          <span className="font-bold text-text-primary">{aiResult.budget?.recommended_duration_days} days</span>
                        </div>
                      </div>

                      {/* Target Interests */}
                      {Array.isArray(aiResult.audience?.interests) && aiResult.audience.interests.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-xs font-bold text-text-secondary mr-1">Interests:</span>
                          {aiResult.audience.interests.map((interest, idx) => (
                            <span key={idx} className="px-2 py-0.5 rounded-md bg-accent-purple/10 text-accent-purple text-[11px] font-bold">
                              {interest}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 3 Alternative Variations */}
                    {Array.isArray(aiResult.ad_variations) && aiResult.ad_variations.length > 0 && (
                      <div className="flex flex-col gap-3">
                        <h5 className="text-xs font-extrabold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
                          <Copy size={14} className="text-accent-blue" /> 3 Alternative Copy Variations
                        </h5>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {aiResult.ad_variations.map((varItem, vIdx) => (
                            <div key={vIdx} className="p-3.5 rounded-2xl bg-white border border-border shadow-sm flex flex-col justify-between gap-3">
                              <div className="flex flex-col gap-1.5">
                                <span className="text-[10px] font-extrabold uppercase text-accent-blue bg-accent-blue/10 px-2 py-0.5 rounded-md w-fit">
                                  Variation {vIdx + 1}
                                </span>
                                <h6 className="font-bold text-xs text-text-primary line-clamp-1">{varItem.headline}</h6>
                                <p className="text-xs text-text-secondary line-clamp-4 font-medium leading-relaxed">
                                  {varItem.primary_text}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleUseAiCampaign(varItem)}
                                className="w-full py-1.5 text-xs font-bold rounded-lg border border-accent-blue/30 text-accent-blue hover:bg-accent-blue/10 transition-colors"
                              >
                                Use Variation {vIdx + 1}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                )}

              </div>
            ) : (
              <div className="p-6 max-h-[75vh] overflow-y-auto flex flex-col gap-6 custom-scrollbar">
                
                {/* Campaign Info */}
                <div className="flex flex-col gap-4">
                  <h3 className="text-sm font-extrabold text-text-primary uppercase tracking-wider flex items-center gap-2">
                    <Target size={16} className="text-accent-purple" /> Campaign Information
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-text-primary">Campaign Name *</label>
                      <input
                        type="text"
                        placeholder="e.g., Summer Sale Promo 2026"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="px-3.5 py-2.5 bg-surface border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:border-accent-purple"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-text-primary">Objective</label>
                      <select
                        value={formData.objective}
                        onChange={(e) => setFormData({ ...formData, objective: e.target.value })}
                        className="px-3.5 py-2.5 bg-surface border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:border-accent-purple"
                      >
                        <option value="Awareness">Awareness (Reach & Impressions)</option>
                        <option value="Traffic">Traffic (Website Clicks)</option>
                        <option value="Engagement">Engagement (Post Interactions)</option>
                        <option value="Leads">Leads (Form Submissions)</option>
                        <option value="Sales">Sales (Conversions)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-text-primary">Target Platform</label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { id: "instagram", label: "Instagram Only" },
                        { id: "facebook", label: "Facebook Only" },
                        { id: "instagram,facebook", label: "Instagram + Facebook" },
                      ].map((p) => (
                        <button
                          type="button"
                          key={p.id}
                          onClick={() => setFormData({ ...formData, platform: p.id })}
                          className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                            formData.platform === p.id
                              ? "bg-accent-purple/10 border-accent-purple text-accent-purple shadow-sm"
                              : "bg-surface border-border text-text-secondary hover:text-text-primary"
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Creative Section */}
                <div className="flex flex-col gap-4 border-t border-border pt-5">
                  <h3 className="text-sm font-extrabold text-text-primary uppercase tracking-wider flex items-center gap-2">
                    <UploadCloud size={16} className="text-accent-blue" /> Ad Creative & Copy
                  </h3>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-text-primary">Primary Copy / Description</label>
                    <textarea
                      rows={3}
                      placeholder="Write compelling ad copy that engages your audience..."
                      value={formData.primary_text}
                      onChange={(e) => setFormData({ ...formData, primary_text: e.target.value })}
                      className="px-3.5 py-2.5 bg-surface border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:border-accent-purple"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-text-primary">Headline</label>
                      <input
                        type="text"
                        placeholder="e.g., Get 30% Off Today Only!"
                        value={formData.headline}
                        onChange={(e) => setFormData({ ...formData, headline: e.target.value })}
                        className="px-3.5 py-2.5 bg-surface border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:border-accent-purple"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-text-primary">Call to Action (CTA)</label>
                      <select
                        value={formData.cta}
                        onChange={(e) => setFormData({ ...formData, cta: e.target.value })}
                        className="px-3.5 py-2.5 bg-surface border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:border-accent-purple"
                      >
                        <option value="Learn More">Learn More</option>
                        <option value="Shop Now">Shop Now</option>
                        <option value="Sign Up">Sign Up</option>
                        <option value="Contact Us">Contact Us</option>
                        <option value="Apply Now">Apply Now</option>
                      </select>
                    </div>
                  </div>

                  {/* Media Asset & AI Visual Creative Section */}
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-text-primary">Media Asset (Image / Video)</label>
                      <button
                        type="button"
                        onClick={() => setShowCreativeSection(!showCreativeSection)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          showCreativeSection
                            ? "bg-accent-purple text-white shadow-sm"
                            : "bg-accent-purple/10 text-accent-purple hover:bg-accent-purple/20 border border-accent-purple/30"
                        }`}
                      >
                        <Sparkles size={14} />
                        <span>{showCreativeSection ? "Hide Creative Generator" : "✨ Generate AI Creative"}</span>
                      </button>
                    </div>

                    {/* AI Visual Creative Generator Drawer */}
                    {showCreativeSection && (
                      <div className="p-4 rounded-2xl bg-gradient-to-br from-accent-purple/5 via-surface to-accent-blue/5 border border-accent-purple/20 flex flex-col gap-4 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-extrabold text-accent-purple uppercase tracking-wider flex items-center gap-1.5">
                            <Sparkles size={14} /> AI Visual Creative Studio
                          </h4>
                          <span className="text-[11px] text-text-secondary font-medium">Uses campaign copy, product info & headline</span>
                        </div>

                        {creativeError && (
                          <div className="p-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs font-semibold flex items-center gap-2">
                            <AlertCircle size={16} /> {creativeError}
                          </div>
                        )}

                        <div className="flex flex-col gap-1.5">
                          <label className="text-[11px] font-bold text-text-secondary">Custom Visual Prompt / Style (Optional)</label>
                          <input
                            type="text"
                            placeholder="e.g. Modern minimalist product shot, studio lighting, vibrant background..."
                            value={creativePromptInput}
                            onChange={(e) => setCreativePromptInput(e.target.value)}
                            className="px-3 py-2 bg-white border border-border rounded-xl text-xs text-text-primary focus:outline-none focus:border-accent-purple"
                          />
                        </div>

                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={handleGenerateCreative}
                            disabled={creativeGenerating}
                            className="flex items-center gap-2 px-4 py-2 bg-accent-purple hover:bg-accent-purple/90 text-white font-bold text-xs rounded-xl shadow-sm transition-all disabled:opacity-50"
                          >
                            {creativeGenerating ? (
                              <>
                                <RefreshCw size={14} className="animate-spin" />
                                <span>Generating Visual Creative...</span>
                              </>
                            ) : (
                              <>
                                <Wand2 size={14} />
                                <span>Generate Creative</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Generated Creative Preview Card */}
                        {creativeResult && creativeResult.media_path && (
                          <div className="p-4 rounded-2xl bg-white border border-emerald-500/30 shadow-md flex flex-col gap-3 animate-in zoom-in-95 duration-200">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                                <CheckCircle2 size={16} className="text-emerald-500" /> Generated Creative Preview
                              </span>
                              <span className="text-[10px] text-text-secondary font-medium">Not selected yet</span>
                            </div>

                            <div className="relative w-full h-56 rounded-xl overflow-hidden border border-border bg-black/5 flex items-center justify-center">
                              <img
                                src={getImageUrl(creativeResult.media_path)}
                                alt="AI Creative Preview"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  console.error("Creative image failed to render:", creativeResult.media_path);
                                }}
                              />
                            </div>

                            <div className="flex items-center justify-between gap-3 pt-1">
                              <button
                                type="button"
                                onClick={handleGenerateCreative}
                                disabled={creativeGenerating}
                                className="px-3.5 py-2 rounded-xl border border-border bg-white text-text-secondary hover:text-text-primary text-xs font-bold transition-colors flex items-center gap-1.5"
                              >
                                <RefreshCw size={14} className={creativeGenerating ? "animate-spin" : ""} />
                                <span>Regenerate</span>
                              </button>
                              <button
                                type="button"
                                onClick={handleSelectCreative}
                                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5"
                              >
                                <Check size={14} />
                                <span>Select Creative</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Standard Selected Media & Manual Upload */}
                    <div className="flex items-center gap-4">
                      {formData.media_path ? (
                        <div className="relative w-24 h-24 rounded-2xl overflow-hidden border-2 border-accent-purple group shrink-0 shadow-sm">
                          <img src={getImageUrl(formData.media_path)} alt="Selected Ad Creative" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, media_path: "" })}
                              className="p-1.5 bg-danger text-white rounded-full hover:scale-105 transition-transform"
                              title="Remove Media"
                            >
                              <X size={14} />
                            </button>
                          </div>
                          <span className="absolute bottom-1 left-1 bg-accent-purple text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded">
                            Selected
                          </span>
                        </div>
                      ) : null}

                      <label className="flex-1 flex flex-col items-center justify-center p-4 border-2 border-dashed border-border hover:border-accent-purple/50 rounded-2xl cursor-pointer bg-surface/50 hover:bg-surface transition-all">
                        <UploadCloud size={24} className="text-text-secondary mb-1" />
                        <span className="text-xs font-bold text-text-primary">
                          {uploadingMedia ? "Uploading..." : "Click to upload custom media asset"}
                        </span>
                        <span className="text-[11px] text-text-secondary">PNG, JPG, MP4 supported</span>
                        <input type="file" accept="image/*,video/*" className="hidden" onChange={handleMediaUpload} disabled={uploadingMedia} />
                      </label>
                    </div>
                  </div>
                </div>


                {/* Audience Targeting */}
                <div className="flex flex-col gap-4 border-t border-border pt-5">
                  <h3 className="text-sm font-extrabold text-text-primary uppercase tracking-wider flex items-center gap-2">
                    <Users size={16} className="text-amber-500" /> Audience Targeting
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-text-primary">Location</label>
                      <input
                        type="text"
                        placeholder="e.g., United States, California"
                        value={formData.audience_location}
                        onChange={(e) => setFormData({ ...formData, audience_location: e.target.value })}
                        className="px-3.5 py-2.5 bg-surface border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:border-accent-purple"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-text-primary">Gender</label>
                      <select
                        value={formData.audience_gender}
                        onChange={(e) => setFormData({ ...formData, audience_gender: e.target.value })}
                        className="px-3.5 py-2.5 bg-surface border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:border-accent-purple"
                      >
                        <option value="all">All Genders</option>
                        <option value="men">Men Only</option>
                        <option value="women">Women Only</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-text-primary">Min Age</label>
                      <input
                        type="number"
                        min={13}
                        max={65}
                        value={formData.audience_age_min}
                        onChange={(e) => setFormData({ ...formData, audience_age_min: e.target.value })}
                        className="px-3.5 py-2.5 bg-surface border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:border-accent-purple"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-text-primary">Max Age</label>
                      <input
                        type="number"
                        min={18}
                        max={65}
                        value={formData.audience_age_max}
                        onChange={(e) => setFormData({ ...formData, audience_age_max: e.target.value })}
                        className="px-3.5 py-2.5 bg-surface border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:border-accent-purple"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-text-primary">Target Interests</label>
                    <input
                      type="text"
                      placeholder="e.g., E-commerce, Marketing, Technology"
                      value={formData.audience_interests}
                      onChange={(e) => setFormData({ ...formData, audience_interests: e.target.value })}
                      className="px-3.5 py-2.5 bg-surface border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:border-accent-purple"
                    />
                  </div>
                </div>

                {/* Budget & Schedule */}
                <div className="flex flex-col gap-4 border-t border-border pt-5">
                  <h3 className="text-sm font-extrabold text-text-primary uppercase tracking-wider flex items-center gap-2">
                    <DollarSign size={16} className="text-emerald-500" /> Budget & Schedule
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-text-primary">Daily Budget ($)</label>
                      <input
                        type="number"
                        step="0.5"
                        placeholder="10.00"
                        value={formData.daily_budget}
                        onChange={(e) => setFormData({ ...formData, daily_budget: e.target.value })}
                        className="px-3.5 py-2.5 bg-surface border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:border-accent-purple"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-text-primary">Total Budget Cap ($)</label>
                      <input
                        type="number"
                        step="1"
                        placeholder="100.00"
                        value={formData.total_budget}
                        onChange={(e) => setFormData({ ...formData, total_budget: e.target.value })}
                        className="px-3.5 py-2.5 bg-surface border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:border-accent-purple"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-text-primary">Start Date & Time</label>
                      <input
                        type="datetime-local"
                        value={formData.start_date}
                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                        className="px-3.5 py-2.5 bg-surface border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:border-accent-purple"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-text-primary">End Date & Time</label>
                      <input
                        type="datetime-local"
                        value={formData.end_date}
                        onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                        className="px-3.5 py-2.5 bg-surface border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:border-accent-purple"
                      />
                    </div>
                  </div>
                </div>

                {/* AI Optimization Option */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-accent-purple/10 to-accent-blue/10 border border-accent-purple/20 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-accent-purple/20 text-accent-purple flex items-center justify-center shrink-0">
                      <Sparkles size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-text-primary">Let AI optimize this campaign</h4>
                      <p className="text-xs text-text-secondary font-medium">Automatically tune audience parameters and budget allocation for max ROAS.</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, ai_optimized: !formData.ai_optimized })}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      formData.ai_optimized ? 'bg-accent-purple' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        formData.ai_optimized ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

              </div>
            )}

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-border bg-surface/40 flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-5 py-2.5 rounded-xl border border-border bg-white text-text-primary font-bold text-sm hover:bg-surface transition-colors"
              >
                Cancel
              </button>

              {!showAiGenerator && (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleSubmitAd("draft")}
                    disabled={submitting}
                    className="px-5 py-2.5 rounded-xl border border-border bg-white hover:bg-surface text-text-primary font-bold text-sm transition-colors disabled:opacity-50"
                  >
                    Save Draft
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSubmitAd(formData.start_date ? "scheduled" : "active")}
                    disabled={submitting}
                    className="px-6 py-2.5 rounded-xl bg-accent-purple hover:bg-accent-purple/90 text-white font-bold text-sm shadow-sm transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {submitting ? "Saving..." : editingAd ? "Update Campaign" : formData.start_date ? "Schedule Ad" : "Publish Ad"}
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ── DETAILS VIEW MODAL ───────────────────────────────────────────── */}
      {viewingAd && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-border shadow-2xl p-6 flex flex-col gap-5 max-h-[90vh] overflow-y-auto custom-scrollbar my-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-lg text-text-primary">{viewingAd.name}</h3>
                <StatusBadge status={viewingAd.status} />
              </div>
              <button onClick={() => setViewingAd(null)} className="p-1.5 text-text-secondary hover:text-text-primary rounded-lg">
                <X size={18} />
              </button>
            </div>

            {viewingAd.media_path && (
              <div className="h-44 rounded-2xl overflow-hidden border border-border">
                <img src={getImageUrl(viewingAd.media_path)} alt={viewingAd.name} className="w-full h-full object-cover" />
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-surface p-3 rounded-xl border border-border">
                <span className="text-text-secondary font-semibold block mb-0.5">Objective</span>
                <span className="font-bold text-text-primary">{viewingAd.objective}</span>
              </div>
              <div className="bg-surface p-3 rounded-xl border border-border">
                <span className="text-text-secondary font-semibold block mb-0.5">Target Platforms</span>
                <span className="font-bold text-text-primary capitalize">{viewingAd.platform}</span>
              </div>
              <div className="bg-surface p-3 rounded-xl border border-border">
                <span className="text-text-secondary font-semibold block mb-0.5">Daily Budget</span>
                <span className="font-bold text-text-primary">${viewingAd.daily_budget}/day</span>
              </div>
              <div className="bg-surface p-3 rounded-xl border border-border">
                <span className="text-text-secondary font-semibold block mb-0.5">Total Spend</span>
                <span className="font-bold text-emerald-600">${viewingAd.spend.toFixed(2)}</span>
              </div>
            </div>

            {viewingAd.primary_text && (
              <div className="bg-surface p-3.5 rounded-xl border border-border text-xs">
                <span className="text-text-secondary font-semibold block mb-1">Ad Copy & Headline</span>
                {viewingAd.headline && <p className="font-extrabold text-text-primary mb-1">{viewingAd.headline}</p>}
                <p className="text-text-primary font-medium leading-relaxed">{viewingAd.primary_text}</p>
              </div>
            )}

            {/* ── META ADS MANAGEMENT & CONTROLS (Phase 6) ────────────────── */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-surface/80 to-accent-purple/5 border border-border flex flex-col gap-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-text-primary uppercase tracking-wider text-xs flex items-center gap-1.5">
                  <Send size={15} className="text-accent-purple" /> Meta Ads Objects & Controls
                </span>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold uppercase ${
                    viewingAd.meta_publish_status === 'published' ? 'bg-emerald-100 text-emerald-800' :
                    viewingAd.meta_publish_status === 'failed' ? 'bg-danger/10 text-danger' :
                    viewingAd.meta_publish_status === 'publishing' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {viewingAd.meta_publish_status || 'not_published'}
                  </span>
                  
                  {viewingAd.meta_campaign_id && (
                    <button
                      type="button"
                      onClick={() => handleSyncMetaStatus(viewingAd.id)}
                      disabled={syncingMetaId === viewingAd.id}
                      className="px-2.5 py-1 rounded-lg bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/20 font-bold transition-all flex items-center gap-1 text-[11px]"
                      title="Sync statuses with Meta API"
                    >
                      <RefreshCw size={12} className={syncingMetaId === viewingAd.id ? "animate-spin" : ""} />
                      <span>Sync Meta</span>
                    </button>
                  )}
                </div>
              </div>

              {viewingAd.meta_error_message && (
                <div className="p-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-[11px] font-semibold flex items-start gap-2">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <span>{viewingAd.meta_error_message}</span>
                </div>
              )}

              {viewingAd.meta_campaign_id ? (
                <div className="flex flex-col gap-3 pt-1">
                  
                  {/* Meta Campaign Control Row */}
                  <div className="p-3 rounded-xl bg-white border border-border flex items-center justify-between gap-3 shadow-sm">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-extrabold text-text-secondary uppercase">Campaign</span>
                      <span className="font-mono font-bold text-accent-purple text-xs">{viewingAd.meta_campaign_id}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                        viewingAd.meta_campaign_status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {viewingAd.meta_campaign_status || 'PAUSED'}
                      </span>
                      
                      {viewingAd.meta_campaign_status === 'ACTIVE' ? (
                        <button
                          type="button"
                          onClick={() => handleUpdateMetaStatus(viewingAd.id, 'pause', 'campaign')}
                          disabled={Boolean(metaActionKey)}
                          className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 font-bold hover:bg-amber-100 transition-colors flex items-center gap-1"
                        >
                          {metaActionKey === `${viewingAd.id}-campaign-pause` ? <RefreshCw size={12} className="animate-spin" /> : <Pause size={12} />}
                          <span>Pause</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleUpdateMetaStatus(viewingAd.id, 'resume', 'campaign')}
                          disabled={Boolean(metaActionKey)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold hover:bg-emerald-100 transition-colors flex items-center gap-1"
                        >
                          {metaActionKey === `${viewingAd.id}-campaign-resume` ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
                          <span>Resume</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Meta Ad Set Control Row */}
                  {viewingAd.meta_adset_id && (
                    <div className="p-3 rounded-xl bg-white border border-border flex items-center justify-between gap-3 shadow-sm">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-extrabold text-text-secondary uppercase">Ad Set</span>
                        <span className="font-mono font-bold text-accent-purple text-xs">{viewingAd.meta_adset_id}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                          viewingAd.meta_adset_status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {viewingAd.meta_adset_status || 'PAUSED'}
                        </span>
                        
                        {viewingAd.meta_adset_status === 'ACTIVE' ? (
                          <button
                            type="button"
                            onClick={() => handleUpdateMetaStatus(viewingAd.id, 'pause', 'adset')}
                            disabled={Boolean(metaActionKey)}
                            className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 font-bold hover:bg-amber-100 transition-colors flex items-center gap-1"
                          >
                            {metaActionKey === `${viewingAd.id}-adset-pause` ? <RefreshCw size={12} className="animate-spin" /> : <Pause size={12} />}
                            <span>Pause</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleUpdateMetaStatus(viewingAd.id, 'resume', 'adset')}
                            disabled={Boolean(metaActionKey)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold hover:bg-emerald-100 transition-colors flex items-center gap-1"
                          >
                            {metaActionKey === `${viewingAd.id}-adset-resume` ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
                            <span>Resume</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Meta Ad Control Row */}
                  {viewingAd.meta_ad_id && (
                    <div className="p-3 rounded-xl bg-white border border-border flex items-center justify-between gap-3 shadow-sm">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-extrabold text-text-secondary uppercase">Ad Object</span>
                        <span className="font-mono font-bold text-accent-purple text-xs">{viewingAd.meta_ad_id}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                          viewingAd.meta_ad_status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {viewingAd.meta_ad_status || 'PAUSED'}
                        </span>
                        
                        {viewingAd.meta_ad_status === 'ACTIVE' ? (
                          <button
                            type="button"
                            onClick={() => handleUpdateMetaStatus(viewingAd.id, 'pause', 'ad')}
                            disabled={Boolean(metaActionKey)}
                            className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 font-bold hover:bg-amber-100 transition-colors flex items-center gap-1"
                          >
                            {metaActionKey === `${viewingAd.id}-ad-pause` ? <RefreshCw size={12} className="animate-spin" /> : <Pause size={12} />}
                            <span>Pause</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleUpdateMetaStatus(viewingAd.id, 'resume', 'ad')}
                            disabled={Boolean(metaActionKey)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold hover:bg-emerald-100 transition-colors flex items-center gap-1"
                          >
                            {metaActionKey === `${viewingAd.id}-ad-resume` ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
                            <span>Resume</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              ) : (
                <div className="p-4 text-center text-text-secondary bg-white rounded-xl border border-border font-medium">
                  This campaign has not been published to Meta Ads Manager yet.
                </div>
              )}
            </div>

            {/* ── AUDIT / ACTIVITY LOG SECTION ─────────────────────────────── */}
            <div className="flex flex-col gap-3 pt-1 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
                  <Activity size={14} className="text-accent-blue" /> Chronological Activity Audit Log
                </span>
                <div className="flex items-center gap-2">
                  {viewingAd.last_synced_at && (
                    <span className="text-[10px] text-text-secondary font-medium flex items-center gap-1">
                      <Clock size={11} className="text-accent-purple" /> Last synced: {new Date(viewingAd.last_synced_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  {loadingLogs && <RefreshCw size={12} className="animate-spin text-text-secondary" />}
                </div>
              </div>

              {activityLogs.length === 0 ? (
                <div className="p-3 text-center text-xs text-text-secondary bg-surface rounded-xl font-medium">
                  No management activities recorded yet.
                </div>
              ) : (
                <div className="space-y-2 max-h-44 overflow-y-auto custom-scrollbar pr-1">
                  {activityLogs.map((log) => (
                    <div key={log.id} className="p-2.5 rounded-xl bg-surface/60 border border-border/80 flex flex-col gap-1 text-[11px]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${log.status === 'success' ? 'bg-emerald-500' : 'bg-danger'}`}></span>
                          <span className="font-extrabold text-text-primary capitalize">
                            {log.action.replace('_', ' ')}
                          </span>
                          <span className="px-1.5 py-0.2 text-[9px] font-extrabold uppercase rounded bg-accent-purple/10 text-accent-purple">
                            {log.object_type || 'campaign'}
                          </span>
                        </div>
                        <span className="text-[10px] text-text-secondary font-mono">
                          {new Date(log.timestamp || log.created_at).toLocaleString()}
                        </span>
                      </div>

                      {log.meta_object_id && (
                        <span className="text-[10px] text-text-secondary font-mono">
                          Meta Object: {log.meta_object_id}
                        </span>
                      )}

                      {log.error_message && (
                        <div className="text-danger font-semibold bg-danger/5 p-1.5 rounded border border-danger/10 flex items-start gap-1">
                          <AlertCircle size={12} className="shrink-0 mt-0.5" />
                          <span>{log.error_message}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-border">
              {!viewingAd.meta_campaign_id ? (
                <button
                  type="button"
                  onClick={() => handlePublishToMeta(viewingAd.id)}
                  disabled={publishingMetaId === viewingAd.id}
                  className="px-4 py-2 bg-accent-purple hover:bg-accent-purple/90 text-white font-bold text-xs rounded-xl shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {publishingMetaId === viewingAd.id ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Publishing to Meta...</span>
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      <span>Publish to Meta (PAUSED)</span>
                    </>
                  )}
                </button>
              ) : viewingAd.meta_publish_status === 'failed' ? (
                <button
                  type="button"
                  onClick={() => handleRetryPublish(viewingAd.id)}
                  disabled={retryingId === viewingAd.id}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {retryingId === viewingAd.id ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Retrying Publish...</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw size={14} />
                      <span>Retry Publish to Meta</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="text-[11px] text-text-secondary font-semibold flex items-center gap-1">
                  <ShieldCheck size={14} className="text-emerald-600" />
                  <span>Safe Meta Ads Management Active</span>
                </div>
              )}

              <button
                onClick={() => setViewingAd(null)}
                className="px-5 py-2 bg-text-primary text-white font-bold text-xs rounded-xl hover:opacity-90 transition-opacity"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRMATION MODAL ────────────────────────────────────── */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full border border-border shadow-2xl p-6 flex flex-col gap-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-danger/10 text-danger flex items-center justify-center mx-auto">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-text-primary">Delete Ad Campaign?</h3>
              <p className="text-xs text-text-secondary mt-1">
                Are you sure you want to delete this campaign? This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 mt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-5 py-2.5 rounded-xl border border-border bg-white text-text-primary font-bold text-xs hover:bg-surface"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteAd(deleteConfirmId)}
                className="px-5 py-2.5 rounded-xl bg-danger text-white font-bold text-xs hover:bg-danger/90 shadow-sm"
              >
                Delete Campaign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EXPLICIT USER APPROVAL CONFIRMATION MODAL ────────────────────── */}
      {approvalModalRec && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-border shadow-2xl p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 font-bold">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-text-primary">Explicit User Approval Required</h3>
                  <p className="text-xs text-text-secondary font-medium">AI recommendations are never applied automatically.</p>
                </div>
              </div>
              <button onClick={() => setApprovalModalRec(null)} className="p-1 text-text-secondary hover:text-text-primary">
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-3 text-xs bg-surface p-4 rounded-2xl border border-border">
              <div>
                <span className="text-[10px] font-extrabold uppercase text-accent-purple tracking-wider">Recommendation Title</span>
                <h4 className="font-extrabold text-sm text-text-primary mt-0.5">{approvalModalRec.title}</h4>
              </div>

              <div>
                <span className="text-[10px] font-extrabold uppercase text-text-secondary tracking-wider">Rationale & Explanation</span>
                <p className="text-text-primary font-medium mt-0.5 leading-relaxed">{approvalModalRec.explanation}</p>
              </div>

              {approvalModalRec.suggested_action && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 font-bold">
                  ⚠️ Action to Execute: {approvalModalRec.suggested_action}
                </div>
              )}

              <p className="text-[11px] text-text-secondary font-medium italic">
                Note: Applying this recommendation updates local settings or prepares ad modifications. Paid campaign activation or budget increases will still require your manual Meta publishing action.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setApprovalModalRec(null)}
                disabled={applyingRec}
                className="px-5 py-2.5 rounded-xl border border-border bg-white text-text-primary font-bold text-xs hover:bg-surface disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleExecuteRecAction(approvalModalRec.id, 'apply')}
                disabled={applyingRec}
                className="px-6 py-2.5 rounded-xl bg-accent-purple text-white font-bold text-xs hover:bg-accent-purple/90 shadow-sm flex items-center gap-2 disabled:opacity-50"
              >
                {applyingRec ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                <span>Confirm & Apply Recommendation</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
