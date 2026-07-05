"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, Dispatch, SetStateAction, useEffect, useCallback, useMemo } from "react";
import { createClient } from "../../../utils/supabase/client";
import { uploadToCloudinary } from "../../utils/cloudinary";
import { Blog, BlogContent } from "../../components/BlogContent";
import FinderBJobsContent, { FinderBJob } from "../../components/FinderBJobsContent";
import PaymentsContent from "../../components/PaymentsContent";
import DashboardContent from "../../components/DashboardContent";
import MerchantDetailModal from "../../components/MerchantDetailModal";
import SettingsContent, { Settings } from "../../components/SettingsContent";
import { planLabel } from "../../lib/merchantPlanAdmin";
import { classifyStoredPassword, formatRevealedPassword } from "../../lib/passwordDisplay";
import type { MerchantRequest } from "../../lib/merchantRequest";
import { getBusinessProfileUrl } from "../../lib/site";
import {
  CATEGORY_LEAD_BADGE,
  PROFILE_LEAD_BADGE,
  isCategoryLeadSource,
  isLegacyLeadSource,
  isProfileLeadSource,
  leadBadgeClassName,
} from "../../lib/leadBadges";
import { formatActivityDate, formatActivityTime, parseFinderbTimestamp } from "../../lib/formatDateTime";
import { mergePaymentHistory } from "../../lib/paymentUtils";
import { computeDashboardStats } from "../../lib/dashboardStats";

interface User {
  id: string;
  fullName: string;
  email: string;
  createdAt: string;
  password?: string | null;
}

interface Merchant {
  id: string;
  name: string;
  email: string;
  category: string;
  rating: number;
  sales: number;
  validUntil: string;
  status: string;
  isFinderBVerified: boolean;
  registrationNumber: string | null;
  paymentStatus: string;
  selectedPlan: string;
  billingCycle: string;
  planExpiresAt: string | null;
  slug: string | null;
  city: string | null;
}

interface AdminSession {
  id: string;
  email: string;
  role: string;
  allowed_tabs?: string[];
}

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  category: string;
  business_id: string | null;
  message: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  merchant_name?: string | null;
}

interface BusinessData {
  id: string;
  fullName: string;
  workEmail: string;
  mobile: string;
  businessName: string;
  category: string;
  location: string | null;
  publicPhone: string;
  businessAddress: string;
  selectedPlan: string;
  billingCycle: string;
  isVerified: boolean;
  registrationNumber: string | null;
  panNumber: string | null;
  aadharNumber: string | null;
  panUrl: string | null;
  aadharUrl: string | null;
  msmeGstUrl: string | null;
  cinNumber: string | null;
  bankIfsc: string | null;
  bankAccountNumber: string | null;
  upiId: string | null;
  razorpayContactId: string | null;
  razorpayFundAccountId: string | null;
  bankName: string | null;
  kycStatus: string;
  hasVerifiedBadge: boolean;
  paymentStatus: string;
  paymentId: string | null;
  orderId: string | null;
  planStartedAt: string | null;
  planExpiresAt: string | null;
  razorpaySubscriptionId: string | null;
  subscriptionStatus: string | null;
  subscriptionCancelledAt: string | null;
  autoRenewEnabled: boolean;
  mandateStatus: string | null;
  createdAt: string;
  updatedAt: string;
  city: string | null;
  slug: string | null;
  email: string | null;
  password: string | null;
  state: string | null;
  country: string | null;
  status: string;
  images: string[] | null;
  profilePictureUrl: string | null;
  isFinderBVerified: boolean;
  about: string | null;
  discountRange: string | null;
  displayName: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  keywords: string[] | null;
  latitude: number | null;
  longitude: number | null;
  paymentModes: string[] | null;
  profileQrLink: string | null;
  rating: number | null;
  serviceCategory: string | null;
  timings: unknown;
  website: string | null;
  whatsappNumber: string | null;
  yearsInBusiness: number | null;
  youtubeUrl: string | null;
  review: unknown;
  reviewReply: unknown;
}

interface Category {
  id: string;
  name: string;
  items: number;
  status: string;
  banner: string;
  symbol: string;
  parent_id?: string | null;
  fixedSlots: number;
  type: 'Merchant' | 'Service';
  position_1_business_id?: string | null;
  position_2_business_id?: string | null;
  position_3_business_id?: string | null;
  position_4_business_id?: string | null;
  position_5_business_id?: string | null;
  position?: number;
}


interface Movie {
  id: string;
  name: string;
  description: string;
  finderb_rating: number;
  release_date: string;
  poster_url: string;
  created_at?: string;
}

interface TouristPlace {
  id: string;
  name: string;
  description: string;
  location: string;
  category: string;
  image_url: string;
  created_at?: string;
  updated_at?: string;
}

interface News {
  id: string;
  title: string;
  content: string;
  author: string | null;
  image_url: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

interface AdminProfile {
  id: string;
  email: string;
  password?: string;
  role: string;
  is_disabled: boolean;
  allowed_tabs: string[] | null;
  created_at: string;
}

interface Broadcast {
  id: string;
  title: string;
  message: string;
  target_audience: string[];
  created_at: string;
}

interface Activity {
  id: string;
  type: 'user' | 'merchant' | 'lead';
  title: string;
  description: string;
  timestamp: string;
}

export interface LoginLog {
  id: string;
  admin_id: string;
  admin_email: string;
  login_time: string;
}

const DISABLED_TABS = new Set(["News"]);

const ALL_MENU_ITEMS = [
  {
    name: "Dashboard", icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    )
  },
  {
    name: "Users", icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    )
  },
  {
    name: "Merchants", icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    )
  },
  {
    name: "Leads", icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
      </svg>
    )
  },
  {
    name: "Categories", icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    )
  },
  {
    name: "Movies", icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
      </svg>
    )
  },
  {
    name: "Tourist Places", icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )
  },
  {
    name: "Payments & Subscriptions", icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    )
  },
  {
    name: "Broadcasts", icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
      </svg>
    )
  },
  {
    name: "News", icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 12a2 2 0 002-2V9a2 2 0 00-2-2h-2.5" />
      </svg>
    )
  },
  {
    name: "Blogs", icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    )
  },
  {
    name: "FinderB Jobs", icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 13h8M8 17h5" />
      </svg>
    )
  },
  {
    name: "Settings", icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.543-.426-1.543-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )
  },
  {
    name: "Manage Admins", icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    )
  }
];

const NAV_GROUPS = [
  { label: "Overview", items: ["Dashboard"] },
  { label: "Operations", items: ["Users", "Merchants", "Leads"] },
  { label: "Content & Media", items: ["Categories", "Movies", "Tourist Places", "Blogs", "FinderB Jobs"] },
  { label: "Platform", items: ["Payments & Subscriptions", "Broadcasts", "Settings", "Manage Admins"] },
  { label: "Unavailable", items: ["News"] },
];

export default function Dashboard() {
  const router = useRouter();
  const [adminSession, setAdminSession] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [platformTimeLabel, setPlatformTimeLabel] = useState("");
  const [platformDateLabel, setPlatformDateLabel] = useState("");

  useEffect(() => {
    const formatClock = () => {
      const now = new Date();
      setPlatformTimeLabel(
        now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true }),
      );
      setPlatformDateLabel(
        now.toLocaleDateString("en-GB", { weekday: "short", month: "short", day: "numeric", year: "numeric" }),
      );
    };
    formatClock();
    const timer = setInterval(formatClock, 60_000);
    return () => clearInterval(timer);
  }, []);

  // --- Global State for Functionalities ---
  const [settings, setSettings] = useState<Settings>({
    maintenance: false,
    imageCompression: false,
  });

  const [users, setUsers] = useState<User[]>([]);
  const [activeMerchants, setActiveMerchants] = useState<Merchant[]>([]);
  const [merchantRequests, setMerchantRequests] = useState<MerchantRequest[]>([]);
  const [allBusinessData, setAllBusinessData] = useState<BusinessData[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [touristPlaces, setTouristPlaces] = useState<TouristPlace[]>([]);
  const [news, setNews] = useState<News[]>([]);
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [finderBJobs, setFinderBJobs] = useState<FinderBJob[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [admins, setAdmins] = useState<AdminProfile[]>([]);
  const [loginLogs, setLoginLogs] = useState<LoginLog[]>([]);
  const [merchantPaymentRows, setMerchantPaymentRows] = useState<Record<string, unknown>[]>([]);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (DISABLED_TABS.has(activeTab)) {
      setActiveTab("Dashboard");
    }
  }, [activeTab]);

  useEffect(() => {
    const validateSession = async () => {
      const sessionStr = localStorage.getItem("admin_session");
      if (!sessionStr) {
        router.push("/");
        return;
      }

      const session = JSON.parse(sessionStr);
      const supabase = createClient();
      
      const { data, error } = await supabase
        .from('admins')
        .select('*')
        .eq('id', session.id)
        .single();

      if (error || !data || data.is_disabled) {
        localStorage.removeItem("admin_session");
        router.push("/");
        return;
      }

      // Update session if role or allowed_tabs changed
      if (data.role !== session.role || JSON.stringify(data.allowed_tabs) !== JSON.stringify(session.allowed_tabs)) {
        const updatedSession = {
          ...session,
          role: data.role,
          allowed_tabs: data.allowed_tabs
        };
        localStorage.setItem("admin_session", JSON.stringify(updatedSession));
        setAdminSession(updatedSession);
      } else {
        setAdminSession(session);
      }
    };

    validateSession();
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("admin_session");
    setAdminSession(null);
    router.push("/");
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setDataLoading(true);
        setFetchError(null);

        const supabase = createClient();

        console.log("🚀 Fetching categories from Supabase...");
        const { data: catData, error: catError } = await supabase
          .from('categories')
          .select('*')
          .order('position', { ascending: true });

        if (catError) {
          console.error("❌ Category fetch error:", catError);
          const missingTable = catError.message?.toLowerCase().includes("public.categories") || catError.message?.toLowerCase().includes("relation \"categories\" does not exist") || catError.code === "42P01";
          setCategoryError(missingTable
            ? "Categories table is missing. Create it with db/create_categories_table.sql or via the Supabase SQL editor."
            : catError.message
          );
        } else {
          setCategoryError(null);
          console.log("✅ Categories fetched:", catData?.length || 0);
        }

        if (catData) {
          setCategories(catData.map(c => ({
            id: c.id,
            name: c.name,
            items: c.items_count || 0,
            status: c.status || 'Active',
            banner: c.banner || 'Not Set',
            symbol: c.symbol || 'Not Set',
            parent_id: c.parent_id,
            fixedSlots: c.fixed_slots || 0,
            type: c.type || 'Merchant',
            position_1_business_id: c.position_1_business_id,
            position_2_business_id: c.position_2_business_id,
            position_3_business_id: c.position_3_business_id,
            position_4_business_id: c.position_4_business_id,
            position_5_business_id: c.position_5_business_id,
            position: c.position || 0
          })));
        }

        console.log("🚀 Fetching movies from Supabase...");
        const { data: movieData, error: movieError } = await supabase.from('movies').select('*').order('created_at', { ascending: false });

        if (movieError) {
          console.error("❌ Movie fetch error:", movieError);
        } else {
          console.log("✅ Movies fetched:", movieData?.length || 0);
          if (movieData) setMovies(movieData);
        }

        console.log("🚀 Fetching tourist places from Supabase...");
        const { data: tpData, error: tpError } = await supabase.from('tourist_places').select('*').order('created_at', { ascending: false });

        if (tpError) {
          console.error("❌ Tourist places fetch error:", tpError);
        } else {
          console.log("✅ Tourist places fetched:", tpData?.length || 0);
          if (tpData) setTouristPlaces(tpData);
        }

        console.log("🚀 Fetching news from Supabase...");
        const { data: newsData, error: newsError } = await supabase.from('news').select('*').order('created_at', { ascending: false });
        const { data: blogData, error: blogError } = await supabase.from('blogs').select('*').order('created_at', { ascending: false });

        if (newsError) {
          console.error("❌ News fetch error:", newsError);
        } else {
          console.log("✅ News fetched:", newsData?.length || 0);
          if (newsData) setNews(newsData);
        }

        if (blogError) {
          console.error("❌ Blogs fetch error:", blogError);
        } else {
          console.log("✅ Blogs fetched:", blogData?.length || 0);
          if (blogData) setBlogs(blogData);
        }

        console.log("🚀 Fetching finderb jobs from Supabase...");
        const { data: jobData, error: jobError } = await supabase
          .from('jobs')
          .select(`
            id,
            title,
            type,
            location,
            salary,
            description,
            department,
            status,
            business_id,
            created_at,
            updated_at,
            approval_status,
            approved_at,
            approved_by,
            rejection_reason,
            reviewed_at,
            reviewed_by,
            Business:business_id (
              businessName
            )
          `)
          .order('created_at', { ascending: false });

        if (jobError) {
          console.error("❌ FinderB jobs fetch error:", jobError);
        } else {
          console.log("✅ FinderB jobs fetched:", jobData?.length || 0);
          if (jobData) {
            setFinderBJobs(jobData.map((job: any) => ({
              ...job,
              business_name: job.Business?.businessName || null,
            })));
          }
        }

        console.log("🚀 Fetching leads from Supabase...");
        const { data: leadData, error: leadError } = await supabase
          .from('leads')
          .select(`
            *,
            Business:business_id (
              id,
              businessName,
              category,
              city,
              location
            )
          `)
          .order('created_at', { ascending: false });

        if (leadError) {
          console.error("❌ Lead fetch error:", leadError);
        } else {
          console.log("✅ Leads fetched:", leadData?.length || 0);
          if (leadData) {
            setLeads(
              leadData.map((row: any) => ({
                ...row,
                merchant_name: row.Business?.businessName ?? null,
              }))
            );
          }
        }

        console.log("🚀 Fetching login logs from Supabase...");
        const { data: logData, error: logError } = await supabase
          .from('admin_login_logs')
          .select('*')
          .order('login_time', { ascending: false })
          .limit(50);

        if (logError) {
          console.error("❌ Login logs fetch error:", logError);
        } else {
          console.log("✅ Login logs fetched:", logData?.length || 0);
          if (logData) setLoginLogs(logData);
        }

        console.log("🚀 Fetching users from Supabase...");
        const { data: userData, error: userError } = await supabase.from('User').select('*').order('createdAt', { ascending: false });
        if (userError) {
          console.error("❌ User fetch error:", userError);
        } else {
          console.log("✅ Users fetched:", userData?.length || 0);
          if (userData) setUsers(userData);
        }

        console.log("🚀 Fetching business data from Supabase...");
        const { data: merchantData, error: merchantError } = await supabase.from('Business').select('*');

        if (merchantError) {
          console.error("❌ Business fetch error:", merchantError);
          setFetchError(`Failed to fetch business data: ${merchantError.message}`);
        } else {
          console.log("✅ Business data fetched:", merchantData?.length || 0);
          if (merchantData && merchantData.length > 0) {
            setAllBusinessData(merchantData);
            setActiveMerchants(merchantData
              .filter((m: any) => m.kycStatus !== 'pending' && m.kycStatus !== 'rejected')
              .map((m: any) => ({
                id: m.id,
                name: m.businessName || m.fullName || 'Unknown Merchant',
                email: m.workEmail || m.email || '',
                category: m.category || 'Other',
                rating: 0,
                sales: 0,
                validUntil: m.planExpiresAt
                  ? new Date(m.planExpiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                  : '—',
                status: m.status || 'Active',
                isFinderBVerified: Boolean(m.isFinderBVerified),
                registrationNumber: m.registrationNumber || null,
                paymentStatus: m.paymentStatus || 'pending',
                selectedPlan: m.selectedPlan || 'free',
                billingCycle: m.billingCycle || 'monthly',
                planExpiresAt: m.planExpiresAt || null,
                slug: m.slug || null,
                city: m.city || null,
              })));
            setMerchantRequests(merchantData
              .filter((m: any) => m.kycStatus === 'pending')
              .map((m: any) => ({
                id: m.id,
                name: m.businessName || m.fullName || 'Unknown Merchant',
                email: m.workEmail || m.email || '',
                category: m.category || 'Other',
                date: new Date(m.createdAt || Date.now()).toLocaleDateString(),
                registrationNumber: m.registrationNumber || null,
              })));
          } else {
            console.warn("⚠️ No business data returned from Supabase");
          }
        }

        console.log("🚀 Fetching merchant payments from Supabase...");
        const { data: paymentData, error: paymentError } = await supabase
          .from("merchant_payments")
          .select("*")
          .order("created_at", { ascending: false });

        if (paymentError) {
          console.error("❌ Merchant payments fetch error:", paymentError);
        } else {
          setMerchantPaymentRows(paymentData ?? []);
        }
      } catch (error: any) {
        console.error("❌ Unexpected error during fetch:", error);
        setFetchError(`Unexpected error: ${error?.message || 'Unknown error'}`);
      } finally {
        setDataLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    const fetchAdmins = async () => {
      if (activeTab === "Manage Admins") {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('admins')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error("Error fetching admins:", error);
        } else {
          setAdmins(data || []);
        }
      }
    };

    const fetchUsers = async () => {
      if (activeTab === "Users") {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('User')
          .select('*')
          .order('createdAt', { ascending: false });

        if (error) {
          console.error("Error fetching users:", error);
        } else {
          setUsers(data || []);
        }
      }
    };

    const fetchLoginLogs = async () => {
      if (activeTab === "Settings") {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('admin_login_logs')
          .select('*')
          .order('login_time', { ascending: false })
          .limit(100);

        if (error) {
          console.error("Error fetching login logs:", error);
        } else {
          setLoginLogs(data || []);
        }
      }
    };

    fetchAdmins();
    fetchUsers();
    fetchLoginLogs();
  }, [activeTab]);

  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastAudiences, setBroadcastAudiences] = useState<string[]>(["Users", "Merchants"]);

  const menuItems = ALL_MENU_ITEMS.filter(item => {
    if (adminSession?.role === 'controller') {
      return true;
    }
    if (item.name === 'Manage Admins') {
      return false;
    }
    if (adminSession?.allowed_tabs && adminSession.allowed_tabs.length > 0) {
      return adminSession.allowed_tabs.includes(item.name);
    }
    return false; 
  });

  const handleDashboardApprove = async (req: MerchantRequest) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('Business')
      .update({
        kycStatus: 'approved',
        isVerified: true
      })
      .eq('id', req.id);

    if (error) {
      alert("Error approving merchant: " + error.message);
      return;
    }

    setActiveMerchants((prev: Merchant[]) => [
      ...prev,
      {
        id: req.id,
        name: req.name,
        email: req.email,
        category: req.category,
        rating: 0,
        sales: 0,
        validUntil: "—",
        status: "Active",
        isFinderBVerified: false,
        registrationNumber: req.registrationNumber || null,
        paymentStatus: "pending",
        selectedPlan: "free",
        billingCycle: "monthly",
        planExpiresAt: null,
        slug: null,
        city: null,
      }
    ]);
    setMerchantRequests((prev: MerchantRequest[]) => prev.filter(r => r.id !== req.id));
    alert(`${req.name} has been approved and added to active merchants!`);
  };

  const handleDashboardReject = async (req: MerchantRequest) => {
    if (confirm(`Are you sure you want to reject ${req.name}?`)) {
      const supabase = createClient();
      const { error } = await supabase
        .from('Business')
        .update({ kycStatus: 'rejected', isVerified: false })
        .eq('id', req.id);

      if (error) {
        alert("Error rejecting merchant: " + error.message);
        return;
      }
      setMerchantRequests((prev: MerchantRequest[]) => prev.filter(r => r.id !== req.id));
      alert(`${req.name} request has been rejected.`);
    }
  };

  const chartData = useMemo(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const now = new Date();
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(now.getDate() - (6 - i));
      return {
        label: days[d.getDay()],
        date: d.toDateString(),
        users: 0,
        merchants: 0
      };
    });

    users.forEach(u => {
      if (!u.createdAt) return;
      const d = new Date(u.createdAt).toDateString();
      const day = last7Days.find(ld => ld.date === d);
      if (day) day.users++;
    });

    allBusinessData.forEach(m => {
      if (!m.createdAt) return;
      const d = new Date(m.createdAt).toDateString();
      const day = last7Days.find(ld => ld.date === d);
      if (day) day.merchants++;
    });

    return last7Days;
  }, [users, allBusinessData]);

  const recentActivities = useMemo(() => {
    const activities: Activity[] = [];
    
    users.forEach(u => {
      activities.push({
        id: u.id,
        type: 'user',
        title: `New User Joined`,
        description: `${u.fullName} (${u.email})`,
        timestamp: u.createdAt
      });
    });

    allBusinessData.forEach(m => {
      activities.push({
        id: m.id,
        type: 'merchant',
        title: `New Merchant Registration`,
        description: `${m.businessName} - ${m.kycStatus}`,
        timestamp: m.createdAt
      });
    });

    leads.forEach(l => {
      const source =
        isProfileLeadSource(l.status)
          ? 'profile'
          : isCategoryLeadSource(l.status)
            ? 'category circulation'
            : l.status;
      activities.push({
        id: l.id,
        type: 'lead',
        title: `New Lead — ${source}`,
        description: `${l.name} · ${l.category}${l.merchant_name ? ` → ${l.merchant_name}` : ''}`,
        timestamp: l.created_at
      });
    });

    return activities
      .sort((a, b) => {
        const aTime = parseFinderbTimestamp(a.timestamp)?.getTime() ?? 0;
        const bTime = parseFinderbTimestamp(b.timestamp)?.getTime() ?? 0;
        return bTime - aTime;
      })
      .slice(0, 10);
  }, [users, allBusinessData, leads]);

  const dashboardStats = useMemo(
    () =>
      computeDashboardStats({
        users,
        activeMerchants,
        merchantRequests,
        leads,
        allBusinessData,
        merchantPaymentRows: merchantPaymentRows as Parameters<typeof mergePaymentHistory>[0],
        categoriesCount: categories.length,
        blogsCount: blogs.length,
        jobsCount: finderBJobs.length,
      }),
    [users, activeMerchants, merchantRequests, leads, allBusinessData, merchantPaymentRows, categories, blogs, finderBJobs],
  );

  const handleUpdateCategory = async (catName: string, updates: Partial<Category>) => {
    const supabase = createClient();

    // Defensive payload - only send columns that exist
    const safeUpdate: any = {
      banner: updates.banner,
      parent_id: updates.parent_id,
      position_1_business_id: updates.position_1_business_id,
      position_2_business_id: updates.position_2_business_id,
      position_3_business_id: updates.position_3_business_id,
      position_4_business_id: updates.position_4_business_id,
      position_5_business_id: updates.position_5_business_id,
      status: updates.status,
      type: updates.type,
      fixed_slots: updates.fixedSlots,
      position: updates.position,
    };

    // Only include symbol if it exists in update
    if ('symbol' in updates && updates.symbol !== undefined) {
      safeUpdate.symbol = updates.symbol;
    }

    const { error } = await supabase
      .from('categories')
      .update(safeUpdate)
      .eq('id', updates.id);

    if (error) {
      // Schema cache error detection
      const isSchemaError = error.message.includes("symbol") ||
        error.message.includes("column") ||
        error.code === "42703";

      if (isSchemaError) {
        alert(`Schema Error: ${error.message}\n\n🔧 Fix: Run "db/update_categories_schema.sql" in Supabase SQL Editor\n   → Forces cache refresh + verifies column exists`);
      } else {
        alert(`Update failed: ${error.message}`);
      }
      return;
    }

    setCategories(prev => {
      const updated = prev.map(c => c.id === updates.id ? { ...c, ...updates } : c);
      return [...updated].sort((a, b) => (a.position || 0) - (b.position || 0));
    });
    alert(`✅ Category "${catName}" updated successfully!`);
  };

  const handleCreateCategory = async (category: Partial<Category>) => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('categories')
      .insert([{
        name: category.name,
        type: category.type || 'Merchant',
        status: category.status || 'Active',
        banner: category.banner || 'Not Set',
        symbol: category.symbol || 'Not Set',
        parent_id: category.parent_id || null,
        fixed_slots: category.fixedSlots || 0,
        position: category.position || 0,
      }])
      .select();

    if (error) {
      alert("Error creating category: " + error.message);
      return;
    }

    if (data) {
      const newCat = data[0];
      setCategories(prev => {
        const updated = [...prev, {
          id: newCat.id,
          name: newCat.name,
          items: newCat.items_count || 0,
          status: newCat.status || 'Active',
          banner: newCat.banner || 'Not Set',
          symbol: newCat.symbol || 'Not Set',
          parent_id: newCat.parent_id,
          fixedSlots: newCat.fixed_slots || 0,
          type: newCat.type || 'Merchant',
          position: newCat.position || 0,
        }];
        return updated.sort((a, b) => (a.position || 0) - (b.position || 0));
      });
      alert(`Category ${category.name} created successfully!`);
    }
  };
  
  const handleCreateMovie = async (movie: Partial<Movie>) => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('movies')
      .insert([{
        name: movie.name,
        description: movie.description,
        finderb_rating: movie.finderb_rating,
        release_date: movie.release_date,
        poster_url: movie.poster_url,
      }])
      .select();

    if (error) {
      alert("Error creating movie: " + error.message);
      return;
    }

    if (data) {
      setMovies(prev => [data[0], ...prev]);
      alert(`Movie ${movie.name} added successfully!`);
    }
  };

  const handleUpdateMovie = async (movie: Partial<Movie>) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('movies')
      .update({
        name: movie.name,
        description: movie.description,
        finderb_rating: movie.finderb_rating,
        release_date: movie.release_date,
        poster_url: movie.poster_url,
        updated_at: new Date().toISOString(),
      })
      .eq('id', movie.id);

    if (error) {
      alert("Error updating movie: " + error.message);
      return;
    }

    setMovies(prev => prev.map(m => m.id === movie.id ? { ...m, ...movie } : m));
    alert(`Movie updated successfully!`);
  };

  const handleDeleteMovie = async (id: string) => {
    if (confirm("Are you sure you want to remove this movie?")) {
      const supabase = createClient();
      const { error } = await supabase
        .from('movies')
        .delete()
        .eq('id', id);

      if (error) {
        alert("Error deleting movie: " + error.message);
        return;
      }

      setMovies(prev => prev.filter(m => m.id !== id));
      alert("Movie removed successfully!");
    }
  };

  const handleCreateTouristPlace = async (tp: Partial<TouristPlace>) => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('tourist_places')
      .insert([{
        name: tp.name,
        description: tp.description,
        location: tp.location,
        category: tp.category,
        image_url: tp.image_url,
      }])
      .select();

    if (error) {
      alert("Error creating tourist place: " + error.message);
      return;
    }

    if (data) {
      setTouristPlaces(prev => [data[0], ...prev]);
      alert(`Tourist place ${tp.name} added successfully!`);
    }
  };

  const handleUpdateTouristPlace = async (tp: Partial<TouristPlace>) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('tourist_places')
      .update({
        name: tp.name,
        description: tp.description,
        location: tp.location,
        category: tp.category,
        image_url: tp.image_url,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tp.id);

    if (error) {
      alert("Error updating tourist place: " + error.message);
      return;
    }

    setTouristPlaces(prev => prev.map(p => p.id === tp.id ? { ...p, ...tp } : p));
    alert(`Tourist place updated successfully!`);
  };

  const handleDeleteTouristPlace = async (id: string) => {
    if (confirm("Are you sure you want to remove this tourist place?")) {
      const supabase = createClient();
      const { error } = await supabase
        .from('tourist_places')
        .delete()
        .eq('id', id);

      if (error) {
        alert("Error deleting tourist place: " + error.message);
        return;
      }

      setTouristPlaces(prev => prev.filter(p => p.id !== id));
      alert("Tourist place removed successfully!");
    }
  };

  const handleCreateNews = async (item: Partial<News>) => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('news')
      .insert([{
        title: item.title,
        content: item.content,
        author: item.author,
        image_url: item.image_url,
        published_at: item.published_at || new Date().toISOString(),
      }])
      .select();

    if (error) {
      alert("Error creating news: " + error.message);
      return;
    }

    if (data) {
      setNews(prev => [data[0], ...prev]);
      alert(`News "${item.title}" added successfully!`);
    }
  };

  const handleUpdateNews = async (item: Partial<News>) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('news')
      .update({
        title: item.title,
        content: item.content,
        author: item.author,
        image_url: item.image_url,
        published_at: item.published_at,
        updated_at: new Date().toISOString(),
      })
      .eq('id', item.id);

    if (error) {
      alert("Error updating news: " + error.message);
      return;
    }

    setNews(prev => prev.map(n => n.id === item.id ? { ...n, ...item } as News : n));
    alert(`News updated successfully!`);
  };

  const handleDeleteNews = async (id: string) => {
    if (confirm("Are you sure you want to delete this news item?")) {
      const supabase = createClient();
      const { error } = await supabase
        .from('news')
        .delete()
        .eq('id', id);

      if (error) {
        alert("Error deleting news: " + error.message);
        return;
      }

      setNews(prev => prev.filter(n => n.id !== id));
      alert("News item deleted successfully!");
    }
  };

  const handleCreateBlog = async (item: Partial<Blog>) => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('blogs')
      .insert([{
        title: item.title,
        slug: item.slug,
        content: item.content,
        excerpt: item.excerpt,
        author: item.author,
        category: item.category,
        tags: item.tags,
        image_url: item.image_url,
        status: item.status,
        published_at: item.status === 'published' ? new Date().toISOString() : null,
      }])
      .select();

    if (error) {
      alert("Error creating blog: " + error.message);
      return;
    }

    if (data) {
      setBlogs(prev => [data[0], ...prev]);
      alert(`Article "${item.title}" published successfully!`);
    }
  };

  const handleUpdateBlog = async (item: Partial<Blog>) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('blogs')
      .update({
        title: item.title,
        slug: item.slug,
        content: item.content,
        excerpt: item.excerpt,
        author: item.author,
        category: item.category,
        tags: item.tags,
        image_url: item.image_url,
        status: item.status,
        published_at: item.status === 'published' && !item.published_at ? new Date().toISOString() : item.published_at,
        updated_at: new Date().toISOString(),
      })
      .eq('id', item.id);

    if (error) {
      alert("Error updating blog: " + error.message);
      return;
    }

    setBlogs(prev => prev.map(b => b.id === item.id ? { ...b, ...item } as Blog : b));
    alert(`Article updated successfully!`);
  };

  const handleDeleteBlog = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('blogs')
      .delete()
      .eq('id', id);

    if (error) {
      alert("Error deleting blog: " + error.message);
      return;
    }

    setBlogs(prev => prev.filter(b => b.id !== id));
    alert("Article deleted successfully!");
  };

  const handleBlogImageUpload = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      uploadToCloudinary(file, (progress) => {
        console.log(`Upload progress: ${progress}%`);
      }).then(resolve).catch(reject);
    });
  };

  const renderContent = () => {
    if (adminSession?.role !== 'controller' && menuItems.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8 admin-card">
          <div className="w-16 h-16 bg-rose-50 rounded-xl flex items-center justify-center text-rose-500 mb-6">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m0-6V9m0-6H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V7l-5-5z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2 tracking-tight">Access Restricted</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
            No permission is granted to you by the FinderB controller. Please contact developer for access to data.
          </p>
        </div>
      );
    }

    switch (activeTab) {
      case "Dashboard":
        return (
          <DashboardContent
            setActiveTab={setActiveTab}
            merchantRequests={merchantRequests}
            handleApprove={handleDashboardApprove}
            handleReject={handleDashboardReject}
            chartData={chartData}
            recentActivities={recentActivities}
            stats={dashboardStats}
            platformDateLabel={platformDateLabel}
            platformTimeLabel={platformTimeLabel}
            loginLogs={loginLogs}
            maintenanceMode={settings.maintenance}
          />
        );
      case "Users":
        return <UsersContent users={users} setUsers={setUsers} adminSession={adminSession} />;
      case "Merchants":
        return (
          <MerchantsContent
            activeMerchants={activeMerchants}
            setActiveMerchants={setActiveMerchants}
            merchantRequests={merchantRequests}
            setMerchantRequests={setMerchantRequests}
            adminSession={adminSession}
            categories={categories}
          />
        );
      case "Leads":
        return <LeadsContent 
          leads={leads} 
          categories={categories} 
          merchants={activeMerchants} 
        />;
      case "Categories":
        return <CategoriesContent
          categories={categories}
          setCategories={setCategories}
          categoryError={categoryError}
          onUpdateCategory={handleUpdateCategory}
          onCreateCategory={handleCreateCategory}
          merchants={activeMerchants}
        />;
      case "Movies":
        return <MoviesContent
          movies={movies}
          setMovies={setMovies}
          onUpdateMovie={handleUpdateMovie}
          onCreateMovie={handleCreateMovie}
          onDeleteMovie={handleDeleteMovie}
        />;
      case "Tourist Places":
        return <TouristPlacesContent
          places={touristPlaces}
          onUpdatePlace={handleUpdateTouristPlace}
          onCreatePlace={handleCreateTouristPlace}
          onDeletePlace={handleDeleteTouristPlace}
        />;
      case "News":
        return <DisabledTabContent tabName="News" />;
      case "Blogs":
        return <BlogContent
          blogs={blogs}
          onUpdateBlog={handleUpdateBlog}
          onCreateBlog={handleCreateBlog}
          onDeleteBlog={handleDeleteBlog}
          onUploadImage={handleBlogImageUpload}
        />;
      case "FinderB Jobs":
        return <FinderBJobsContent jobs={finderBJobs} setJobs={setFinderBJobs} />;
      case "Payments & Subscriptions":
        return <PaymentsContent businesses={allBusinessData} />;
      case "Broadcasts":
        return (
          <BroadcastsContent
            title={broadcastTitle}
            setTitle={setBroadcastTitle}
            message={broadcastMessage}
            setMessage={setBroadcastMessage}
            audiences={broadcastAudiences}
            setAudiences={setBroadcastAudiences}
          />
        );
      case "Settings":
        return (
          <SettingsContent
            settings={settings}
            setSettings={setSettings}
            loginLogs={loginLogs}
          />
        );
      case "Manage Admins":
        return <ManageAdminsContent admins={admins} setAdmins={setAdmins} adminSession={adminSession} />;
      default:
        return (
          <DashboardContent
            setActiveTab={setActiveTab}
            merchantRequests={merchantRequests}
            handleApprove={handleDashboardApprove}
            handleReject={handleDashboardReject}
            chartData={chartData}
            recentActivities={recentActivities}
            stats={dashboardStats}
            platformDateLabel={platformDateLabel}
            platformTimeLabel={platformTimeLabel}
            loginLogs={loginLogs}
            maintenanceMode={settings.maintenance}
          />
        );
    }
  };

  return (
    <div className="admin-shell flex min-h-screen">
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      <aside className={`admin-sidebar transition-transform duration-300 ease-out ${isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="admin-sidebar-header">
          <Link href="/dashboard" className="flex items-center min-w-0">
            <Image src="/logo1.png" alt="FinderB" width={128} height={34} className="object-contain brightness-0 invert opacity-95" priority />
          </Link>
          <p className="admin-sidebar-brand">CONTROL CENTER</p>
          <button onClick={() => setIsSidebarOpen(false)} className="absolute top-5 right-4 p-1.5 text-slate-500 hover:text-white hover:bg-white/5 rounded-md lg:hidden">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="mx-4 mt-4 mb-2 px-3 py-2.5 rounded-md border border-white/[0.08] bg-white/[0.03]">
          <div className="flex items-center justify-between gap-2">
            <span className={`admin-status-pill ${settings.maintenance ? "admin-status-warn" : "admin-status-live"} !text-[10px] !py-0.5`}>
              {!settings.maintenance && <span className="admin-status-dot" />}
              {settings.maintenance ? "Maintenance" : "Operational"}
            </span>
            <span className="text-[10px] text-slate-500 tabular-nums">
              {platformTimeLabel || "—"}
            </span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-2 overflow-y-auto sidebar-scrollbar">
          {NAV_GROUPS.map((group) => {
            const groupItems = menuItems.filter((item) => group.items.includes(item.name));
            if (groupItems.length === 0) return null;
            return (
              <div key={group.label} className="admin-nav-group">
                <p className="admin-nav-group-label">{group.label}</p>
                <div className="space-y-0.5">
                  {groupItems.map((item) => {
                    const isDisabled = DISABLED_TABS.has(item.name);
                    return (
                      <button
                        key={item.name}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => {
                          if (isDisabled) return;
                          setActiveTab(item.name);
                          setIsSidebarOpen(false);
                        }}
                        className={`admin-nav-item w-full ${
                          isDisabled
                            ? "admin-nav-item-idle opacity-40 cursor-not-allowed"
                            : activeTab === item.name
                              ? "admin-nav-item-active"
                              : "admin-nav-item-idle"
                        }`}
                        title={isDisabled ? "This tab is disabled. Contact the developer." : undefined}
                      >
                        <span className={`shrink-0 ${activeTab === item.name && !isDisabled ? "text-primary-300" : "text-slate-500"}`}>{item.icon}</span>
                        <span className="truncate">{item.name}</span>
                        {isDisabled && (
                          <span className="ml-auto text-[8px] uppercase tracking-wider text-slate-600">Off</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/[0.07]">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="admin-avatar-dark">{adminSession?.email?.charAt(0).toUpperCase() || "A"}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200 truncate">{adminSession?.email?.split("@")[0] || "Admin"}</p>
              <p className="text-[11px] text-slate-500 truncate capitalize">{adminSession?.role?.replace("_", " ") || "Administrator"}</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="admin-content-area flex-1 lg:ml-[280px] flex flex-col min-w-0">
        <header className="admin-topbar">
          <div className="flex items-center gap-3 min-w-0">
            <button className="admin-btn-ghost lg:hidden" onClick={() => setIsSidebarOpen(true)}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <div className="admin-breadcrumb hidden sm:flex">
              <span>FinderB</span>
              <span className="text-slate-300">/</span>
              <span className="admin-breadcrumb-current">{activeTab}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden md:inline admin-badge bg-primary-50 text-primary border-primary/20 capitalize">{adminSession?.role?.replace("_", " ") || "Admin"}</span>
            <button type="button" onClick={handleLogout} className="admin-btn-secondary text-xs py-1.5 px-3">Sign out</button>
          </div>
        </header>

        <div className="admin-command-bar">
          <div className="flex flex-wrap items-center gap-2">
            <span className="admin-metric-chip">Users <strong>{users.length.toLocaleString()}</strong></span>
            <span className="admin-metric-chip">Partners <strong>{activeMerchants.length.toLocaleString()}</strong></span>
            <span className="admin-metric-chip">Pending KYC <strong>{merchantRequests.length}</strong></span>
            <span className="admin-metric-chip">Leads <strong>{leads.length.toLocaleString()}</strong></span>
          </div>
          <p className="text-xs text-slate-400 tabular-nums hidden sm:block">
            {platformDateLabel || "—"}
          </p>
        </div>

        <main className="admin-main space-y-6">
          {fetchError && (
            <div className="admin-alert-error">
              <p className="font-medium text-rose-900">System alert</p>
              <p className="mt-0.5 text-rose-700">{fetchError}</p>
            </div>
          )}
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

// --- Content Components ---

function LeadsContent({ leads, categories, merchants }: { 
  leads: Lead[], 
  categories: Category[], 
  merchants: Merchant[] 
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All Categories");
  const [sourceFilter, setSourceFilter] = useState("All Sources");
  const [merchantFilter, setMerchantFilter] = useState("All Merchants");

  const categoryOptions = useMemo(() => {
    const names = new Set<string>();
    categories.forEach((c) => names.add(c.name));
    leads.forEach((l) => {
      if (l.category) names.add(l.category);
    });
    return ["All Categories", ...Array.from(names).sort()];
  }, [categories, leads]);

  const merchantOptions = useMemo(() => {
    const map = new Map<string, string>();
    merchants.forEach((m) => map.set(m.id, m.name));
    leads.forEach((l) => {
      if (l.business_id) {
        map.set(l.business_id, l.merchant_name || l.business_id);
      }
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [merchants, leads]);

  const filteredLeads = leads.filter((lead) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      !q ||
      lead.name.toLowerCase().includes(q) ||
      (lead.email && lead.email.toLowerCase().includes(q)) ||
      (lead.phone && lead.phone.includes(searchTerm)) ||
      (lead.message && lead.message.toLowerCase().includes(q)) ||
      (lead.merchant_name && lead.merchant_name.toLowerCase().includes(q));

    const matchesCategory =
      categoryFilter === "All Categories" || lead.category === categoryFilter;

    const matchesMerchant =
      merchantFilter === "All Merchants" || lead.business_id === merchantFilter;

    const matchesSource =
      sourceFilter === "All Sources" ||
      (sourceFilter === "Generated on profile" && isProfileLeadSource(lead.status)) ||
      (sourceFilter === "Circulated in category" && isCategoryLeadSource(lead.status)) ||
      (sourceFilter === "Other" && isLegacyLeadSource(lead.status));

    return matchesSearch && matchesCategory && matchesMerchant && matchesSource;
  });

  const stats = {
    today: leads.filter(
      (l) => new Date(l.created_at).toDateString() === new Date().toDateString()
    ).length,
    weekly: leads.filter((l) => {
      const diff = Date.now() - new Date(l.created_at).getTime();
      return diff < 7 * 24 * 60 * 60 * 1000;
    }).length,
    monthly: leads.filter((l) => {
      const date = new Date(l.created_at);
      const now = new Date();
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }).length,
    profile: leads.filter((l) => isProfileLeadSource(l.status)).length,
    circulated: leads.filter((l) => isCategoryLeadSource(l.status)).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
        <div>
          <h1 className="admin-page-title">Leads Management</h1>
          <p className="admin-page-subtitle">Track and manage customer inquiries and service requests.</p>
        </div>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Today's Leads", value: stats.today, color: "bg-primary", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
          { label: "Weekly Leads", value: stats.weekly, color: "bg-secondary", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
          { label: "Monthly Leads", value: stats.monthly, color: "bg-slate-900", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
          { label: "On profile", value: stats.profile, color: "bg-blue-600", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
          { label: "Circulated", value: stats.circulated, color: "bg-violet-600", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-5 rounded-xl border border-slate-200/60 shadow-sm hover:shadow-xl transition-all duration-300 group">
            <div className="flex items-center gap-4">
              <div className={`p-2.5 rounded-xl ${stat.color} text-white shadow-lg group-hover:scale-110 transition-all duration-300`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={stat.icon} />
                </svg>
              </div>
              <div>
                <p className="text-[10px] font-medium text-slate-400">{stat.label}</p>
                <h3 className="text-2xl font-medium text-slate-900 mt-1 tabular-nums">{stat.value}</h3>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters Section */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-sm flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[240px]">
          <input
            type="text"
            placeholder="SEARCH LEADS..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
          <svg className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all min-w-[160px]"
        >
          {categoryOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all min-w-[180px]"
        >
          <option>All Sources</option>
          <option>Generated on profile</option>
          <option>Circulated in category</option>
          <option>Other</option>
        </select>

        <select
          value={merchantFilter}
          onChange={(e) => setMerchantFilter(e.target.value)}
          className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all min-w-[180px]"
        >
          <option>All Merchants</option>
          {merchantOptions.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <p className="text-[10px] text-slate-500 px-1">
        Showing {filteredLeads.length} of {leads.length} lead record
        {leads.length === 1 ? '' : 's'}
        {sourceFilter === 'Generated on profile' ? ` · ${PROFILE_LEAD_BADGE}` : ''}
        {sourceFilter === 'Circulated in category' ? ` · ${CATEGORY_LEAD_BADGE}` : ''}
      </p>

      {/* Leads Table */}
      <div className="admin-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-[9px] font-medium text-slate-400 tracking-[0.2em] whitespace-nowrap">Customer</th>
                <th className="px-6 py-4 text-[9px] font-medium text-slate-400 tracking-[0.2em] whitespace-nowrap min-w-[200px]">Looking for</th>
                <th className="px-6 py-4 text-[9px] font-medium text-slate-400 tracking-[0.2em] whitespace-nowrap">Category</th>
                <th className="px-6 py-4 text-[9px] font-medium text-slate-400 tracking-[0.2em] whitespace-nowrap">Source</th>
                <th className="px-6 py-4 text-[9px] font-medium text-slate-400 tracking-[0.2em] whitespace-nowrap">Assigned merchant</th>
                <th className="px-6 py-4 text-[9px] font-medium text-slate-400 tracking-[0.2em] whitespace-nowrap">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50/80">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <p className="text-[11px] font-medium text-slate-500">
                      {leads.length === 0
                        ? 'No leads in database yet'
                        : 'No leads match the current filters'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-primary/[0.01] transition-colors group">
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-[11px] font-medium text-slate-900 tracking-tight">{lead.name}</p>
                        <p className="text-[9px] text-slate-500 mt-0.5">
                          {[lead.phone, lead.email].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 max-w-xs">
                      <p className="text-[10px] text-slate-600 line-clamp-2" title={lead.message || ''}>
                        {lead.message || '—'}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-50 text-slate-600 border border-slate-100 text-[9px] font-medium">
                        {lead.category}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-lg text-[9px] font-medium border max-w-[140px] ${leadBadgeClassName(lead.status)}`}
                      >
                        {isProfileLeadSource(lead.status)
                          ? PROFILE_LEAD_BADGE
                          : isCategoryLeadSource(lead.status)
                            ? CATEGORY_LEAD_BADGE
                            : lead.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {lead.merchant_name ? (
                        <p className="text-[10px] font-medium text-slate-800">{lead.merchant_name}</p>
                      ) : lead.business_id ? (
                        <p className="text-[10px] text-slate-500 font-mono">{lead.business_id.slice(0, 8)}…</p>
                      ) : (
                        <span className="text-[9px] text-slate-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[10px] text-slate-600 tabular-nums opacity-80">
                        {new Date(lead.created_at).toLocaleString()}
                      </p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function matchesSearchTerm(searchTerm: string, ...fields: (string | null | undefined)[]): boolean {
  const query = searchTerm.trim().toLowerCase();
  if (!query) return true;
  return fields.some((field) => (field ?? "").toLowerCase().includes(query));
}

function ControllerPasswordModal({
  isOpen,
  onClose,
  title,
  adminSession,
  onFetchPassword,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  adminSession: AdminSession;
  onFetchPassword: () => Promise<string | null>;
  onSuccess: (password: string) => void;
}) {
  const [adminPassword, setAdminPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAdminPassword("");
      setError("");
      setLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const { data, error: verifyError } = await supabase
        .from("admins")
        .select("password")
        .eq("id", adminSession.id)
        .single();
      if (verifyError || !data || data.password !== adminPassword) {
        setError("Incorrect admin password.");
        return;
      }
      const targetPassword = await onFetchPassword();
      if (!targetPassword) {
        setError("No password found for this account.");
        return;
      }
      onSuccess(targetPassword);
      onClose();
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-modal-overlay">
      <div className="admin-modal">
        <div className="admin-card-header">
          <div>
            <h3 className="admin-card-title">Verify controller access</h3>
            <p className="admin-card-description">{title}</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="admin-label block mb-2">Enter your admin password</label>
            <input type="password" autoFocus required value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className="admin-input" placeholder="••••••••" />
          </div>
          {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="admin-btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="admin-btn-primary flex-1">{loading ? "Verifying..." : "Reveal password"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PasswordRevealCell({
  id,
  visiblePasswords,
  onToggleVisibility,
  onRequestReveal,
}: {
  id: string;
  visiblePasswords: Record<string, string>;
  onToggleVisibility: (id: string) => void;
  onRequestReveal: (id: string) => void;
}) {
  const isVisible = Boolean(visiblePasswords[id]);
  return (
    <td className="px-5 py-4">
      <div className="flex items-center gap-2">
        <span className="admin-mono bg-slate-50 px-2 py-1 rounded-md border border-slate-100 min-w-[80px]">
          {isVisible ? formatRevealedPassword(visiblePasswords[id]) : "••••••••"}
        </span>
        <button onClick={() => (isVisible ? onToggleVisibility(id) : onRequestReveal(id))} className="admin-btn-ghost !p-1.5" title={isVisible ? "Hide password" : "Reveal password"}>
          {isVisible ? (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
          )}
        </button>
      </div>
    </td>
  );
}

function UsersContent({ users, setUsers, adminSession }: { users: User[], setUsers: Dispatch<SetStateAction<User[]>>, adminSession: AdminSession | null }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, string>>({});
  const [passwordModalTarget, setPasswordModalTarget] = useState<{ id: string; label: string } | null>(null);
  const isController = adminSession?.role === "controller";

  const handleDeleteUser = async (id: string) => {
    if (confirm("Are you sure you want to delete this user?")) {
      try {
        const supabase = createClient();
        const { error } = await supabase.from('User').delete().eq('id', id);
        if (error) alert("Error deleting user: " + error.message);
        else setUsers(users.filter(u => u.id !== id));
      } catch {
        alert("An error occurred.");
      }
    }
  };

  const filteredUsers = users.filter((user) => matchesSearchTerm(searchTerm, user.id, user.fullName, user.email));

  const fetchUserPassword = async (userId: string) => {
    const { data } = await createClient().from("User").select("password").eq("id", userId).single();
    return classifyStoredPassword(data?.password);
  };

  return (
    <div className="space-y-6">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">User management</h1>
          <p className="admin-page-subtitle">View and manage registered users on the platform.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <input type="text" placeholder="Search by name, email, or ID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="admin-search w-72" />
            <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <button onClick={() => alert("Add User functionality coming soon!")} className="admin-btn-primary">Add user</button>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>User ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Joined</th>
                {isController && <th>Password</th>}
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td><p className="admin-mono">{user.id}</p></td>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="admin-avatar">{user.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}</div>
                      <p className="text-sm font-medium text-slate-900">{user.fullName}</p>
                    </div>
                  </td>
                  <td><p className="text-sm text-slate-600">{user.email || "—"}</p></td>
                  <td><p className="text-sm text-slate-600 tabular-nums">{new Date(user.createdAt).toLocaleDateString()}</p></td>
                  {isController && (
                    <PasswordRevealCell id={user.id} visiblePasswords={visiblePasswords} onToggleVisibility={(id) => setVisiblePasswords((p) => { const n = { ...p }; delete n[id]; return n; })} onRequestReveal={(id) => setPasswordModalTarget({ id, label: `Enter your admin password to view the password for ${users.find(u => u.id === id)?.fullName || "this user"}.` })} />
                  )}
                  <td className="text-right">
                    <button onClick={() => handleDeleteUser(user.id)} className="admin-icon-btn-danger" title="Delete">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr><td colSpan={isController ? 6 : 5} className="admin-empty">{users.length === 0 ? "No users found" : "No users match your search"}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {passwordModalTarget && adminSession && (
        <ControllerPasswordModal isOpen={Boolean(passwordModalTarget)} onClose={() => setPasswordModalTarget(null)} title={passwordModalTarget.label} adminSession={adminSession} onFetchPassword={() => fetchUserPassword(passwordModalTarget.id)} onSuccess={(password) => setVisiblePasswords((p) => ({ ...p, [passwordModalTarget.id]: password }))} />
      )}
    </div>
  );
}

function ManageAdminsContent({ admins, setAdmins, adminSession }: { admins: AdminProfile[], setAdmins: Dispatch<SetStateAction<AdminProfile[]>>, adminSession: any }) {
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [openTabsId, setOpenTabsId] = useState<string | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openTabsId && !(event.target as Element).closest('.tabs-dropdown')) {
        setOpenTabsId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openTabsId]);

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newPassword) return;

    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('admins')
        .insert([{
          email: newEmail.toLowerCase(),
          password: newPassword,
          role: 'admin'
        }])
        .select();

      if (error) {
        alert("Error creating admin: " + error.message);
      } else if (data) {
        setAdmins([...admins, data[0]]);
        setNewEmail("");
        setNewPassword("");
        setShowCreateForm(false);
        alert("Admin created successfully!");
      }
    } catch (err) {
      alert("An error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePromoteToSuperAdmin = async (id: string, email: string) => {
    if (adminSession?.role !== 'controller') {
      alert("Only Controller can perform this action.");
      return;
    }
    if (confirm(`Promote ${email} to super admin?`)) {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('admins')
          .update({ role: 'super_admin' })
          .eq('id', id)
          .select();

        if (error) {
          alert("Error promoting admin: " + error.message);
        } else if (data && data.length > 0) {
          setAdmins(admins.map(a => a.id === id ? { ...a, role: 'super_admin' } : a));
          alert(`${email} is now a super admin.`);
        }
      } catch (err) {
        alert("An error occurred.");
      }
    }
  };

  const handleDemoteToAdmin = async (id: string, email: string) => {
    if (adminSession?.role !== 'controller') {
      alert("Only Controller can perform this action.");
      return;
    }
    if (confirm(`Demote ${email} to admin?`)) {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('admins')
          .update({ role: 'admin' })
          .eq('id', id)
          .select();

        if (error) {
          alert("Error demoting admin: " + error.message);
        } else if (data && data.length > 0) {
          setAdmins(admins.map(a => a.id === id ? { ...a, role: 'admin' } : a));
          alert(`${email} is now an admin.`);
        }
      } catch (err) {
        alert("An error occurred.");
      }
    }
  };

  const handleToggleDisable = async (id: string, email: string, currentStatus: boolean) => {
    if (adminSession?.role !== 'controller') {
      alert("Only Controller can perform this action.");
      return;
    }
    const action = currentStatus ? "enable" : "disable";
    if (confirm(`Are you sure you want to ${action} ${email}?`)) {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('admins')
          .update({ is_disabled: !currentStatus })
          .eq('id', id)
          .select();

        if (error) {
          alert(`Error ${action}ing admin: ` + error.message);
        } else if (data && data.length > 0) {
          setAdmins(admins.map(a => a.id === id ? { ...a, is_disabled: !currentStatus } : a));
          alert(`${email} has been ${action}d.`);
        }
      } catch (err) {
        alert("An error occurred.");
      }
    }
  };

  const handleUpdateTabs = async (id: string, tabs: string[]) => {
    if (adminSession?.role !== 'controller') {
      alert("Only Controller can perform this action.");
      return;
    }
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('admins')
        .update({ allowed_tabs: tabs })
        .eq('id', id)
        .select();

      if (error) {
        alert("Error updating tabs: " + error.message);
      } else if (data && data.length > 0) {
        setAdmins(admins.map(a => a.id === id ? { ...a, allowed_tabs: tabs } : a));
      }
    } catch (err) {
      alert("An error occurred.");
    }
  };

  const handleDeleteAdmin = async (id: string, email: string, role: string) => {
    if (role === 'super_admin' || email === 'admin@finderb.com') {
      alert("Super admin cannot be deleted.");
      return;
    }

    if (confirm(`Are you sure you want to delete admin ${email}?`)) {
      try {
        const supabase = createClient();
        const { error } = await supabase
          .from('admins')
          .delete()
          .eq('id', id);

        if (error) {
          alert("Error deleting admin: " + error.message);
        } else {
          setAdmins(admins.filter(a => a.id !== id));
          alert("Admin deleted successfully!");
        }
      } catch (err) {
        alert("An error occurred.");
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
        <div>
          <h1 className="admin-page-title">Admin Management</h1>
          <p className="admin-page-subtitle">Manage administrative profiles and permissions.</p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-primary text-white text-[10px] font-medium rounded-xl hover:bg-primary-700 transition-all active:scale-95"
        >
          {showCreateForm ? "Cancel" : "Add New Admin"}
        </button>
      </div>

      {showCreateForm && (
        <div className="admin-card p-6 max-w-md mx-auto">
          <h2 className="text-sm font-semibold text-slate-900 mb-4 tracking-wider">Create New Admin</h2>
          <form onSubmit={handleCreateAdmin} className="space-y-4">
            <div>
              <label className="block text-[10px] font-medium text-slate-500 mb-1">Email Address</label>
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                placeholder="admin@example.com"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-slate-500 mb-1">Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-primary text-white text-[10px] font-medium rounded-xl hover:bg-primary-700 transition-all disabled:opacity-50"
            >
              {isLoading ? "Creating..." : "Create Admin Account"}
            </button>
          </form>
        </div>
      )}

      <div className="admin-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-[9px] font-medium text-slate-400 tracking-[0.2em] whitespace-nowrap">Admin Info</th>
                <th className="px-6 py-4 text-[9px] font-medium text-slate-400 tracking-[0.2em] whitespace-nowrap">Role</th>
                {adminSession?.role === 'controller' && (
                  <th className="px-6 py-4 text-[9px] font-medium text-slate-400 tracking-[0.2em] whitespace-nowrap">Password</th>
                )}
                <th className="px-6 py-4 text-[9px] font-medium text-slate-400 tracking-[0.2em] whitespace-nowrap">Status</th>
                {adminSession?.role === 'controller' && (
                  <th className="px-6 py-4 text-[9px] font-medium text-slate-400 tracking-[0.2em] whitespace-nowrap">Allowed Tabs</th>
                )}
                <th className="px-6 py-4 text-[9px] font-medium text-slate-400 tracking-[0.2em] whitespace-nowrap">Created At</th>
                <th className="px-6 py-4 text-[9px] font-medium text-slate-400 tracking-[0.2em] text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50/80">
              {admins.map((admin) => (
                <tr key={admin.id} className="hover:bg-primary/[0.01] transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center text-primary font-medium text-[10px] border border-slate-200 transition-transform shadow-sm">
                        {admin.email.substring(0, 2)}
                      </div>
                      <div>
                        <p className="text-[11px] font-medium text-slate-900 tracking-tight">{admin.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-2">
                      <span className={`px-2.5 py-1 rounded-lg text-[9px] font-medium uppercase tracking-widest border text-center ${admin.role === "super_admin"
                        ? "bg-purple-50 text-purple-600 border-purple-100"
                        : admin.role === "controller"
                          ? "bg-amber-50 text-amber-600 border-amber-100"
                          : "bg-blue-50 text-blue-600 border-blue-100"
                        }`}>
                        {admin.role.replace('_', ' ')}
                      </span>
                      {adminSession?.role === 'controller' && admin.role !== 'controller' && (
                        <button
                          onClick={() => admin.role === 'super_admin' ? handleDemoteToAdmin(admin.id, admin.email) : handlePromoteToSuperAdmin(admin.id, admin.email)}
                          className="text-[8px] font-bold text-primary hover:underline"
                        >
                          {admin.role === 'super_admin' ? 'Demote to Admin' : 'Promote to Super Admin'}
                        </button>
                      )}
                    </div>
                  </td>
                  {adminSession?.role === 'controller' && (
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-medium text-slate-600 tabular-nums bg-slate-50 px-2 py-1 rounded-md border border-slate-100 min-w-[80px]">
                          {visiblePasswords[admin.id] ? admin.password : "••••••••"}
                        </span>
                        <button
                          onClick={() => setVisiblePasswords(prev => ({ ...prev, [admin.id]: !prev[admin.id] }))}
                          className="text-slate-400 hover:text-primary transition-all p-1 hover:bg-primary/5 rounded-lg"
                        >
                          {visiblePasswords[admin.id] ? (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </td>
                  )}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${admin.is_disabled ? 'bg-rose-500' : 'bg-emerald-500'}`}></span>
                      <span className="text-[10px] font-medium">
                        {admin.is_disabled ? 'Disabled' : 'Active'}
                      </span>
                      {adminSession?.role === 'controller' && admin.role !== 'controller' && (
                        <button
                          onClick={() => handleToggleDisable(admin.id, admin.email, admin.is_disabled)}
                          className="ml-2 text-[8px] font-bold text-slate-400 hover:text-primary"
                        >
                          {admin.is_disabled ? 'Enable' : 'Disable'}
                        </button>
                      )}
                    </div>
                  </td>
                  {adminSession?.role === 'controller' && (
                    <td className="px-6 py-4">
                      {admin.role === 'controller' ? (
                        <span className="text-[9px] text-slate-400">All Access</span>
                      ) : (
                        <div className="relative tabs-dropdown">
                          <button
                            onClick={() => setOpenTabsId(openTabsId === admin.id ? null : admin.id)}
                            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[9px] font-medium tracking-wider flex items-center gap-2"
                          >
                            {admin.allowed_tabs?.length || 0} Tabs
                            <svg className={`w-3 h-3 transition-transform ${openTabsId === admin.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          <div className={`absolute left-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-30 ${openTabsId === admin.id ? 'block' : 'hidden'} max-h-60 overflow-y-auto p-2`}>
                            {ALL_MENU_ITEMS.filter(item => item.name !== 'Manage Admins').map(item => (
                              <label key={item.name} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={admin.allowed_tabs?.includes(item.name) || false}
                                  onChange={(e) => {
                                    const currentTabs = admin.allowed_tabs || [];
                                    const nextTabs = e.target.checked
                                      ? [...currentTabs, item.name]
                                      : currentTabs.filter(t => t !== item.name);
                                    handleUpdateTabs(admin.id, nextTabs);
                                  }}
                                  className="w-3 h-3 rounded text-primary focus:ring-primary/20"
                                />
                                <span className="text-[10px] text-slate-600 font-medium">{item.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </td>
                  )}
                  <td className="px-6 py-4">
                    <p className="text-[10px] text-slate-600 font-normal tabular-nums opacity-80">{new Date(admin.created_at).toLocaleDateString()}</p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {admin.role !== 'controller' && admin.email !== 'admin@finderb.com' && (
                        <button
                          onClick={() => handleDeleteAdmin(admin.id, admin.email, admin.role)}
                          className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 rounded-xl transition-all border border-slate-100 shadow-sm"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function DisabledTabContent({ tabName }: { tabName: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[420px] text-center p-10 admin-card">
      <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 mb-6 border border-amber-100">
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-slate-900 mb-2 tracking-tight">{tabName} is disabled</h3>
      <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
        This section is not available in the control panel. Contact the developer if you need access.
      </p>
    </div>
  );
}

function MerchantsContent({ activeMerchants, setActiveMerchants, merchantRequests, setMerchantRequests, adminSession, categories }: {
  activeMerchants: Merchant[],
  setActiveMerchants: Dispatch<SetStateAction<Merchant[]>>,
  merchantRequests: MerchantRequest[],
  setMerchantRequests: Dispatch<SetStateAction<MerchantRequest[]>>,
  adminSession: AdminSession | null,
  categories: Category[],
}) {
  const [merchantTab, setMerchantTab] = useState<"Active" | "Pending">("Active");
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessData | null>(null);
  const [isUploading, setIsUploading] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, string>>({});
  const [passwordModalTarget, setPasswordModalTarget] = useState<{ id: string; label: string } | null>(null);
  const isController = adminSession?.role === "controller";

  const filteredActiveMerchants = activeMerchants.filter((m) =>
    matchesSearchTerm(searchTerm, m.id, m.name, m.email, m.registrationNumber, m.category),
  );
  const filteredMerchantRequests = merchantRequests.filter((m) =>
    matchesSearchTerm(searchTerm, m.id, m.name, m.email, m.registrationNumber, m.category),
  );

  const fetchMerchantPassword = async (merchantId: string) => {
    const { data } = await createClient().from("Business").select("password").eq("id", merchantId).single();
    return classifyStoredPassword(data?.password);
  };

  const handleViewMerchant = async (id: string) => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('Business')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      alert("Error fetching business details: " + error.message);
      return;
    }

    setSelectedBusiness(data);
  };

  const handleBusinessImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedBusiness) return;

    const currentImages = selectedBusiness.images || [];
    if (currentImages.length >= 5) {
      alert("Maximum 5 images allowed.");
      return;
    }

    try {
      setIsUploading('businessImages');
      const url = await uploadToCloudinary(file);

      const supabase = createClient();
      const newImages = [...currentImages, url];

      const { error } = await supabase
        .from('Business')
        .update({ images: newImages })
        .eq('id', selectedBusiness.id);

      if (error) throw error;

      setSelectedBusiness({ ...selectedBusiness, images: newImages });
      alert("Image uploaded successfully!");
    } catch (error: any) {
      alert("Upload failed: " + error.message);
    } finally {
      setIsUploading(null);
    }
  };

  const handleDeleteBusinessImage = async (urlToDelete: string) => {
    if (!selectedBusiness || !confirm("Delete this image?")) return;

    try {
      const currentImages = selectedBusiness.images || [];
      const newImages = currentImages.filter(url => url !== urlToDelete);

      // If deleted image was profile picture, clear it
      const newProfilePic = selectedBusiness.profilePictureUrl === urlToDelete ? null : selectedBusiness.profilePictureUrl;

      const supabase = createClient();
      const { error } = await supabase
        .from('Business')
        .update({ images: newImages, profilePictureUrl: newProfilePic })
        .eq('id', selectedBusiness.id);

      if (error) throw error;

      setSelectedBusiness({ ...selectedBusiness, images: newImages, profilePictureUrl: newProfilePic });
    } catch (error: any) {
      alert("Delete failed: " + error.message);
    }
  };

  const handleSetProfilePicture = async (url: string) => {
    if (!selectedBusiness) return;

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('Business')
        .update({ profilePictureUrl: url })
        .eq('id', selectedBusiness.id);

      if (error) throw error;

      setSelectedBusiness({ ...selectedBusiness, profilePictureUrl: url });
      alert("Profile picture updated!");
    } catch (error: any) {
      alert("Failed to set profile picture: " + error.message);
    }
  };

  const handleApprove = async (merchant: MerchantRequest) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('Business')
      .update({ kycStatus: 'approved', isVerified: true })
      .eq('id', merchant.id);

    if (error) {
      alert("Error: " + error.message);
      return;
    }

    setActiveMerchants([...activeMerchants, {
      ...merchant,
      rating: 0,
      sales: 0,
      validUntil: "—",
      status: "Active",
      isFinderBVerified: false,
      paymentStatus: "pending",
      selectedPlan: "free",
      billingCycle: "monthly",
      planExpiresAt: null,
      slug: null,
      city: null,
    }]);
    setMerchantRequests(merchantRequests.filter(m => m.id !== merchant.id));
  };

  const handleReject = async (id: string) => {
    if (confirm("Reject this merchant?")) {
      const supabase = createClient();
      await supabase.from('Business').update({ kycStatus: 'rejected' }).eq('id', id);
      setMerchantRequests(merchantRequests.filter(m => m.id !== id));
    }
  };

  const toggleMerchantStatus = async (id: string, currentStatus: string) => {
    if (!isController) return;
    const newStatus = currentStatus === "Active" ? "Inactive" : "Active";
    const supabase = createClient();
    const { error } = await supabase
      .from('Business')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) {
      alert("Error updating status: " + error.message);
      return;
    }

    setActiveMerchants(activeMerchants.map(m =>
      m.id === id ? { ...m, status: newStatus } : m
    ));

    if (selectedBusiness && selectedBusiness.id === id) {
      setSelectedBusiness({ ...selectedBusiness, status: newStatus });
    }
  };

  const toggleFinderBVerified = async (id: string, currentStatus: boolean) => {
    if (!isController) return;
    const newStatus = !currentStatus;
    const supabase = createClient();
    const { error } = await supabase
      .from('Business')
      .update({ isFinderBVerified: newStatus })
      .eq('id', id);

    if (error) {
      alert("Error updating verification status: " + error.message);
      return;
    }

    if (selectedBusiness && selectedBusiness.id === id) {
      setSelectedBusiness({ ...selectedBusiness, isFinderBVerified: newStatus });
    }

    setActiveMerchants(activeMerchants.map((m) =>
      m.id === id ? { ...m, isFinderBVerified: newStatus } : m
    ));
  };

  const handleDeleteMerchant = async (id: string) => {
    if (!isController) return;
    if (confirm("Are you sure you want to delete this merchant profile? This action cannot be undone.")) {
      const supabase = createClient();
      const { error } = await supabase
        .from('Business')
        .delete()
        .eq('id', id);

      if (error) {
        alert("Error deleting merchant: " + error.message);
        return;
      }

      setActiveMerchants(activeMerchants.filter(m => m.id !== id));
      setMerchantRequests(merchantRequests.filter(m => m.id !== id));

      if (selectedBusiness && selectedBusiness.id === id) {
        setSelectedBusiness(null);
      }
    }
  };

  const syncMerchantListEntry = (id: string, updates: Partial<BusinessData>) => {
    setActiveMerchants((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        return {
          ...m,
          name: updates.businessName || updates.fullName || m.name,
          email: updates.workEmail || updates.email || m.email,
          category: updates.category || m.category,
          status: updates.status || m.status,
          isFinderBVerified: updates.isFinderBVerified ?? m.isFinderBVerified,
          planExpiresAt: updates.planExpiresAt !== undefined ? updates.planExpiresAt : m.planExpiresAt,
          validUntil: updates.planExpiresAt
            ? new Date(updates.planExpiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
            : m.validUntil,
        };
      }),
    );
  };

  const handleSaveMerchant = async (updates: Partial<BusinessData>) => {
    if (!isController || !selectedBusiness) return;

    const supabase = createClient();
    const payload = {
      fullName: updates.fullName,
      businessName: updates.businessName,
      workEmail: updates.workEmail,
      email: updates.email,
      mobile: updates.mobile,
      publicPhone: updates.publicPhone,
      category: updates.category,
      city: updates.city,
      state: updates.state,
      location: updates.location,
      businessAddress: updates.businessAddress,
      status: updates.status,
      kycStatus: updates.kycStatus,
      updatedAt: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("Business")
      .update(payload)
      .eq("id", selectedBusiness.id)
      .select("*")
      .single();

    if (error) {
      alert("Error saving merchant: " + error.message);
      return;
    }

    setSelectedBusiness(data);
    syncMerchantListEntry(selectedBusiness.id, data);

    if (data.kycStatus === "approved") {
      setMerchantRequests((prev) => prev.filter((m) => m.id !== data.id));
    }
  };

  const handleAdjustPlanExpiry = async (planExpiresAt: string | null) => {
    if (!isController || !selectedBusiness) return;

    const supabase = createClient();
    const { data, error } = await supabase
      .from("Business")
      .update({
        planExpiresAt,
        updatedAt: new Date().toISOString(),
      })
      .eq("id", selectedBusiness.id)
      .select("*")
      .single();

    if (error) {
      alert("Error updating subscription validity: " + error.message);
      return;
    }

    setSelectedBusiness(data);
    syncMerchantListEntry(selectedBusiness.id, data);
  };

  const verifiedCount = activeMerchants.filter((m) => m.isFinderBVerified).length;
  const paidCount = activeMerchants.filter((m) => m.paymentStatus === "completed").length;

  return (
    <div className="space-y-6">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Partner management</h1>
          <p className="admin-page-subtitle">Manage merchant profiles, listing status, and FinderB verification badges.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative">
            <input type="text" placeholder="Search by name, email, or merchant ID…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="admin-search w-72" />
            <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <div className="admin-segmented">
            <button onClick={() => setMerchantTab("Active")} className={`admin-segmented-btn ${merchantTab === "Active" ? "admin-segmented-btn-active" : "admin-segmented-btn-idle"}`}>
              Active ({filteredActiveMerchants.length})
            </button>
            <button onClick={() => setMerchantTab("Pending")} className={`admin-segmented-btn relative ${merchantTab === "Pending" ? "admin-segmented-btn-active" : "admin-segmented-btn-idle"}`}>
              Pending
              {merchantRequests.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold text-white border-2 border-white">{merchantRequests.length}</span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="admin-kpi-grid">
        <div className="admin-kpi admin-kpi-primary">
          <p className="admin-kpi-label">Active partners</p>
          <p className="admin-kpi-value">{activeMerchants.length}</p>
          <p className="admin-kpi-meta">Live merchant profiles</p>
        </div>
        <div className="admin-kpi admin-kpi-success">
          <p className="admin-kpi-label">FinderB verified</p>
          <p className="admin-kpi-value">{verifiedCount}</p>
          <p className="admin-kpi-meta">Green badge on listing</p>
        </div>
        <div className="admin-kpi admin-kpi-secondary">
          <p className="admin-kpi-label">Paid plans</p>
          <p className="admin-kpi-value">{paidCount}</p>
          <p className="admin-kpi-meta">Completed subscription payment</p>
        </div>
        <div className="admin-kpi admin-kpi-neutral">
          <p className="admin-kpi-label">Awaiting review</p>
          <p className="admin-kpi-value">{merchantRequests.length}</p>
          <p className="admin-kpi-meta">New partner requests</p>
        </div>
      </div>

      {merchantTab === "Active" ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filteredActiveMerchants.map((merchant) => (
            <div key={merchant.id} className="admin-card p-5 hover:shadow-lg transition-all duration-300 group">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 min-w-0">
                  <div className="relative shrink-0">
                    <div className="admin-avatar !w-12 !h-12 text-sm">{merchant.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}</div>
                    {merchant.isFinderBVerified && (
                      <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center" title="FinderB Verified">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-slate-900 truncate">{merchant.name}</h3>
                      {merchant.isFinderBVerified && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-semibold uppercase tracking-wide">
                          FinderB Verified
                        </span>
                      )}
                    </div>
                    {merchant.registrationNumber && (
                      <p className="admin-mono mt-0.5 text-[10px]">{merchant.registrationNumber}</p>
                    )}
                    <p className="text-xs text-slate-500 mt-1 truncate">{merchant.email || "—"}</p>
                    <a
                      href={getBusinessProfileUrl({
                        id: merchant.id,
                        businessName: merchant.name,
                        slug: merchant.slug,
                        city: merchant.city,
                      })}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline mt-1.5"
                    >
                      View public profile
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                </div>
                <span className={`admin-badge shrink-0 ${merchant.status === "Active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-600 border-slate-200"}`}>
                  {merchant.status}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
                  <p className="text-[9px] text-slate-400 uppercase tracking-wide">Category</p>
                  <p className="text-[11px] font-medium text-slate-800 mt-0.5 truncate">{merchant.category}</p>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
                  <p className="text-[9px] text-slate-400 uppercase tracking-wide">Plan</p>
                  <p className="text-[11px] font-medium text-slate-800 mt-0.5">{planLabel(merchant.selectedPlan, merchant.billingCycle)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 col-span-2 sm:col-span-1">
                  <p className="text-[9px] text-slate-400 uppercase tracking-wide">Plan valid until</p>
                  <p className="text-[11px] font-medium text-slate-800 mt-0.5">{merchant.validUntil}</p>
                </div>
              </div>

              {isController && (
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
                  <span className="text-[9px] text-slate-400 uppercase tracking-wide shrink-0">Login password</span>
                  <span className="admin-mono text-[11px] text-slate-800 flex-1 truncate">
                    {visiblePasswords[merchant.id]
                      ? formatRevealedPassword(visiblePasswords[merchant.id])
                      : "••••••••"}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (visiblePasswords[merchant.id]) {
                        setVisiblePasswords((p) => {
                          const next = { ...p };
                          delete next[merchant.id];
                          return next;
                        });
                      } else {
                        setPasswordModalTarget({
                          id: merchant.id,
                          label: `Enter your admin password to reveal the login password for ${merchant.name}.`,
                        });
                      }
                    }}
                    className="admin-btn-ghost text-[10px] py-1 px-2 shrink-0"
                  >
                    {visiblePasswords[merchant.id] ? "Hide" : "Reveal"}
                  </button>
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {isController && (
                    <>
                      <button
                        type="button"
                        onClick={() => toggleFinderBVerified(merchant.id, merchant.isFinderBVerified)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${merchant.isFinderBVerified ? "bg-emerald-500" : "bg-slate-200"}`}
                        title="Toggle FinderB Verified badge (controller only)"
                      >
                        <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${merchant.isFinderBVerified ? "translate-x-5" : "translate-x-0"}`} />
                      </button>
                      <span className="text-[10px] text-slate-500">FinderB badge</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => handleViewMerchant(merchant.id)} className="admin-btn-secondary text-[10px] py-1.5 px-3">Details</button>
                  {isController && (
                    <>
                      <button onClick={() => toggleMerchantStatus(merchant.id, merchant.status)} className="admin-icon-btn" title={merchant.status === "Active" ? "Deactivate" : "Activate"}>
                        {merchant.status === "Active" ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        )}
                      </button>
                      <button onClick={() => handleDeleteMerchant(merchant.id)} className="admin-icon-btn-danger" title="Delete">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
          {filteredActiveMerchants.length === 0 && (
            <div className="admin-card admin-empty col-span-full py-24">
              {activeMerchants.length === 0 ? "No active partners yet" : "No partners match your search"}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMerchantRequests.map((req) => (
            <div key={req.id} className="admin-card p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="admin-avatar !w-12 !h-12">{req.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}</div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{req.name}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="admin-badge bg-secondary/5 text-secondary border-secondary/20">{req.category}</span>
                    <span className="text-xs text-slate-500">{req.email || "—"}</span>
                    <span className="text-xs text-slate-400">Requested {req.date}</span>
                  </div>
                  <a
                    href={getBusinessProfileUrl({ id: req.id, businessName: req.name })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline mt-1.5"
                  >
                    View public profile
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <button onClick={() => handleViewMerchant(req.id)} className="admin-btn-secondary text-xs py-2">View details</button>
                {isController && (
                  <>
                    <button onClick={() => handleReject(req.id)} className="admin-btn-danger text-xs py-2">Reject</button>
                    <button onClick={() => handleDeleteMerchant(req.id)} className="admin-btn-danger text-xs py-2">Delete</button>
                    <button onClick={() => handleApprove(req)} className="admin-btn-primary text-xs py-2">Approve</button>
                  </>
                )}
              </div>
            </div>
          ))}
          {filteredMerchantRequests.length === 0 && (
            <div className="admin-card admin-empty py-24">{merchantRequests.length === 0 ? "No pending requests" : "No pending partners match your search"}</div>
          )}
        </div>
      )}

      {passwordModalTarget && adminSession && (
        <ControllerPasswordModal isOpen={Boolean(passwordModalTarget)} onClose={() => setPasswordModalTarget(null)} title={passwordModalTarget.label} adminSession={adminSession} onFetchPassword={() => fetchMerchantPassword(passwordModalTarget.id)} onSuccess={(password) => setVisiblePasswords((p) => ({ ...p, [passwordModalTarget.id]: password }))} />
      )}

      {selectedBusiness && (
        <MerchantDetailModal
          business={selectedBusiness}
          categories={categories.map((c) => c.name)}
          isController={isController}
          isUploading={isUploading}
          setIsUploading={setIsUploading}
          onClose={() => setSelectedBusiness(null)}
          onSave={handleSaveMerchant}
          onAdjustExpiry={handleAdjustPlanExpiry}
          onDelete={() => handleDeleteMerchant(selectedBusiness.id)}
          hasStoredPassword={Boolean(classifyStoredPassword(selectedBusiness.password))}
          loginPasswordDisplay={
            visiblePasswords[selectedBusiness.id]
              ? formatRevealedPassword(visiblePasswords[selectedBusiness.id])
              : null
          }
          onRevealLoginPassword={() =>
            setPasswordModalTarget({
              id: selectedBusiness.id,
              label: `Enter your admin password to reveal the login password for ${selectedBusiness.businessName || selectedBusiness.fullName || "this merchant"}.`,
            })
          }
          onHideLoginPassword={() =>
            setVisiblePasswords((prev) => {
              const next = { ...prev };
              delete next[selectedBusiness.id];
              return next;
            })
          }
          onApprove={() => {
            handleApprove({
              id: selectedBusiness.id,
              name: selectedBusiness.businessName || selectedBusiness.fullName || "",
              email: selectedBusiness.workEmail || selectedBusiness.email || "",
              category: selectedBusiness.category || "",
              date: "",
              registrationNumber: selectedBusiness.registrationNumber || null,
            });
            setSelectedBusiness(null);
          }}
          onReject={() => {
            handleReject(selectedBusiness.id);
            setSelectedBusiness(null);
          }}
          onToggleStatus={() => toggleMerchantStatus(selectedBusiness.id, selectedBusiness.status)}
          onToggleFinderBVerified={() => toggleFinderBVerified(selectedBusiness.id, selectedBusiness.isFinderBVerified)}
          onImageUpload={async (file) => {
            const fakeEvent = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
            await handleBusinessImageUpload(fakeEvent);
          }}
          onDeleteImage={handleDeleteBusinessImage}
          onSetProfilePicture={handleSetProfilePicture}
        />
      )}
    </div>
  );
}

function CategoriesContent({ categories, setCategories, categoryError, onUpdateCategory, onCreateCategory, merchants }: {
  categories: Category[],
  setCategories: Dispatch<SetStateAction<Category[]>>,
  categoryError: string | null,
  onUpdateCategory: (catName: string, updates: Partial<Category>) => Promise<void>,
  onCreateCategory: (category: Partial<Category>) => Promise<void>,
  merchants: Merchant[]
}) {
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState<Partial<Category>>({
    name: "",
    type: "Merchant",
    status: "Active",
    banner: "Not Set",
    symbol: "Not Set",
    fixedSlots: 0,
  });
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [merchantSearch, setMerchantSearch] = useState<{ [key: string]: string }>({});

  const handleSave = async () => {
    if (editingCategory) {
      await onUpdateCategory(editingCategory.name, editingCategory);
      setEditingCategory(null);
    }
  };

  const handleCreate = async () => {
    if (newCategory.name) {
      await onCreateCategory(newCategory);
      setIsAddingCategory(false);
      setNewCategory({
        name: "",
        type: "Merchant",
        status: "Active",
        banner: "Not Set",
        symbol: "Not Set",
        fixedSlots: 0,
      });
    }
  };

  const handleImageUpload = async (file: File, type: 'banner' | 'symbol', isEditing: boolean) => {
    try {
      setUploading(type);
      setUploadProgress(prev => ({ ...prev, [type]: 0 }));

      const url = await uploadToCloudinary(file, (progress) => {
        setUploadProgress(prev => ({ ...prev, [type]: progress }));
      });

      if (isEditing && editingCategory) {
        setEditingCategory({ ...editingCategory, [type]: url as string });
      } else {
        setNewCategory({ ...newCategory, [type]: url });
      }

      // Clear progress after success
      setTimeout(() => {
        setUploadProgress(prev => {
          const next = { ...prev };
          delete next[type];
          return next;
        });
      }, 1500);

    } catch (error: any) {
      alert(`Upload failed: ${error.message}`);
    } finally {
      setUploading(null);
    }
  };

  const getFilteredMerchants = (search: string) => {
    if (!search) return [];
    return merchants.filter(m =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.id.toLowerCase().includes(search.toLowerCase())
    ).slice(0, 5);
  };

  const renderCategoryForm = (cat: Partial<Category>, setCat: (c: any) => void, isEditing: boolean) => (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xl space-y-6 animate-in fade-in zoom-in duration-200">
      <div className="flex items-center justify-between border-b border-slate-50 pb-4">
        <h2 className="text-sm font-medium text-slate-900 tracking-tight">
          {isEditing ? `Editing: ${cat.name}` : "Add New Category"}
        </h2>
        <button onClick={() => isEditing ? setEditingCategory(null) : setIsAddingCategory(false)} className="text-slate-400 hover:text-slate-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          {!isEditing && (
            <div>
              <label className="block text-[9px] font-medium text-slate-400 mb-1.5">Category Name</label>
              <input
                type="text"
                value={cat.name || ""}
                onChange={(e) => setCat({ ...cat, name: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[11px] font-normal focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Category Name"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[9px] font-medium text-slate-400 mb-1.5">Type</label>
              <select
                value={cat.type}
                onChange={(e) => setCat({ ...cat, type: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[11px] font-normal focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="Merchant">Merchant</option>
                <option value="Service">Service</option>
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-medium text-slate-400 mb-1.5">Status</label>
              <select
                value={cat.status}
                onChange={(e) => setCat({ ...cat, status: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[11px] font-normal focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[9px] font-medium text-slate-400 mb-1.5">Position (Sorting)</label>
              <input
                type="number"
                value={cat.position || 0}
                onChange={(e) => setCat({ ...cat, position: parseInt(e.target.value) || 0 })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[11px] font-normal focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-[9px] font-medium text-slate-400 mb-1.5">Fixed Slots</label>
              <input
                type="number"
                value={cat.fixedSlots || 0}
                onChange={(e) => setCat({ ...cat, fixedSlots: parseInt(e.target.value) || 0 })}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[11px] font-normal focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="0"
              />
            </div>
          </div>

          <div>
            <label className="block text-[9px] font-medium text-slate-400 mb-1.5">Parent Category (Optional)</label>
            <select
              value={cat.parent_id || ""}
              onChange={(e) => setCat({ ...cat, parent_id: e.target.value || null })}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[11px] font-normal focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">None (Top Level)</option>
              {categories.filter(c => c.id !== cat.id && !c.parent_id).map(parent => (
                <option key={parent.id} value={parent.id}>{parent.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[9px] font-medium text-slate-400 mb-1.5">Category Banner</label>
            <div className="flex gap-3 items-center">
              <div className="flex-1 relative">
                <input
                  type="file"
                  onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'banner', isEditing)}
                  className="hidden"
                  id={`banner-upload-${isEditing ? 'edit' : 'new'}`}
                  disabled={uploading === 'banner'}
                />
                <label
                  htmlFor={`banner-upload-${isEditing ? 'edit' : 'new'}`}
                  className={`flex flex-col items-center justify-center gap-2 w-full bg-slate-50 border-2 border-dashed rounded-lg px-3 py-4 text-[10px] font-normal text-slate-500 cursor-pointer hover:bg-slate-100 transition-all group relative overflow-hidden ${uploading === 'banner'
                    ? 'border-primary/30 bg-primary/5 cursor-not-allowed'
                    : 'border-slate-200 hover:border-primary/30'
                    }`}
                >
                  {uploading === 'banner' ? (
                    <>
                      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-primary to-secondary h-1.5 rounded-full shadow-sm transition-all duration-300 ease-out"
                          style={{ width: `${uploadProgress.banner || 0}%` }}
                        />
                      </div>
                      <div className="flex items-center gap-1 text-[9px] font-medium text-primary tracking-wider">
                        <div className="w-2 h-2 bg-primary rounded-full"></div>
                        {uploadProgress.banner?.toFixed(0)}%
                      </div>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      <span>{cat.banner && cat.banner !== 'Not Set' ? 'Change' : 'Upload'} Banner</span>
                    </>
                  )}
                </label>
              </div>
              {cat.banner && cat.banner !== 'Not Set' && (
                <div className="w-16 h-12 rounded-lg overflow-hidden border border-slate-200 shadow-sm">
                  <img src={cat.banner} className="w-full h-full object-cover" alt="Banner" />
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-[9px] font-medium text-slate-400 mb-1.5">Category Symbol (Icon)</label>
            <div className="flex gap-3 items-center">
              <div className="flex-1 relative">
                <input
                  type="file"
                  onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], 'symbol', isEditing)}
                  className="hidden"
                  id={`symbol-upload-${isEditing ? 'edit' : 'new'}`}
                  disabled={uploading === 'symbol'}
                />
                <label
                  htmlFor={`symbol-upload-${isEditing ? 'edit' : 'new'}`}
                  className={`flex flex-col items-center justify-center gap-2 w-full bg-slate-50 border-2 border-dashed rounded-lg px-3 py-4 text-[10px] font-normal text-slate-500 cursor-pointer hover:bg-slate-100 transition-all group relative overflow-hidden ${uploading === 'symbol'
                      ? 'border-primary/30 bg-primary/5 cursor-not-allowed'
                      : 'border-slate-200 hover:border-primary/30'
                    }`}
                >
                  {uploading === 'symbol' ? (
                    <>
                      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-primary to-secondary h-1.5 rounded-full shadow-sm transition-all duration-300 ease-out"
                          style={{ width: `${uploadProgress.symbol || 0}%` }}
                        />
                      </div>
                      <div className="flex items-center gap-1 text-[9px] font-medium text-primary tracking-wider">
                        <div className="w-2 h-2 bg-primary rounded-full"></div>
                        {uploadProgress.symbol?.toFixed(0)}%
                      </div>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      <span>{cat.symbol && cat.symbol !== 'Not Set' ? 'Change' : 'Upload'} Symbol</span>
                    </>
                  )}
                </label>
              </div>
              {cat.symbol && cat.symbol !== 'Not Set' && (
                <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-200 shadow-sm flex items-center justify-center bg-slate-50">
                  <img src={cat.symbol} className="max-w-full max-h-full object-contain" alt="Symbol" />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <label className="block text-[9px] font-medium text-slate-400 mb-1.5">Fixed Partner Spots (Top 5)</label>
          {[1, 2, 3, 4, 5].map((pos) => {
            const field = `position_${pos}_business_id` as keyof Category;
            const currentId = (cat as any)[field] || "";
            const merchant = merchants.find(m => m.id === currentId);

            return (
              <div key={pos} className="relative space-y-1">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-medium text-primary w-4">#{pos}</span>
                  <div className="flex-1 flex gap-2">
                    <input
                      type="text"
                      value={merchantSearch[field] !== undefined ? merchantSearch[field] : (merchant ? merchant.name : currentId)}
                      onChange={(e) => setMerchantSearch({ ...merchantSearch, [field]: e.target.value })}
                      onFocus={() => setMerchantSearch({ ...merchantSearch, [field]: merchantSearch[field] || (merchant ? merchant.name : currentId) })}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-[10px] font-normal focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="Search Merchant Name or ID"
                    />
                    {currentId && (
                      <button
                        onClick={() => {
                          setCat({ ...cat, [field]: null });
                          setMerchantSearch({ ...merchantSearch, [field]: "" });
                        }}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {merchantSearch[field] && (
                  <div className="absolute z-10 left-7 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden max-h-40 overflow-y-auto">
                    {getFilteredMerchants(merchantSearch[field]).map(m => (
                      <button
                        key={m.id}
                        onClick={() => {
                          setCat({ ...cat, [field]: m.id });
                          setMerchantSearch({ ...merchantSearch, [field]: m.name });
                          // Small delay to hide results after selection
                          setTimeout(() => {
                            setMerchantSearch(prev => {
                              const next = { ...prev };
                              delete next[field];
                              return next;
                            });
                          }, 100);
                        }}
                        className="w-full text-left px-3 py-2 text-[10px] font-normal hover:bg-slate-50 flex flex-col border-b border-slate-50 last:border-0"
                      >
                        <span className="text-slate-900">{m.name}</span>
                        <span className="text-slate-400 text-[8px]">{m.id} • {m.category}</span>
                      </button>
                    ))}
                    {getFilteredMerchants(merchantSearch[field]).length === 0 && (
                      <div className="px-3 py-2 text-[10px] text-slate-400 italic">No merchants found</div>
                    )}
                  </div>
                )}
                {merchant && !merchantSearch[field] && (
                  <div className="ml-7 text-[8px] font-medium text-emerald-600 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Linked: {merchant.name}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-50">
        <button
          onClick={() => isEditing ? setEditingCategory(null) : setIsAddingCategory(false)}
          className="px-4 py-2 text-[10px] font-medium text-slate-500 hover:bg-slate-50 rounded-lg transition-all"
        >
          Cancel
        </button>
        <button
          onClick={isEditing ? handleSave : handleCreate}
          disabled={!cat.name || !!uploading}
          className="px-6 py-2 bg-primary text-white text-[10px] font-medium rounded-lg hover:bg-primary-700 transition-all disabled:opacity-50"
        >
          {isEditing ? "Save Changes" : "Create Category"}
        </button>
      </div>
    </div>
  );

  const topLevelCategories = categories.filter(c => !c.parent_id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
        <div>
          <h1 className="admin-page-title">Category Catalog</h1>
          <p className="admin-page-subtitle">Manage platform categories and service types.</p>
        </div>
        {!isAddingCategory && !editingCategory && (
          <button
            onClick={() => setIsAddingCategory(true)}
            className="px-4 py-2 bg-primary text-white text-[10px] font-medium rounded-xl hover:bg-primary-700 transition-all"
          >
            Add New Category
          </button>
        )}
      </div>

      {categoryError && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 flex items-center gap-3">
          <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-[10px] font-normal text-amber-800">{categoryError}</p>
        </div>
      )}

      {isAddingCategory && renderCategoryForm(newCategory, setNewCategory, false)}
      {editingCategory && renderCategoryForm(editingCategory, setEditingCategory, true)}

      {!isAddingCategory && !editingCategory && (
        <div className="space-y-8">
          {topLevelCategories.map(parent => (
            <div key={parent.id} className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-slate-200"></div>
                <h2 className="text-[10px] font-medium text-slate-400 tracking-[0.3em]">{parent.name} Group</h2>
                <div className="h-px flex-1 bg-slate-200"></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {/* Parent Card */}
                <CategoryCard cat={parent} onEdit={setEditingCategory} isParent />

                {/* Children Cards */}
                {categories.filter(c => c.parent_id === parent.id).map(child => (
                  <CategoryCard key={child.id} cat={child} onEdit={setEditingCategory} />
                ))}
              </div>
            </div>
          ))}

          {/* Uncategorized / Lone categories */}
          {categories.length > 0 && topLevelCategories.length === 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {categories.map(cat => (
                <CategoryCard key={cat.id} cat={cat} onEdit={setEditingCategory} />
              ))}
            </div>
          )}

          {categories.length === 0 && !categoryError && (
            <div className="py-24 flex flex-col items-center opacity-30 bg-white rounded-xl border border-slate-200/60">
              <div className="w-16 h-16 rounded-xl bg-slate-50 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </div>
              <p className="text-[10px] font-medium tracking-[0.3em] text-slate-400">No categories defined</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CategoryCard({ cat, onEdit, isParent }: { cat: Category, onEdit: (c: Category) => void, isParent?: boolean }) {
  return (
    <div className={`bg-white rounded-2xl border ${isParent ? 'border-primary/20 shadow-primary/5' : 'border-slate-200/60'} p-5 shadow-sm hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 group relative overflow-hidden`}>
      {isParent && (
        <div className="absolute top-0 right-0 px-3 py-1 bg-primary/10 rounded-bl-xl">
          <span className="text-[7px] font-medium text-primary">Parent</span>
        </div>
      )}
      <div className="flex justify-between items-start mb-4">
        <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-primary font-medium border border-slate-200 transition-all shadow-sm overflow-hidden">
          {cat.symbol && cat.symbol !== 'Not Set' ? (
            <img src={cat.symbol} className="max-w-[70%] max-h-[70%] object-contain" alt="" />
          ) : cat.banner && cat.banner !== 'Not Set' ? (
            <img src={cat.banner} className="w-full h-full object-cover" alt="" />
          ) : (
            cat.name[0]
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onEdit(cat)}
            className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
            title="Edit Category"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <span className={`px-2 py-0.5 rounded-lg text-[8px] font-medium uppercase tracking-widest border ${cat.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
            {cat.status}
          </span>
        </div>
      </div>
      <h3 className="text-sm font-medium text-slate-900 tracking-tight">{cat.name}</h3>
      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-50">
        <div className="flex flex-col">
          <span className="text-[8px] font-medium text-slate-400">Partners</span>
          <span className="text-xs font-medium text-primary tabular-nums">{cat.items}</span>
        </div>
        <div className="w-px h-6 bg-slate-100"></div>
        <div className="flex flex-col">
          <span className="text-[8px] font-medium text-slate-400">Type</span>
          <span className="text-[10px] font-medium text-secondary">{cat.type}</span>
        </div>
        <div className="w-px h-6 bg-slate-100"></div>
        <div className="flex flex-col">
          <span className="text-[8px] font-medium text-slate-400">Pos</span>
          <span className="text-[10px] font-medium text-slate-600 tabular-nums">#{cat.position || 0}</span>
        </div>
      </div>
    </div>
  );
}

function MoviesContent({ movies, setMovies, onUpdateMovie, onCreateMovie, onDeleteMovie }: {
  movies: Movie[],
  setMovies: Dispatch<SetStateAction<Movie[]>>,
  onUpdateMovie: (movie: Partial<Movie>) => Promise<void>,
  onCreateMovie: (movie: Partial<Movie>) => Promise<void>,
  onDeleteMovie: (id: string) => Promise<void>
}) {
  const [editingMovie, setEditingMovie] = useState<Movie | null>(null);
  const [isAddingMovie, setIsAddingMovie] = useState(false);
  const [newMovie, setNewMovie] = useState<Partial<Movie>>({
    name: "",
    description: "",
    finderb_rating: 0,
    release_date: new Date().toISOString().split('T')[0],
    poster_url: "",
  });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleSave = async () => {
    if (editingMovie) {
      await onUpdateMovie(editingMovie);
      setEditingMovie(null);
    }
  };

  const handleCreate = async () => {
    if (newMovie.name) {
      await onCreateMovie(newMovie);
      setIsAddingMovie(false);
      setNewMovie({
        name: "",
        description: "",
        finderb_rating: 0,
        release_date: new Date().toISOString().split('T')[0],
        poster_url: "",
      });
    }
  };

  const handleImageUpload = async (file: File, isEditing: boolean) => {
    try {
      setUploading(true);
      const url = await uploadToCloudinary(file, (progress) => {
        setUploadProgress(progress);
      });
      
      if (isEditing && editingMovie) {
        setEditingMovie({ ...editingMovie, poster_url: url });
      } else {
        setNewMovie({ ...newMovie, poster_url: url });
      }
    } catch (error) {
      alert("Upload failed: " + (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const renderMovieForm = (movie: Partial<Movie>, setMovie: Dispatch<SetStateAction<any>>, isEditing: boolean) => (
    <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-8 space-y-6 mb-8 animate-in slide-in-from-top-4 duration-300">
      <div className="flex items-center justify-between border-b border-slate-50 pb-5">
        <h3 className="text-sm font-medium text-slate-900 flex items-center gap-2">
          <span className="w-2 h-2 bg-primary rounded-full"></span>
          {isEditing ? `Edit: ${movie.name}` : "Add New Movie"}
        </h3>
        <button 
          onClick={() => isEditing ? setEditingMovie(null) : setIsAddingMovie(false)}
          className="text-slate-400 hover:text-slate-600 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-[9px] font-medium text-slate-400 mb-1.5">Movie Name</label>
            <input
              type="text"
              value={movie.name}
              onChange={(e) => setMovie({ ...movie, name: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[11px] font-normal text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              placeholder="Enter movie name"
            />
          </div>

          <div>
            <label className="block text-[9px] font-medium text-slate-400 mb-1.5">Description</label>
            <textarea
              value={movie.description}
              onChange={(e) => setMovie({ ...movie, description: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[11px] font-normal text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all min-h-[100px]"
              placeholder="Enter movie description"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[9px] font-medium text-slate-400 mb-1.5">FinderB Rating</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="10"
                value={movie.finderb_rating}
                onChange={(e) => setMovie({ ...movie, finderb_rating: parseFloat(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[11px] font-normal text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-[9px] font-medium text-slate-400 mb-1.5">Release Date</label>
              <input
                type="date"
                value={movie.release_date}
                onChange={(e) => setMovie({ ...movie, release_date: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[11px] font-normal text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[9px] font-medium text-slate-400 mb-1.5">Movie Poster</label>
            <div className="flex gap-4 items-start">
              <div className="flex-1 relative">
                <input
                  type="file"
                  onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], isEditing)}
                  className="hidden"
                  id={`poster-upload-${isEditing ? 'edit' : 'new'}`}
                  disabled={uploading}
                />
                <label
                  htmlFor={`poster-upload-${isEditing ? 'edit' : 'new'}`}
                  className={`flex flex-col items-center justify-center gap-2 w-full aspect-[2/3] bg-slate-50 border-2 border-dashed rounded-2xl p-4 text-[10px] font-normal text-slate-500 cursor-pointer hover:bg-slate-100 transition-all group relative overflow-hidden ${uploading
                      ? 'border-primary/30 bg-primary/5 cursor-not-allowed'
                      : 'border-slate-200 hover:border-primary/30'
                    }`}
                >
                  {uploading ? (
                    <div className="flex flex-col items-center gap-3 w-full px-4">
                      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-primary h-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <span className="text-primary font-medium">{uploadProgress}% Uploading...</span>
                    </div>
                  ) : movie.poster_url ? (
                    <img src={movie.poster_url} className="w-full h-full object-cover rounded-xl" alt="Poster Preview" />
                  ) : (
                    <>
                      <svg className="w-8 h-8 text-slate-300 transition-transform mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      <span className="text-center">Click to Upload Movie Poster</span>
                    </>
                  )}
                </label>
              </div>
              {movie.poster_url && !uploading && (
                <button 
                  onClick={() => setMovie({ ...movie, poster_url: "" })}
                  className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all border border-transparent hover:border-rose-100"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-50">
        <button
          onClick={() => isEditing ? setEditingMovie(null) : setIsAddingMovie(false)}
          className="px-6 py-2.5 text-[10px] font-medium text-slate-500 hover:bg-slate-50 rounded-xl transition-all"
        >
          Cancel
        </button>
        <button
          onClick={isEditing ? handleSave : handleCreate}
          disabled={!movie.name || uploading}
          className="px-8 py-2.5 bg-primary text-white text-[10px] font-medium rounded-xl hover:bg-primary-700 shadow-xl shadow-primary/20 transition-all disabled:opacity-50"
        >
          {isEditing ? "Save Changes" : "Save Movie"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
        <div>
          <h1 className="admin-page-title">Movie Library</h1>
          <p className="admin-page-subtitle">Manage platform movies and ratings.</p>
        </div>
        {!isAddingMovie && !editingMovie && (
          <button
            onClick={() => setIsAddingMovie(true)}
            className="px-4 py-2 bg-primary text-white text-[10px] font-medium rounded-xl hover:bg-primary-700 transition-all"
          >
            Add New Movie
          </button>
        )}
      </div>

      {isAddingMovie && renderMovieForm(newMovie, setNewMovie, false)}
      {editingMovie && renderMovieForm(editingMovie, setEditingMovie, true)}

      {!isAddingMovie && !editingMovie && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {movies.map((movie) => (
            <div key={movie.id} className="bg-white rounded-xl border border-slate-200/60 p-4 shadow-sm transition-all duration-300 group">
              <div className="relative aspect-[2/3] rounded-xl overflow-hidden mb-4 bg-slate-100">
                {movie.poster_url ? (
                  <img src={movie.poster_url} className="w-full h-full object-cover transition-transform duration-500" alt={movie.name} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center opacity-20">
                    <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                    </svg>
                  </div>
                )}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setEditingMovie(movie)}
                    className="p-1.5 bg-white/90 backdrop-blur-sm text-slate-600 hover:text-primary rounded-lg shadow-lg transition-all"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => onDeleteMovie(movie.id)}
                    className="p-1.5 bg-white/90 backdrop-blur-sm text-slate-600 hover:text-rose-500 rounded-lg shadow-lg transition-all"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
                <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 backdrop-blur-sm text-white rounded-lg flex items-center gap-1.5">
                  <svg className="w-2.5 h-2.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="text-[9px] font-medium">{movie.finderb_rating?.toFixed(1) || '0.0'}</span>
                </div>
              </div>
              <h3 className="text-[11px] font-medium text-slate-900 tracking-tight truncate mb-1">{movie.name}</h3>
              <p className="text-[9px] text-slate-500 font-normal">{new Date(movie.release_date).getFullYear() || 'TBA'}</p>
            </div>
          ))}

          {movies.length === 0 && (
            <div className="col-span-full py-24 flex flex-col items-center opacity-30 bg-white rounded-xl border border-slate-200/60">
              <div className="w-16 h-16 rounded-xl bg-slate-50 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                </svg>
              </div>
              <p className="text-[10px] font-medium tracking-[0.3em] text-slate-400">No movies found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BroadcastsContent({ 
  title, setTitle, 
  message, setMessage, 
  audiences, setAudiences 
}: {
  title: string,
  setTitle: (t: string) => void,
  message: string,
  setMessage: (m: string) => void,
  audiences: string[],
  setAudiences: (a: string[]) => void
}) {
  const [isSending, setIsSending] = useState(false);
  const [pastBroadcasts, setPastBroadcasts] = useState<any[]>([]);
  const AUDIENCE_OPTIONS = ["Users", "Merchants", "Service Providers"];

  useEffect(() => {
    fetchPastBroadcasts();
  }, []);

  const fetchPastBroadcasts = async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('broadcasts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    if (!error && data) setPastBroadcasts(data);
  };

  const toggleAudience = (opt: string) => {
    if (audiences.includes(opt)) {
      setAudiences(audiences.filter(a => a !== opt));
    } else {
      setAudiences([...audiences, opt]);
    }
  };

  const handleDispatch = async () => {
    if (!title.trim() || !message.trim() || audiences.length === 0) {
      alert("Please fill in all fields and select at least one audience.");
      return;
    }

    try {
      setIsSending(true);
      const supabase = createClient();
      const { error } = await supabase
        .from('broadcasts')
        .insert({
          title,
          message,
          target_audience: audiences
        });

      if (error) throw error;

      alert("Broadcast dispatched successfully!");
      setTitle("");
      setMessage("");
      fetchPastBroadcasts();
    } catch (err: any) {
      alert("Error dispatching broadcast: " + err.message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="space-y-6">
        <div className="flex flex-col gap-1.5 px-1">
          <h1 className="admin-page-title">Global Broadcast</h1>
          <p className="admin-page-subtitle">Push announcements and updates to platform users.</p>
        </div>

        <div className="bg-white border border-slate-200/60 rounded-xl shadow-sm p-8 space-y-6">
          <div>
            <label className="block text-[9px] font-medium text-slate-400 tracking-[0.2em] mb-2.5">Broadcast Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ENTER TITLE..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[11px] font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-slate-300"
            />
          </div>

          <div>
            <label className="block text-[9px] font-medium text-slate-400 tracking-[0.2em] mb-2.5">Target Audience</label>
            <div className="flex flex-wrap gap-3">
              {AUDIENCE_OPTIONS.map(opt => (
                <label key={opt} className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:border-primary/30 transition-all">
                  <input
                    type="checkbox"
                    checked={audiences.includes(opt)}
                    onChange={() => toggleAudience(opt)}
                    className="w-4 h-4 rounded text-primary focus:ring-primary/20"
                  />
                  <span className="text-[10px] font-medium text-slate-600">{opt}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[9px] font-medium text-slate-400 tracking-[0.2em] mb-2.5">Announcement Content</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="TYPE YOUR MESSAGE HERE..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[11px] font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all min-h-[160px] placeholder:text-slate-300"
            />
          </div>

          <button
            onClick={handleDispatch}
            disabled={isSending}
            className="w-full py-4 bg-primary text-white text-[10px] font-medium rounded-xl hover:bg-primary-700 transition-all active:scale-[0.98] tracking-[0.2em] disabled:opacity-50"
          >
            {isSending ? "Dispatching..." : "Dispatch Announcement"}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex flex-col gap-1.5 px-1">
          <h1 className="admin-page-title">Recent History</h1>
          <p className="admin-page-subtitle">View previously dispatched announcements.</p>
        </div>

        <div className="bg-white border border-slate-200/60 rounded-xl shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-50">
            {pastBroadcasts.length > 0 ? (
              pastBroadcasts.map((b) => (
                <div key={b.id} className="p-6 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-primary">
                      {b.target_audience?.join(" & ")}
                    </span>
                    <span className="text-[9px] text-slate-400 font-medium tabular-nums">
                      {new Date(b.created_at).toLocaleString()}
                    </span>
                  </div>
                  <h3 className="text-[11px] font-semibold text-slate-900 tracking-tight mb-1">{b.title}</h3>
                  <p className="text-[10px] text-slate-600 line-clamp-2 leading-relaxed">{b.message}</p>
                </div>
              ))
            ) : (
              <div className="p-12 text-center">
                <p className="text-[10px] text-slate-400">No broadcast history found</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


function TouristPlacesContent({ places, onUpdatePlace, onCreatePlace, onDeletePlace }: {
  places: TouristPlace[],
  onUpdatePlace: (place: Partial<TouristPlace>) => Promise<void>,
  onCreatePlace: (place: Partial<TouristPlace>) => Promise<void>,
  onDeletePlace: (id: string) => Promise<void>
}) {
  const [editingPlace, setEditingPlace] = useState<TouristPlace | null>(null);
  const [isAddingPlace, setIsAddingPlace] = useState(false);
  const [newPlace, setNewPlace] = useState<Partial<TouristPlace>>({
    name: "",
    description: "",
    location: "",
    category: "",
    image_url: "",
  });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleSave = async () => {
    if (editingPlace) {
      await onUpdatePlace(editingPlace);
      setEditingPlace(null);
    }
  };

  const handleCreate = async () => {
    if (newPlace.name) {
      await onCreatePlace(newPlace);
      setIsAddingPlace(false);
      setNewPlace({
        name: "",
        description: "",
        location: "",
        category: "",
        image_url: "",
      });
    }
  };

  const handleImageUpload = async (file: File, isEditing: boolean) => {
    try {
      setUploading(true);
      const url = await uploadToCloudinary(file, (progress) => {
        setUploadProgress(progress);
      });
      if (isEditing && editingPlace) {
        setEditingPlace({ ...editingPlace, image_url: url });
      } else {
        setNewPlace({ ...newPlace, image_url: url });
      }
    } catch (error) {
      alert("Upload failed: " + (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const renderPlaceForm = (place: Partial<TouristPlace>, setPlace: Dispatch<SetStateAction<any>>, isEditing: boolean) => (
    <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-8 space-y-6 mb-8 animate-in slide-in-from-top-4 duration-300">
      <div className="flex items-center justify-between border-b border-slate-50 pb-5">
        <h3 className="text-sm font-medium text-slate-900 flex items-center gap-2">
          <span className="w-2 h-2 bg-primary rounded-full"></span>
          {isEditing ? `Edit: ${place.name}` : "Add New Tourist Place"}
        </h3>
        <button onClick={() => isEditing ? setEditingPlace(null) : setIsAddingPlace(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-[9px] font-medium text-slate-400 mb-1.5">Place Name</label>
            <input type="text" value={place.name || ""} onChange={(e) => setPlace({ ...place, name: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[11px] font-normal text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" placeholder="Enter place name" />
          </div>
          <div>
            <label className="block text-[9px] font-medium text-slate-400 mb-1.5">Location (City, State)</label>
            <input type="text" value={place.location || ""} onChange={(e) => setPlace({ ...place, location: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[11px] font-normal text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" placeholder="e.g. Jaipur, Rajasthan" />
          </div>
          <div>
            <label className="block text-[9px] font-medium text-slate-400 mb-1.5">Category</label>
            <input type="text" value={place.category || ""} onChange={(e) => setPlace({ ...place, category: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[11px] font-normal text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" placeholder="e.g. Historical, Nature" />
          </div>
          <div>
            <label className="block text-[9px] font-medium text-slate-400 mb-1.5">Description</label>
            <textarea value={place.description || ""} onChange={(e) => setPlace({ ...place, description: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[11px] font-normal text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all min-h-[100px]" placeholder="Enter description" />
          </div>
        </div>

        <div className="space-y-4">
          <label className="block text-[9px] font-medium text-slate-400 mb-1.5">Place Image</label>
          <div className="flex gap-4 items-start">
            <div className="flex-1 relative">
              <input type="file" onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], isEditing)} className="hidden" id={`tp-upload-${isEditing ? 'edit' : 'new'}`} disabled={uploading} />
              <label htmlFor={`tp-upload-${isEditing ? 'edit' : 'new'}`} className={`flex flex-col items-center justify-center gap-2 w-full aspect-video bg-slate-50 border-2 border-dashed rounded-2xl p-4 text-[10px] font-normal text-slate-500 cursor-pointer hover:bg-slate-100 transition-all group relative overflow-hidden ${uploading ? 'border-primary/30 bg-primary/5 cursor-not-allowed' : 'border-slate-200 hover:border-primary/30'}`}>
                {uploading ? (
                  <div className="flex flex-col items-center gap-3 w-full px-4">
                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-primary h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                    </div>
                    <span className="text-primary font-medium">{uploadProgress}% Uploading...</span>
                  </div>
                ) : place.image_url ? (
                  <img src={place.image_url} className="w-full h-full object-cover rounded-xl" alt="Preview" />
                ) : (
                  <div className="flex flex-col items-center">
                    <svg className="w-8 h-8 text-slate-300 transition-transform mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    <span className="text-center">Click to Upload Image</span>
                  </div>
                )}
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-50">
        <button onClick={() => isEditing ? setEditingPlace(null) : setIsAddingPlace(false)} className="px-6 py-2.5 text-[10px] font-medium text-slate-500 hover:bg-slate-50 rounded-xl transition-all">Cancel</button>
        <button onClick={isEditing ? handleSave : handleCreate} disabled={!place.name || uploading} className="px-8 py-2.5 bg-primary text-white text-[10px] font-medium rounded-xl hover:bg-primary-700 shadow-xl shadow-primary/20 transition-all disabled:opacity-50">{isEditing ? "Save Changes" : "Save Place"}</button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
        <div>
          <h1 className="admin-page-title">Tourist Places in India</h1>
          <p className="admin-page-subtitle">Manage tourist attractions and locations.</p>
        </div>
        {!isAddingPlace && !editingPlace && (
          <button onClick={() => setIsAddingPlace(true)} className="px-4 py-2 bg-primary text-white text-[10px] font-medium rounded-xl hover:bg-primary-700 transition-all">Add New Place</button>
        )}
      </div>

      {isAddingPlace && renderPlaceForm(newPlace, setNewPlace, false)}
      {editingPlace && renderPlaceForm(editingPlace, setEditingPlace, true)}

      {!isAddingPlace && !editingPlace && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {places.map((place) => (
            <div key={place.id} className="bg-white rounded-xl border border-slate-200/60 p-4 shadow-sm transition-all duration-300 group">
              <div className="relative aspect-video rounded-xl overflow-hidden mb-4 bg-slate-100">
                {place.image_url ? (
                  <img src={place.image_url} className="w-full h-full object-cover transition-transform duration-500" alt={place.name} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center opacity-20">
                    <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  </div>
                )}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setEditingPlace(place)} className="p-1.5 bg-white/90 backdrop-blur-sm text-slate-600 hover:text-primary rounded-lg shadow-lg transition-all">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </button>
                  <button onClick={() => onDeletePlace(place.id)} className="p-1.5 bg-white/90 backdrop-blur-sm text-slate-600 hover:text-rose-50 rounded-lg shadow-lg transition-all">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
              <h3 className="text-[11px] font-medium text-slate-900 tracking-tight truncate mb-1">{place.name}</h3>
              <p className="text-[9px] text-secondary font-medium mb-1">{place.location}</p>
              <p className="text-[9px] text-slate-400 font-normal line-clamp-2">{place.description}</p>
            </div>
          ))}

          {places.length === 0 && (
            <div className="col-span-full py-24 flex flex-col items-center opacity-30 bg-white rounded-xl border border-slate-200/60">
              <div className="w-16 h-16 rounded-xl bg-slate-50 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </div>
              <p className="text-[10px] font-medium tracking-[0.3em] text-slate-400">No tourist places found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NewsContent({ news, onUpdateNews, onCreateNews, onDeleteNews }: {
  news: News[],
  onUpdateNews: (item: Partial<News>) => Promise<void>,
  onCreateNews: (item: Partial<News>) => Promise<void>,
  onDeleteNews: (id: string) => Promise<void>
}) {
  const [editingNews, setEditingNews] = useState<News | null>(null);
  const [isAddingNews, setIsAddingNews] = useState(false);
  const [newItem, setNewItem] = useState<Partial<News>>({
    title: "",
    content: "",
    author: "",
    image_url: "",
    published_at: new Date().toISOString().split('T')[0],
  });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleSave = async () => {
    if (editingNews) {
      await onUpdateNews(editingNews);
      setEditingNews(null);
    }
  };

  const handleCreate = async () => {
    if (newItem.title && newItem.content) {
      await onCreateNews(newItem);
      setIsAddingNews(false);
      setNewItem({
        title: "",
        content: "",
        author: "",
        image_url: "",
        published_at: new Date().toISOString().split('T')[0],
      });
    }
  };

  const handleImageUpload = async (file: File, isEditing: boolean) => {
    try {
      setUploading(true);
      const url = await uploadToCloudinary(file, (progress) => {
        setUploadProgress(progress);
      });
      if (isEditing && editingNews) {
        setEditingNews({ ...editingNews, image_url: url });
      } else {
        setNewItem({ ...newItem, image_url: url });
      }
    } catch (error) {
      alert("Upload failed: " + (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const renderNewsForm = (item: Partial<News>, setItem: Dispatch<SetStateAction<any>>, isEditing: boolean) => (
    <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-8 space-y-6 mb-8 animate-in slide-in-from-top-4 duration-300">
      <div className="flex items-center justify-between border-b border-slate-50 pb-5">
        <h3 className="text-sm font-medium text-slate-900 flex items-center gap-2">
          <span className="w-2 h-2 bg-primary rounded-full"></span>
          {isEditing ? `Edit: ${item.title}` : "Add New News Item"}
        </h3>
        <button onClick={() => isEditing ? setEditingNews(null) : setIsAddingNews(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-[9px] font-medium text-slate-400 mb-1.5">Title</label>
            <input type="text" value={item.title || ""} onChange={(e) => setItem({ ...item, title: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[11px] font-normal text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" placeholder="Enter news title" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[9px] font-medium text-slate-400 mb-1.5">Author</label>
              <input type="text" value={item.author || ""} onChange={(e) => setItem({ ...item, author: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[11px] font-normal text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" placeholder="Author name" />
            </div>
            <div>
              <label className="block text-[9px] font-medium text-slate-400 mb-1.5">Published Date</label>
              <input type="date" value={item.published_at ? item.published_at.split('T')[0] : ""} onChange={(e) => setItem({ ...item, published_at: new Date(e.target.value).toISOString() })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[11px] font-normal text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
            </div>
          </div>
          <div>
            <label className="block text-[9px] font-medium text-slate-400 mb-1.5">Content</label>
            <textarea value={item.content || ""} onChange={(e) => setItem({ ...item, content: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[11px] font-normal text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all min-h-[200px]" placeholder="Enter news content" />
          </div>
        </div>

        <div className="space-y-4">
          <label className="block text-[9px] font-medium text-slate-400 mb-1.5">News Image</label>
          <div className="flex gap-4 items-start">
            <div className="flex-1 relative">
              <input type="file" onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], isEditing)} className="hidden" id={`news-upload-${isEditing ? 'edit' : 'new'}`} disabled={uploading} />
              <label htmlFor={`news-upload-${isEditing ? 'edit' : 'new'}`} className={`flex flex-col items-center justify-center gap-2 w-full aspect-video bg-slate-50 border-2 border-dashed rounded-2xl p-4 text-[10px] font-normal text-slate-500 cursor-pointer hover:bg-slate-100 transition-all group relative overflow-hidden ${uploading ? 'border-primary/30 bg-primary/5 cursor-not-allowed' : 'border-slate-200 hover:border-primary/30'}`}>
                {uploading ? (
                  <div className="flex flex-col items-center gap-3 w-full px-4">
                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-primary h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                    </div>
                    <span className="text-primary font-medium">{uploadProgress}% Uploading...</span>
                  </div>
                ) : item.image_url ? (
                  <img src={item.image_url} className="w-full h-full object-cover rounded-xl" alt="Preview" />
                ) : (
                  <div className="flex flex-col items-center">
                    <svg className="w-8 h-8 text-slate-300 transition-transform mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    <span className="text-center">Click to Upload Image</span>
                  </div>
                )}
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-50">
        <button onClick={() => isEditing ? setEditingNews(null) : setIsAddingNews(false)} className="px-6 py-2.5 text-[10px] font-medium text-slate-500 hover:bg-slate-50 rounded-xl transition-all">Cancel</button>
        <button onClick={isEditing ? handleSave : handleCreate} disabled={!item.title || !item.content || uploading} className="px-8 py-2.5 bg-primary text-white text-[10px] font-medium rounded-xl hover:bg-primary-700 shadow-xl shadow-primary/20 transition-all disabled:opacity-50">{isEditing ? "Save Changes" : "Save News"}</button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
        <div>
          <h1 className="admin-page-title">News Management</h1>
          <p className="admin-page-subtitle">Manage and publish news articles.</p>
        </div>
        {!isAddingNews && !editingNews && (
          <button onClick={() => setIsAddingNews(true)} className="px-4 py-2 bg-primary text-white text-[10px] font-medium rounded-xl hover:bg-primary-700 transition-all">Add News Item</button>
        )}
      </div>

      {isAddingNews && renderNewsForm(newItem, setNewItem, false)}
      {editingNews && renderNewsForm(editingNews, setEditingNews, true)}

      {!isAddingNews && !editingNews && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {news.map((item) => (
            <div key={item.id} className="bg-white rounded-xl border border-slate-200/60 p-4 shadow-sm transition-all duration-300 group">
              <div className="relative aspect-video rounded-xl overflow-hidden mb-4 bg-slate-100">
                {item.image_url ? (
                  <img src={item.image_url} className="w-full h-full object-cover transition-transform duration-500" alt={item.title} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center opacity-20">
                    <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 12a2 2 0 002-2V9a2 2 0 00-2-2h-2.5" /></svg>
                  </div>
                )}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setEditingNews(item)} className="p-1.5 bg-white/90 backdrop-blur-sm text-slate-600 hover:text-primary rounded-lg shadow-lg transition-all">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </button>
                  <button onClick={() => onDeleteNews(item.id)} className="p-1.5 bg-white/90 backdrop-blur-sm text-slate-600 hover:text-rose-500 rounded-lg shadow-lg transition-all">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
              <h3 className="text-[11px] font-medium text-slate-900 tracking-tight truncate mb-1">{item.title}</h3>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[9px] text-secondary font-medium">{item.author || 'FinderB'}</p>
                <p className="text-[9px] text-slate-400 font-normal">{item.published_at ? new Date(item.published_at).toLocaleDateString() : 'Draft'}</p>
              </div>
              <p className="text-[9px] text-slate-500 font-normal line-clamp-3">{item.content}</p>
            </div>
          ))}

          {news.length === 0 && (
            <div className="col-span-full py-24 flex flex-col items-center opacity-30 bg-white rounded-xl border border-slate-200/60">
              <div className="w-16 h-16 rounded-xl bg-slate-50 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 12a2 2 0 002-2V9a2 2 0 00-2-2h-2.5" /></svg>
              </div>
              <p className="text-[10px] font-medium tracking-[0.3em] text-slate-400">No news articles found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
