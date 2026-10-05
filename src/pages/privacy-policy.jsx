import React from "react";
import Link from "next/link";
import { 
  ShieldCheck, 
  Lock, 
  Database, 
  Share2, 
  FileText, 
  UserCheck, 
  Eye, 
  Server, 
  Globe, 
  Cookie, 
  Scale, 
  Baby, 
  RefreshCw, 
  Mail,
  ArrowLeft
} from "lucide-react";

export default function PrivacyPolicy() {
  const lastUpdatedDate = "September 29, 2026";

  const sections = [
    {
      id: "introduction",
      title: "1. Introduction",
      icon: ShieldCheck,
      content: (
        <>
          <p className="text-text-secondary leading-relaxed mb-3">
            Welcome to <strong>SocialMind AI</strong> (referred to as "we," "our," "us," or "the Application"). 
            We are committed to respecting your privacy and protecting your data when you use our AI-powered social media management application.
          </p>
          <p className="text-text-secondary leading-relaxed">
            This Privacy Policy explains how we collect, use, store, process, and protect your information when you interact with our platform, website, services, and Meta/Instagram integrations.
          </p>
        </>
      )
    },
    {
      id: "information-we-collect",
      title: "2. Information We Collect",
      icon: Database,
      content: (
        <>
          <p className="text-text-secondary leading-relaxed mb-3">
            We collect only the essential information required to provide our social media management and AI-assisted creation services:
          </p>
          <ul className="list-disc list-inside space-y-2 text-text-secondary pl-2 mb-3">
            <li><strong>Social Media & Account Identifiers:</strong> Connected Page IDs, Instagram Business Account IDs, and authorized access tokens required to communicate with social platforms.</li>
            <li><strong>User-Generated Content:</strong> Post text drafts, captions, scheduled publishing times, and image files uploaded by users for post creation and AI image analysis.</li>
            <li><strong>Interaction & Community Data:</strong> Incoming comments, direct messages (DMs), and metadata received via webhooks to enable community management features.</li>
            <li><strong>System & Logs:</strong> Technical log data generated during API requests, webhook deliveries, and background post scheduling execution.</li>
          </ul>
        </>
      )
    },
    {
      id: "how-we-use-information",
      title: "3. How We Use Information",
      icon: Eye,
      content: (
        <>
          <p className="text-text-secondary leading-relaxed mb-3">
            Your data is used solely to operate, maintain, and improve the features you explicitly request within the application. Specifically, we use collected information to:
          </p>
          <ul className="list-disc list-inside space-y-2 text-text-secondary pl-2">
            <li>Generate AI post captions and analyze image content using Google Gemini AI APIs.</li>
            <li>Schedule and execute automated post publishing to connected social media accounts.</li>
            <li>Process incoming community comments and direct messages to display in your unified inbox and generate suggested or automated responses.</li>
            <li>Maintain database records of created posts, publishing statuses, and operational logs.</li>
          </ul>
        </>
      )
    },
    {
      id: "meta-instagram-data",
      title: "4. Social Media and Meta/Instagram Data",
      icon: Share2,
      content: (
        <>
          <div className="p-4 rounded-xl bg-accent-blue/5 border border-accent-blue/20 mb-4">
            <p className="text-sm text-text-primary font-medium leading-relaxed">
              <strong>Strict Limited Use Guarantee:</strong> Meta and Instagram account data (including Page IDs, Instagram Business IDs, Graph API tokens, comments, and messages) is accessed and used <em>strictly for features explicitly requested and authorized by the user</em>.
            </p>
          </div>
          <ul className="list-disc list-inside space-y-2 text-text-secondary pl-2">
            <li>We use Meta Graph APIs to publish authorized posts, fetch comments, and dispatch approved community replies.</li>
            <li>We receive real-time webhook updates from Meta solely to maintain your live inbox and process user-enabled auto-replies.</li>
            <li>We do <strong>NOT</strong> sell, rent, trade, or transfer Meta user data to any third-party advertisers, data brokers, or external marketers.</li>
            <li>Meta access tokens are stored securely in backend server environment configurations and are never exposed publicly or sent to frontend clients.</li>
          </ul>
        </>
      )
    },
    {
      id: "user-uploaded-content",
      title: "5. User-Uploaded Content",
      icon: FileText,
      content: (
        <>
          <p className="text-text-secondary leading-relaxed mb-3">
            Images and media assets uploaded to the application are stored locally on secured application storage servers to facilitate post scheduling, Meta Graph API publishing, and optional AI vision analysis.
          </p>
          <p className="text-text-secondary leading-relaxed">
            Uploaded images are referenced by public or temporary asset URLs strictly necessary for Meta servers to download media during publication.
          </p>
        </>
      )
    },
    {
      id: "data-storage-and-security",
      title: "6. Data Storage and Security",
      icon: Lock,
      content: (
        <>
          <p className="text-text-secondary leading-relaxed mb-3">
            We implement industry-standard security measures to safeguard your information against unauthorized access, loss, or disclosure:
          </p>
          <ul className="list-disc list-inside space-y-2 text-text-secondary pl-2">
            <li>Backend database and environment files containing credentials are hosted on restricted local/server infrastructure.</li>
            <li>API communication between frontend, backend, and external endpoints (Meta, Gemini) occurs over encrypted HTTPS connections.</li>
            <li>Sensitive credentials, such as API secret keys and long-lived access tokens, are isolated on the server side and never written to client-side storage.</li>
          </ul>
        </>
      )
    },
    {
      id: "data-retention-and-deletion",
      title: "7. Data Retention and Deletion",
      icon: Server,
      content: (
        <>
          <p className="text-text-secondary leading-relaxed mb-3">
            We retain post records, conversation logs, and community settings only for as long as necessary to provide application services or fulfill functional requirements.
          </p>
          <p className="text-text-secondary leading-relaxed">
            Users may request complete deletion of their stored posts, database records, media uploads, or token configurations at any time. Upon receiving a valid request or account disconnect, associated data is permanently purged from our application storage.
          </p>
        </>
      )
    },
    {
      id: "third-party-services",
      title: "8. Third-Party Services",
      icon: Globe,
      content: (
        <>
          <p className="text-text-secondary leading-relaxed mb-3">
            To deliver full AI and social media capabilities, our application integrates with select third-party service providers:
          </p>
          <ul className="list-disc list-inside space-y-2 text-text-secondary pl-2">
            <li><strong>Meta Graph API (Facebook & Instagram):</strong> For social publishing, fetching messages/comments, and webhook event delivery.</li>
            <li><strong>Google Gemini AI API:</strong> For intelligent text content generation, post caption drafting, and optional image analysis.</li>
          </ul>
          <p className="text-text-secondary leading-relaxed mt-3">
            These third-party providers process data in accordance with their respective privacy policies and security standards.
          </p>
        </>
      )
    },
    {
      id: "cookies-and-similar-technologies",
      title: "9. Cookies and Similar Technologies",
      icon: Cookie,
      content: (
        <>
          <p className="text-text-secondary leading-relaxed">
            The application uses browser local storage and essential session tokens solely for maintaining user interface preferences, local active states, and navigation context. We do not use persistent cross-site tracking cookies or third-party advertising tracking scripts.
          </p>
        </>
      )
    },
    {
      id: "user-rights",
      title: "10. User Rights",
      icon: Scale,
      content: (
        <>
          <p className="text-text-secondary leading-relaxed mb-3">
            Depending on your jurisdiction, you have fundamental rights regarding your data:
          </p>
          <ul className="list-disc list-inside space-y-2 text-text-secondary pl-2">
            <li><strong>Right to Access:</strong> View all stored posts, scheduled items, and community settings inside the application dashboard.</li>
            <li><strong>Right to Rectification:</strong> Edit or update any scheduled content, draft captions, or auto-reply settings.</li>
            <li><strong>Right to Erasure:</strong> Request immediate removal of your account configuration and database records.</li>
            <li><strong>Right to Revoke Permissions:</strong> Disconnect your Meta/Instagram accounts or invalidate API access tokens at any time.</li>
          </ul>
        </>
      )
    },
    {
      id: "childrens-privacy",
      title: "11. Children's Privacy",
      icon: Baby,
      content: (
        <>
          <p className="text-text-secondary leading-relaxed">
            Our application is intended for professional and business social media management. We do not knowingly collect or solicit personal information from individuals under the age of 13. If you believe a minor has provided data to us, please contact us immediately so we can remove the information.
          </p>
        </>
      )
    },
    {
      id: "changes-to-privacy-policy",
      title: "12. Changes to This Privacy Policy",
      icon: RefreshCw,
      content: (
        <>
          <p className="text-text-secondary leading-relaxed">
            We may update this Privacy Policy periodically to reflect enhancements to our application features, legal requirements, or API guidelines. Any modifications will be published directly on this page with an updated "Last Updated" date at the top of the document.
          </p>
        </>
      )
    },
    {
      id: "contact-information",
      title: "13. Contact Information",
      icon: Mail,
      content: (
        <>
          <p className="text-text-secondary leading-relaxed mb-3">
            If you have any questions, concerns, or requests regarding this Privacy Policy or your data, you can reach out via the application settings page or contact our system administrator:
          </p>
          <div className="p-4 rounded-xl bg-surface border border-border">
            <p className="text-sm font-semibold text-text-primary">SocialMind AI Administrator</p>
            <p className="text-xs text-text-secondary mt-1">Application Support & Privacy Team</p>
            <p className="text-xs text-text-secondary mt-0.5">Route: /settings</p>
          </div>
        </>
      )
    }
  ];

  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col gap-3 mt-2">
        <div className="flex items-center gap-2">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-accent-purple transition-colors">
            <ArrowLeft size={14} />
            Back to Dashboard
          </Link>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 lg:p-8 rounded-2xl border border-border shadow-sm">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 rounded-xl bg-accent-purple/10 text-accent-purple">
                <ShieldCheck size={28} />
              </div>
              <h1 className="text-2xl lg:text-3xl font-bold text-text-primary tracking-tight">
                Privacy Policy
              </h1>
            </div>
            <p className="text-sm text-text-secondary max-w-2xl">
              This document outlines how SocialMind AI handles your social media data, user uploads, AI interactions, and Meta Graph API integrations safely and transparently.
            </p>
          </div>

          <div className="flex flex-col items-start md:items-end shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-border">
            <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
              Last Updated
            </span>
            <span className="text-sm font-semibold text-text-primary mt-0.5">
              {lastUpdatedDate}
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Navigation Sidebar for Large Screens */}
        <div className="hidden lg:block lg:col-span-1">
          <div className="sticky top-24 p-4 rounded-xl bg-white border border-border shadow-sm flex flex-col gap-1">
            <span className="text-xs font-bold text-text-secondary uppercase tracking-wider px-3 py-2">
              Table of Contents
            </span>
            {sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="text-xs font-medium text-text-secondary hover:text-accent-purple hover:bg-surface px-3 py-2 rounded-lg transition-colors truncate"
              >
                {section.title}
              </a>
            ))}
          </div>
        </div>

        {/* Policy Sections */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <section
                key={section.id}
                id={section.id}
                className="p-6 lg:p-7 rounded-2xl bg-white border border-border shadow-sm scroll-mt-24 transition-all hover:border-accent-purple/30"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-surface text-accent-purple border border-border">
                    <Icon size={20} />
                  </div>
                  <h2 className="text-lg font-bold text-text-primary">
                    {section.title}
                  </h2>
                </div>
                <div className="text-sm text-text-primary">
                  {section.content}
                </div>
              </section>
            );
          })}

          {/* Footer Note */}
          <div className="p-6 rounded-2xl bg-primary-navy text-white flex flex-col sm:flex-row items-center justify-between gap-4 mt-4">
            <div>
              <p className="text-sm font-bold">SocialMind AI — Privacy & Security</p>
              <p className="text-xs text-white/60 mt-1">
                Transparency and control over your social media management data.
              </p>
            </div>
            <Link
              href="/"
              className="px-4 py-2 rounded-lg bg-accent-purple hover:bg-accent-purple/90 text-white text-xs font-semibold transition-colors shrink-0"
            >
              Return to Application
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
