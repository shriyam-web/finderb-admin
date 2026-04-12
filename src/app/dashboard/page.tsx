"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, Dispatch, SetStateAction, useEffect } from "react";
import { createClient } from "../../../utils/supabase/client";

interface User {
  id: number;
  name: string;
  email: string;
  status: string;
  joined: string;
}

interface Merchant {
  id: string;
  name: string;
  category: string;
  rating: number;
  sales: number;
  validUntil: string;
}

interface MerchantRequest {
  id: string;
  name: string;
  category: string;
  date: string;
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
  kycStatus: string;
  hasVerifiedBadge: boolean;
  paymentStatus: string;
  paymentId: string | null;
  orderId: string | null;
  createdAt: string;
  updatedAt: string;
  city: string | null;
  email: string | null;
  password: string | null;
  state: string | null;
}

interface Category {
  name: string;
  items: number;
  status: string;
  banner: string;
  fixedSlots: number;
  type: 'Merchant' | 'Service';
  position_1_business_id?: string | null;
  position_2_business_id?: string | null;
  position_3_business_id?: string | null;
  position_4_business_id?: string | null;
  position_5_business_id?: string | null;
}

interface Settings {
  maintenance: boolean;
  expressApproval: boolean;
  notifications: boolean;
  twoFactor: boolean;
  publicProfile: boolean;
  [key: string]: boolean;
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // --- Global State for Functionalities ---
  const [settings, setSettings] = useState<Settings>({
    maintenance: false,
    expressApproval: true,
    notifications: true,
    twoFactor: false,
    publicProfile: true,
  });

  const [users, setUsers] = useState<User[]>([]);
  const [activeMerchants, setActiveMerchants] = useState<Merchant[]>([]);
  const [merchantRequests, setMerchantRequests] = useState<MerchantRequest[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setDataLoading(true);
        setFetchError(null);

        const supabase = createClient();

        console.log("🚀 Fetching categories from Supabase...");
        const { data: catData, error: catError } = await supabase.from('categories').select('*');

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
            name: c.name,
            items: c.items_count || 0,
            status: c.status || 'Active',
            banner: c.banner || 'Not Set',
            fixedSlots: c.fixed_slots || 0,
            type: c.type || 'Merchant',
            position_1_business_id: c.position_1_business_id,
            position_2_business_id: c.position_2_business_id,
            position_3_business_id: c.position_3_business_id,
            position_4_business_id: c.position_4_business_id,
            position_5_business_id: c.position_5_business_id
          })));
        }

        console.log("🚀 Fetching business data from Supabase...");
        const { data: merchantData, error: merchantError } = await supabase.from('Business').select('*');

        if (merchantError) {
          console.error("❌ Business fetch error:", merchantError);
          setFetchError(`Failed to fetch business data: ${merchantError.message}`);
        } else {
          console.log("✅ Business data fetched:", merchantData?.length || 0);
          if (merchantData && merchantData.length > 0) {
            setActiveMerchants(merchantData
              .filter((m: any) => m.kycStatus !== 'pending' && m.kycStatus !== 'rejected')
              .map((m: any) => ({
                id: m.id,
                name: m.businessName || m.fullName || 'Unknown Merchant',
                category: m.category || 'Other',
                rating: 0,
                sales: 0,
                validUntil: new Date(m.updatedAt || m.createdAt || Date.now()).toISOString().split('T')[0]
              })));
            setMerchantRequests(merchantData
              .filter((m: any) => m.kycStatus === 'pending')
              .map((m: any) => ({
                id: m.id,
                name: m.businessName || m.fullName || 'Unknown Merchant',
                category: m.category || 'Other',
                date: new Date(m.createdAt || Date.now()).toLocaleDateString()
              })));
          } else {
            console.warn("⚠️ No business data returned from Supabase");
          }
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

  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastAudience, setBroadcastAudience] = useState("Everyone");

  const menuItems = [
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
      name: "Categories", icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
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
      name: "Settings", icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    },
  ];

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
        category: req.category,
        rating: 0,
        sales: 0,
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
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

  const handleUpdateCategory = async (catName: string, updates: Partial<Category>) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('categories')
      .update({
        banner: updates.banner,
        position_1_business_id: updates.position_1_business_id,
        position_2_business_id: updates.position_2_business_id,
        position_3_business_id: updates.position_3_business_id,
        position_4_business_id: updates.position_4_business_id,
        position_5_business_id: updates.position_5_business_id,
      })
      .eq('name', catName);

    if (error) {
      alert("Error updating category: " + error.message);
      return;
    }

    setCategories(prev => prev.map(c => c.name === catName ? { ...c, ...updates } : c));
    alert(`Category ${catName} updated successfully!`);
  };

  const renderContent = () => {
    switch (activeTab) {
      case "Dashboard":
        return <DashboardContent
          setActiveTab={setActiveTab}
          merchantRequests={merchantRequests}
          handleApprove={handleDashboardApprove}
          handleReject={handleDashboardReject}
        />;
      case "Users":
        return <UsersContent users={users} setUsers={setUsers} />;
      case "Merchants":
        return (
          <MerchantsContent
            activeMerchants={activeMerchants}
            setActiveMerchants={setActiveMerchants}
            merchantRequests={merchantRequests}
            setMerchantRequests={setMerchantRequests}
          />
        );
      case "Categories":
        return <CategoriesContent categories={categories} setCategories={setCategories} categoryError={categoryError} onUpdateCategory={handleUpdateCategory} />;
      case "Payments & Subscriptions":
        return <PaymentsContent />;
      case "Broadcasts":
        return (
          <BroadcastsContent
            message={broadcastMessage}
            setMessage={setBroadcastMessage}
            audience={broadcastAudience}
            setAudience={setBroadcastAudience}
          />
        );
      case "Settings":
        return <SettingsContent settings={settings} setSettings={setSettings} />;
      default:
        return <DashboardContent
          setActiveTab={setActiveTab}
          merchantRequests={merchantRequests}
          handleApprove={handleDashboardApprove}
          handleReject={handleDashboardReject}
        />;
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] font-sans text-slate-900">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <aside className={`w-64 bg-sidebar-background border-r border-slate-200 flex flex-col fixed inset-y-0 z-50 transition-all duration-300 ease-in-out transform ${isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} lg:shadow-none`}>
        {/* Header */}
        <div className="h-16 flex items-center px-6 gap-3 border-b border-slate-100/50">
          <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
            <Image
              src="/logo1.png"
              alt="FinderB Logo"
              width={140}
              height={40}
              className="object-contain"
              priority
            />
          </Link>

          {/* Close Button for Mobile */}
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="ml-auto p-1.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-md transition-all lg:hidden"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 mt-6 px-4 space-y-1.5 overflow-y-auto custom-scrollbar">
          {menuItems.map((item) => (
            <button
              key={item.name}
              onClick={() => {
                setActiveTab(item.name);
                setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-[11px] font-bold rounded-xl transition-all duration-200 group relative ${activeTab === item.name
                ? "bg-primary text-white shadow-lg shadow-primary/25"
                : "text-sidebar-foreground hover:bg-primary/5 hover:text-primary"
                }`}
            >
              {activeTab === item.name && (
                <div className="absolute left-0 w-1 h-4 bg-secondary rounded-r-full"></div>
              )}
              <span className={`shrink-0 transition-all duration-200 ${activeTab === item.name ? "text-secondary scale-110" : "text-slate-400 group-hover:text-primary group-hover:scale-110"
                }`}>
                {item.icon}
              </span>
              <span className="tracking-tight">{item.name}</span>
            </button>
          ))}
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-slate-100/50 bg-slate-50/30">
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white hover:shadow-sm transition-all duration-200 cursor-pointer group border border-transparent hover:border-slate-100">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary-700 flex items-center justify-center text-white font-bold text-xs shadow-sm group-hover:scale-105 transition-transform">
              AD
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-slate-900 truncate">Admin User</p>
              <p className="text-[10px] text-slate-500 truncate font-semibold">admin@finderb.in</p>
            </div>
            <div className="relative">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-200"></div>
              <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-500 animate-ping opacity-25"></div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 lg:ml-64 flex flex-col min-w-0">
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200/60 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="p-2 text-slate-500 lg:hidden hover:bg-primary/5 hover:text-primary rounded-xl transition-all"
              onClick={() => setIsSidebarOpen(true)}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h2 className="text-sm lg:text-base font-black text-primary tracking-tight truncate uppercase">{activeTab}</h2>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <button className="p-2 text-slate-400 hover:text-primary transition-all rounded-xl hover:bg-primary/5 relative">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute top-2 right-2 w-2 h-2 bg-secondary rounded-full border-2 border-white"></span>
            </button>
            <div className="h-4 w-px bg-slate-200 hidden sm:block"></div>
            <Link href="/" className="text-[11px] font-black text-slate-400 hover:text-rose-600 transition-all uppercase tracking-widest bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 hover:border-rose-100 hover:bg-rose-50/50">
              Sign out
            </Link>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto w-full space-y-6">
          {fetchError && (
            <div className="rounded-xl bg-rose-50 border border-rose-100 p-4 text-rose-800 shadow-sm ring-1 ring-rose-200/20">
              <div className="flex items-start gap-3">
                <svg className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-[11px] font-semibold">
                  <p className="font-bold text-rose-900">System Alert</p>
                  <p className="mt-0.5 text-rose-700">{fetchError}</p>
                </div>
              </div>
            </div>
          )}
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

// --- Content Components ---

function DashboardContent({ setActiveTab, merchantRequests, handleApprove, handleReject }: {
  setActiveTab: (tab: string) => void;
  merchantRequests: MerchantRequest[];
  handleApprove: (req: MerchantRequest) => void;
  handleReject: (req: MerchantRequest) => void;
}) {
  const chartData = [
    { label: "Mon", users: 120, merchants: 45 },
    { label: "Tue", users: 190, merchants: 52 },
    { label: "Wed", users: 300, merchants: 48 },
    { label: "Thu", users: 250, merchants: 61 },
    { label: "Fri", users: 320, merchants: 55 },
    { label: "Sat", users: 440, merchants: 67 },
    { label: "Sun", users: 380, merchants: 70 },
  ];

  const maxVal = Math.max(...chartData.map(d => d.users));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1.5 px-1">
        <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">System Overview</h1>
        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest opacity-70">Real-time performance and partner engagement metrics.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[
          { label: "Total Users", value: "12,842", growth: "+12%", color: "bg-primary", icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          )},
          { label: "Active Merchants", value: "573", growth: "+8", color: "bg-secondary", icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          )},
          { label: "Monthly Revenue", value: "₹4.3L", growth: "85%", color: "bg-slate-900", icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )},
        ].map((stat, i) => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 group">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2.5 rounded-xl ${stat.color} text-white shadow-lg ${stat.color === 'bg-primary' ? 'shadow-primary/30' : stat.color === 'bg-secondary' ? 'shadow-secondary/30' : 'shadow-slate-200'} group-hover:scale-110 transition-all duration-300`}>
                {stat.icon}
              </div>
              <div className="flex flex-col items-end">
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${stat.growth.startsWith('+') ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-50 text-slate-600 border border-slate-100'}`}>
                  {stat.growth}
                </span>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1 tabular-nums">{stat.value}</h3>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-50">
            <div>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Engagement Metrics</h3>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1 opacity-60">Activity analysis for the current week.</p>
            </div>
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-primary rounded-full shadow-sm shadow-primary/20"></div>
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Users</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-secondary rounded-full shadow-sm shadow-secondary/20"></div>
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Merchants</span>
              </div>
            </div>
          </div>

          <div className="h-56 flex items-end justify-between gap-3 px-2">
            {chartData.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-3 h-full justify-end group relative">
                <div className="w-full flex flex-col items-center gap-1 h-full justify-end max-w-[28px]">
                  <div
                    className="w-full bg-primary/90 rounded-t-lg transition-all duration-300 hover:bg-primary cursor-pointer shadow-sm group-hover:scale-x-105"
                    style={{ height: `${(d.users / maxVal) * 100}%` }}
                  ></div>
                  <div
                    className="w-full bg-secondary/90 rounded-t-lg transition-all duration-300 hover:bg-secondary cursor-pointer shadow-sm group-hover:scale-x-105"
                    style={{ height: `${(d.merchants / maxVal) * 100}%` }}
                  ></div>
                </div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter transition-colors group-hover:text-primary">{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/60 shadow-sm flex flex-col overflow-hidden">
          <div className="p-5 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Pending Approvals</h3>
            <button
              onClick={() => setActiveTab("Merchants")}
              className="text-[9px] font-black text-primary hover:text-primary-700 uppercase tracking-widest transition-all bg-white px-2 py-1 rounded-lg border border-slate-200 hover:border-primary/20 shadow-sm"
            >
              View Queue
            </button>
          </div>
          <div className="flex-1 divide-y divide-slate-50/80 overflow-y-auto max-h-[340px] custom-scrollbar">
            {merchantRequests.length > 0 ? merchantRequests.map((merchant) => (
              <div key={merchant.id} className="p-4 flex items-center justify-between hover:bg-primary/[0.02] transition-colors group">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center text-primary font-black text-[10px] border border-slate-200 group-hover:from-primary/5 group-hover:to-primary/10 transition-all uppercase shrink-0 shadow-sm group-hover:scale-105">
                    {merchant.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-black text-slate-900 truncate tracking-tight">{merchant.name}</p>
                    <p className="text-[9px] text-secondary font-black uppercase tracking-widest mt-0.5">{merchant.category}</p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleApprove(merchant)}
                    className="w-8 h-8 flex items-center justify-center text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all border border-slate-100 hover:border-emerald-200 shadow-sm"
                    title="Approve"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleReject(merchant)}
                    className="w-8 h-8 flex items-center justify-center text-rose-500 hover:bg-rose-50 rounded-xl transition-all border border-slate-100 hover:border-rose-200 shadow-sm"
                    title="Reject"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )) : (
              <div className="h-full flex flex-col items-center justify-center p-12 opacity-40">
                <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Queue Empty</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Recent Activity</h3>
          <button className="text-[9px] font-black text-primary hover:text-primary-700 uppercase tracking-widest transition-all bg-white px-2 py-1 rounded-lg border border-slate-200 hover:border-primary/20 shadow-sm" onClick={() => setActiveTab("Users")}>Full Log</button>
        </div>
        <div className="divide-y divide-slate-50/80">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-4 flex items-center justify-between hover:bg-primary/[0.01] transition-colors group">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100 text-slate-400 group-hover:text-primary group-hover:bg-primary/5 transition-all group-hover:scale-105 shadow-sm">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div className="truncate">
                  <p className="text-[11px] font-black text-slate-900 truncate tracking-tight">Onboarding: user_0{i}84</p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5 opacity-60">Verification completed successfully.</p>
                </div>
              </div>
              <span className="text-[9px] font-black text-slate-400 bg-slate-50 px-3 py-1 rounded-lg border border-slate-100 tabular-nums">0{i}:24 PM</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function UsersContent({ users, setUsers }: { users: User[], setUsers: Dispatch<SetStateAction<User[]>> }) {
  const handleDeleteUser = (id: number) => {
    if (confirm("Are you sure you want to delete this user?")) {
      setUsers(users.filter(u => u.id !== id));
    }
  };

  const toggleUserStatus = (id: number) => {
    setUsers(users.map(u =>
      u.id === id ? { ...u, status: u.status === "Active" ? "Inactive" : "Active" } : u
    ));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">User Management</h1>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest opacity-70">View and manage registered users on the platform.</p>
        </div>
        <button
          onClick={() => alert("Add User functionality coming soon!")}
          className="px-4 py-2 bg-primary text-white text-[10px] font-black rounded-xl hover:bg-primary-700 transition-all active:scale-95 shadow-lg shadow-primary/20 uppercase tracking-widest"
        >
          Add New User
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">User Info</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">Status</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">Joined Date</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50/80">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-primary/[0.01] transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center text-primary font-black text-[10px] border border-slate-200 uppercase group-hover:scale-110 transition-transform shadow-sm">
                        {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-[11px] font-black text-slate-900 tracking-tight">{user.name}</p>
                        <p className="text-[10px] text-slate-500 font-bold opacity-60">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${user.status === "Active"
                      ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                      : "bg-slate-50 text-slate-500 border-slate-100"
                      }`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-[10px] text-slate-600 font-bold tabular-nums opacity-80">{user.joined}</p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => toggleUserStatus(user.id)}
                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/5 hover:border-primary/20 rounded-xl transition-all border border-slate-100 shadow-sm"
                        title={user.status === "Active" ? "Suspend" : "Activate"}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 rounded-xl transition-all border border-slate-100 shadow-sm"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center opacity-40">
                      <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mb-3">
                        <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">No users found</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MerchantsContent({ activeMerchants, setActiveMerchants, merchantRequests, setMerchantRequests }: {
  activeMerchants: Merchant[],
  setActiveMerchants: Dispatch<SetStateAction<Merchant[]>>,
  merchantRequests: MerchantRequest[],
  setMerchantRequests: Dispatch<SetStateAction<MerchantRequest[]>>
}) {
  const [merchantTab, setMerchantTab] = useState<"Active" | "Pending">("Active");

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
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">Partner Management</h1>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest opacity-70">Manage active partners and verify new requests.</p>
        </div>
        <div className="flex p-1 bg-slate-100/50 border border-slate-200/60 rounded-xl shadow-inner">
          <button
            onClick={() => setMerchantTab("Active")}
            className={`px-5 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${merchantTab === "Active" ? "bg-white text-primary shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
          >
            Active
          </button>
          <button
            onClick={() => setMerchantTab("Pending")}
            className={`px-5 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all relative ${merchantTab === "Pending" ? "bg-white text-primary shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
          >
            Pending
            {merchantRequests.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-secondary text-[8px] font-black text-white border-2 border-white shadow-sm shadow-secondary/20 animate-pulse">
                {merchantRequests.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden min-h-[400px]">
        {merchantTab === "Active" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50/50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Business</th>
                  <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Category</th>
                  <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Sales</th>
                  <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Valid Until</th>
                  <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50/80">
                {activeMerchants.map((merchant) => (
                  <tr key={merchant.id} className="hover:bg-primary/[0.01] transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center text-primary font-black text-[10px] border border-slate-200 uppercase group-hover:scale-110 transition-transform shadow-sm">
                          {merchant.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <p className="text-[11px] font-black text-slate-900 tracking-tight">{merchant.name}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-50 text-secondary font-black text-[9px] uppercase tracking-widest border border-slate-100">
                        {merchant.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[10px] font-bold tabular-nums text-slate-600 opacity-80">{merchant.sales}</td>
                    <td className="px-6 py-4 text-[10px] font-bold tabular-nums text-slate-600 opacity-80">{merchant.validUntil}</td>
                    <td className="px-6 py-4 text-right">
                      <button className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/5 hover:border-primary/20 rounded-xl transition-all border border-slate-100 shadow-sm ml-auto">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
                {activeMerchants.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center opacity-40">
                        <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mb-3">
                          <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">No active merchants</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="divide-y divide-slate-50/80">
            {merchantRequests.map((req) => (
              <div key={req.id} className="p-5 flex items-center justify-between hover:bg-primary/[0.01] transition-all group">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-slate-50 flex items-center justify-center text-primary font-black border border-slate-200 group-hover:scale-105 transition-all uppercase shrink-0 shadow-sm">
                    {req.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900 tracking-tight truncate">{req.name}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[9px] font-black text-secondary uppercase tracking-widest bg-secondary/5 px-2 py-0.5 rounded-lg border border-secondary/10">{req.category}</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Request: {req.date}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleReject(req.id)}
                    className="px-4 py-2 text-[10px] font-black text-rose-600 hover:bg-rose-50 border border-slate-100 hover:border-rose-200 rounded-xl transition-all uppercase tracking-widest"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleApprove(req)}
                    className="px-4 py-2 text-[10px] font-black text-white bg-primary hover:bg-primary-700 rounded-xl shadow-lg shadow-primary/20 transition-all uppercase tracking-widest"
                  >
                    Approve Partner
                  </button>
                </div>
              </div>
            ))}
            {merchantRequests.length === 0 && (
              <div className="py-24 flex flex-col items-center opacity-30">
                <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Verification queue is empty</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CategoriesContent({ categories, setCategories, categoryError, onUpdateCategory }: {
  categories: Category[],
  setCategories: Dispatch<SetStateAction<Category[]>>,
  categoryError: string | null,
  onUpdateCategory: (catName: string, updates: Partial<Category>) => Promise<void>
}) {
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const handleSave = async () => {
    if (editingCategory) {
      await onUpdateCategory(editingCategory.name, editingCategory);
      setEditingCategory(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">Category Catalog</h1>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest opacity-70">Manage platform categories and service types.</p>
        </div>
        <button className="px-4 py-2 bg-primary text-white text-[10px] font-black rounded-xl hover:bg-primary-700 shadow-lg shadow-primary/20 transition-all uppercase tracking-widest">
          Add New Category
        </button>
      </div>

      {categoryError && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 flex items-center gap-3">
          <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-[10px] font-bold text-amber-800 uppercase tracking-widest">{categoryError}</p>
        </div>
      )}

      {editingCategory ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xl space-y-6 animate-in fade-in zoom-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-50 pb-4">
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">Editing: {editingCategory.name}</h2>
            <button onClick={() => setEditingCategory(null)} className="text-slate-400 hover:text-slate-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Category Banner URL</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editingCategory.banner || ""}
                    onChange={(e) => setEditingCategory({ ...editingCategory, banner: e.target.value })}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="https://example.com/banner.jpg"
                  />
                </div>
                {editingCategory.banner && (
                  <div className="mt-2 h-24 w-full rounded-lg overflow-hidden border border-slate-100">
                    <img src={editingCategory.banner} alt="Banner Preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Fixed Partner Spots (Top 5)</label>
              {[1, 2, 3, 4, 5].map((pos) => (
                <div key={pos} className="flex items-center gap-3">
                  <span className="text-[10px] font-black text-primary w-4">#{pos}</span>
                  <input
                    type="text"
                    value={(editingCategory as any)[`position_${pos}_business_id`] || ""}
                    onChange={(e) => setEditingCategory({ ...editingCategory, [`position_${pos}_business_id`]: e.target.value })}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-[10px] font-bold focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Enter Partner ID"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-50">
            <button
              onClick={() => setEditingCategory(null)}
              className="px-4 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:bg-slate-50 rounded-lg transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-primary text-white text-[10px] font-black rounded-lg hover:bg-primary-700 shadow-lg shadow-primary/20 transition-all uppercase tracking-widest"
            >
              Save Changes
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {categories.map((cat, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 group">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-primary font-black border border-slate-200 group-hover:scale-110 transition-all shadow-sm overflow-hidden">
                  {cat.banner && cat.banner !== 'Not Set' ? (
                    <img src={cat.banner} className="w-full h-full object-cover" alt="" />
                  ) : (
                    cat.name[0]
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingCategory(cat)}
                    className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                    title="Edit Category"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border ${cat.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                    {cat.status}
                  </span>
                </div>
              </div>
              <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase">{cat.name}</h3>
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-50">
                <div className="flex flex-col">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Partners</span>
                  <span className="text-xs font-black text-primary tabular-nums">{cat.items}</span>
                </div>
                <div className="w-px h-6 bg-slate-100"></div>
                <div className="flex flex-col">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Type</span>
                  <span className="text-[10px] font-black text-secondary uppercase tracking-widest">{cat.type}</span>
                </div>
              </div>
            </div>
          ))}
          {categories.length === 0 && !categoryError && (
            <div className="col-span-full py-24 flex flex-col items-center opacity-30 bg-white rounded-2xl border border-slate-200/60">
              <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">No categories defined</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PaymentsContent() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1.5 px-1">
        <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">Financial Ledger</h1>
        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest opacity-70">Transaction history and subscription revenue logs.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-24 text-center">
        <div className="w-20 h-20 rounded-3xl bg-primary/5 flex items-center justify-center mx-auto mb-6 border border-primary/10">
          <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 animate-pulse">Transaction Engine Syncing...</p>
      </div>
    </div>
  );
}

function BroadcastsContent({ message, setMessage, audience, setAudience }: {
  message: string,
  setMessage: (m: string) => void,
  audience: string,
  setAudience: (a: string) => void
}) {
  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex flex-col gap-1.5 px-1">
        <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">Global Broadcast</h1>
        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest opacity-70">Push announcements and updates to platform users.</p>
      </div>

      <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm p-8 space-y-6">
        <div>
          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2.5">Recipient Audience</label>
          <select
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none"
            style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2394a3b8\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1em' }}
          >
            <option>Everyone</option>
            <option>Merchants Only</option>
            <option>Service Providers</option>
            <option>New Users</option>
          </select>
        </div>
        <div>
          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2.5">Announcement Content</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="TYPE YOUR MESSAGE HERE..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all min-h-[160px] placeholder:text-slate-300"
          />
        </div>
        <button
          onClick={() => { alert("Broadcast sent!"); setMessage(""); }}
          className="w-full py-4 bg-primary text-white text-[10px] font-black rounded-xl hover:bg-primary-700 shadow-lg shadow-primary/20 transition-all active:scale-[0.98] uppercase tracking-[0.2em]"
        >
          Dispatch Announcement
        </button>
      </div>
    </div>
  );
}

function SettingsContent({ settings, setSettings }: { settings: Settings, setSettings: Dispatch<SetStateAction<Settings>> }) {
  const toggleSetting = (key: string) => {
    setSettings({ ...settings, [key]: !settings[key] });
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex flex-col gap-1.5 px-1">
        <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">Control Center</h1>
        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest opacity-70">Manage platform configurations and global security.</p>
      </div>

      <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm divide-y divide-slate-50/80 overflow-hidden">
        {Object.entries(settings).map(([key, val], i) => (
          <div key={i} className="p-5 flex items-center justify-between hover:bg-primary/[0.01] transition-colors">
            <div className="flex flex-col">
              <span className="text-[11px] font-black text-slate-900 capitalize tracking-tight">{key.replace(/([A-Z])/g, ' $1')}</span>
              <span className="text-[9px] text-secondary font-black uppercase tracking-widest mt-0.5">Global system flag</span>
            </div>
            <button
              onClick={() => toggleSetting(key)}
              className={`w-11 h-6 rounded-full relative transition-all duration-300 ${val ? 'bg-primary shadow-lg shadow-primary/20' : 'bg-slate-200'}`}
            >
              <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-all duration-300 shadow-sm ${val ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
        ))}
      </div>

      <button className="w-full py-4 text-[10px] font-black text-rose-600 hover:bg-rose-50 border border-rose-100 rounded-xl transition-all active:scale-[0.98] uppercase tracking-[0.2em]">
        Reset All System Flags
      </button>
    </div>
  );
}
