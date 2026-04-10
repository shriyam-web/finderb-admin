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
  position_1_business_id?: string;
  position_2_business_id?: string;
  position_3_business_id?: string;
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

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();

      const { data: catData, error: catError } = await supabase.from('categories').select('*');
      if (catError) {
        console.error("Category fetch error:", catError);
        const missingTable = catError.message?.toLowerCase().includes("public.categories") || catError.message?.toLowerCase().includes("relation \"categories\" does not exist") || catError.code === "42P01";
        setCategoryError(missingTable
          ? "Categories table is missing. Create it with db/create_categories_table.sql or via the Supabase SQL editor."
          : catError.message
        );
      } else {
        setCategoryError(null);
      }
      if (catData) setCategories(catData.map(c => ({
        name: c.name,
        items: c.items_count || 0,
        status: c.status || 'Active',
        banner: c.banner || 'Not Set',
        fixedSlots: c.fixed_slots || 0,
        type: c.type || 'Merchant',
        position_1_business_id: c.position_1_business_id,
        position_2_business_id: c.position_2_business_id,
        position_3_business_id: c.position_3_business_id
      })));

      const { data: merchantData } = await supabase.from('Business').select('*');
      if (merchantData) {
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
      }
    };
    fetchData();
  }, []);

  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastAudience, setBroadcastAudience] = useState("Everyone");

  const menuItems = [
    {
      name: "Dashboard", icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      )
    },
    {
      name: "Users", icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      )
    },
    {
      name: "Merchants", icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      )
    },
    {
      name: "Categories", icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
      )
    },
    {
      name: "Payments & Subscriptions", icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      )
    },
    {
      name: "Broadcasts", icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
        </svg>
      )
    },
    {
      name: "Settings", icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case "Dashboard":
        return <DashboardContent setActiveTab={setActiveTab} />;
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
        return <CategoriesContent categories={categories} setCategories={setCategories} categoryError={categoryError} />;
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
        return <DashboardContent setActiveTab={setActiveTab} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f9fafb]">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <aside className={`w-64 bg-white border-r border-[#e5e7eb] flex flex-col fixed inset-y-0 shadow-sm z-50 transition-transform duration-300 transform ${isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="h-16 flex items-center px-6 border-b border-[#f3f4f6]">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <Image
              src="/logo.png"
              alt="Logo"
              width={72}
              height={72}
              className="rounded"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = "/next.svg";
              }}
            />
            <span className="text-xl font-bold text-[#111827] tracking-tight">Admin</span>
          </Link>
        </div>

        <nav className="flex-1 mt-6 px-3 space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.name}
              onClick={() => {
                setActiveTab(item.name);
                setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === item.name
                ? "bg-[#f3f4f6] text-[#111827]"
                : "text-[#4b5563] hover:bg-[#f9fafb] hover:text-[#111827]"
                }`}
            >
              <span className={`${activeTab === item.name ? "text-[#2563eb]" : "text-[#9ca3af]"}`}>
                {item.icon}
              </span>
              {item.name}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-[#f3f4f6]">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-[#e5e7eb] flex items-center justify-center text-xs font-semibold text-[#4b5563]">
              AD
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#111827] truncate">Admin User</p>
              <p className="text-xs text-[#6b7280] truncate">admin@boomb.in</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 lg:ml-64 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-[#e5e7eb] flex items-center justify-between px-4 lg:px-8 sticky top-0 z-10 shadow-sm/5">
          <div className="flex items-center gap-4">
            <button
              className="p-2 text-[#6b7280] lg:hidden hover:bg-[#f9fafb] rounded-lg"
              onClick={() => setIsSidebarOpen(true)}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h2 className="text-sm font-bold text-[#111827] uppercase tracking-wider">{activeTab}</h2>
          </div>

          <div className="flex items-center gap-3 lg:gap-6">
            <button className="p-2 text-[#6b7280] hover:text-[#111827] transition-colors rounded-lg hover:bg-[#f9fafb]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </button>
            <div className="h-6 w-px bg-[#e5e7eb] hidden sm:block"></div>
            <Link href="/" className="text-sm font-bold text-[#dc2626] hover:text-[#b91c1c] transition-colors whitespace-nowrap">
              Log out
            </Link>
          </div>
        </header>

        <main className="p-4 lg:p-8 max-w-7xl mx-auto w-full">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

// --- Content Components ---

function DashboardContent({ setActiveTab }: { setActiveTab: (tab: string) => void }) {
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
    <div className="space-y-6 lg:space-y-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl lg:text-2xl font-bold text-[#111827]">Overview Dashboard</h1>
        <p className="text-sm text-[#6b7280]">Real-time analytics and platform health summary.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
        <div className="p-6 bg-white rounded-2xl shadow-sm border border-[#e5e7eb] hover:shadow-md transition-all cursor-pointer group" onClick={() => setActiveTab("Users")}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-widest">Total Users</p>
            <span className="p-2 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </span>
          </div>
          <h3 className="text-2xl lg:text-3xl font-bold text-[#111827]">12,842</h3>
          <p className="mt-2 text-xs text-green-600 font-bold flex items-center gap-1 bg-green-50 w-fit px-2 py-0.5 rounded-lg">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
            12% Growth
          </p>
        </div>

        <div className="p-6 bg-white rounded-2xl shadow-sm border border-[#e5e7eb] hover:shadow-md transition-all cursor-pointer group" onClick={() => setActiveTab("Merchants")}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-widest">Active Merchants</p>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </span>
          </div>
          <h3 className="text-2xl lg:text-3xl font-bold text-[#111827]">573</h3>
          <p className="mt-2 text-xs text-blue-600 font-bold flex items-center gap-1 bg-blue-50 w-fit px-2 py-0.5 rounded-lg">
            8 New Onboarded
          </p>
        </div>

        <div className="p-6 bg-white rounded-2xl shadow-sm border border-[#e5e7eb] hover:shadow-md transition-all cursor-pointer group" onClick={() => setActiveTab("Payments & Subscriptions")}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-widest">Monthly Revenue</p>
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-all">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </div>
          <h3 className="text-2xl lg:text-3xl font-bold text-[#111827]">₹4,29,100</h3>
          <p className="mt-2 text-xs text-indigo-600 font-bold flex items-center gap-1 bg-indigo-50 w-fit px-2 py-0.5 rounded-lg">
            Target: 85% Reached
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Graphical Section */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-[#e5e7eb] p-6 lg:p-8 hover:shadow-lg transition-shadow duration-300">
          <div className="flex items-center justify-between mb-8 pb-6 border-b border-[#f3f4f6]">
            <div>
              <h3 className="font-bold text-[#111827] text-lg">Engagement Metrics</h3>
              <p className="text-xs text-[#6b7280]">Traffic vs Conversion Ratio</p>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-blue-600 rounded-full shadow-sm"></div>
                <span className="text-[10px] font-bold text-[#4b5563] uppercase tracking-wider">Users</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-indigo-200 rounded-full shadow-sm"></div>
                <span className="text-[10px] font-bold text-[#4b5563] uppercase tracking-wider">Merchants</span>
              </div>
            </div>
          </div>

          <div className="h-64 flex items-end justify-between gap-2 lg:gap-6 px-4">
            {chartData.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-4 h-full justify-end group">
                <div className="w-full flex flex-col items-center gap-1.5 relative h-full justify-end">
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-[#111827] text-white text-[10px] py-1.5 px-3 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap z-20 pointer-events-none shadow-xl border border-white/10">
                    <span className="block font-bold mb-0.5">{d.label}</span>
                    <span className="text-blue-300 text-[9px]">{d.users} Active Users</span>
                  </div>
                  <div
                    className="w-full max-w-[20px] bg-blue-600 rounded-t-lg transition-all duration-700 ease-out cursor-pointer hover:bg-blue-700 shadow-sm relative group"
                    style={{ height: `${(d.users / maxVal) * 100}%` }}
                  >
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-white/20 to-transparent rounded-t-lg opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  </div>
                  <div
                    className="w-full max-w-[20px] bg-indigo-50 rounded-t-md transition-all duration-700 ease-out cursor-pointer hover:bg-indigo-100"
                    style={{ height: `${(d.merchants / maxVal) * 100}%` }}
                  ></div>
                </div>
                <span className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-widest">{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Merchant Requests Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#e5e7eb] overflow-hidden flex flex-col hover:shadow-lg transition-shadow duration-300">
          <div className="px-6 py-5 border-b border-[#f3f4f6] flex items-center justify-between bg-white sticky top-0 z-10">
            <div>
              <h3 className="font-bold text-[#111827]">Partner Requests</h3>
              <p className="text-[10px] text-[#9ca3af] font-bold uppercase tracking-wider mt-0.5">Approval Queue</p>
            </div>
            <button className="text-[10px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-widest" onClick={() => setActiveTab("Merchants")}>All Requests</button>
          </div>
          <div className="flex-1 divide-y divide-[#f3f4f6]">
            {[
              { name: "Urban Threads", cat: "Fashion", code: "UT" },
              { name: "Kitchen Masters", cat: "Home", code: "KM" },
              { name: "Pet Paradise", cat: "Services", code: "PP" },
              { name: "Elite Fitness", cat: "Health", code: "EF" }
            ].map((merchant, i) => (
              <div key={i} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-all group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-600 font-bold text-xs border border-gray-100 group-hover:bg-white group-hover:shadow-sm transition-all uppercase tracking-tighter">
                    {merchant.code}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#111827] truncate">{merchant.name}</p>
                    <p className="text-[10px] text-[#9ca3af] font-bold uppercase tracking-wider">{merchant.cat}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      alert(`${merchant.name} approved!`);
                    }}
                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors border border-transparent hover:border-green-100"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      alert(`${merchant.name} rejected.`);
                    }}
                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 bg-gray-50 border-t border-[#f3f4f6]">
            <p className="text-[10px] text-center font-bold text-[#9ca3af] uppercase tracking-widest">Awaiting Verification (12 Total)</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-[#e5e7eb] overflow-hidden hover:shadow-lg transition-shadow duration-300">
        <div className="px-6 py-5 border-b border-[#f3f4f6] flex items-center justify-between bg-white">
          <div>
            <h3 className="font-bold text-[#111827]">Recent Platform Activity</h3>
            <p className="text-[10px] text-[#9ca3af] font-bold uppercase tracking-wider mt-0.5">Global Event Log</p>
          </div>
          <button className="text-[10px] font-bold text-gray-500 hover:text-[#111827] uppercase tracking-widest" onClick={() => setActiveTab("Users")}>Full Log</button>
        </div>
        <div className="divide-y divide-[#f3f4f6]">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-all group">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center shrink-0 border border-gray-100 text-gray-400 group-hover:text-blue-500 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div className="truncate">
                  <p className="text-sm font-bold text-[#111827] truncate">Platform Onboarding: user_0{i}84</p>
                  <p className="text-xs text-[#6b7280] truncate leading-relaxed">Profile verification completed successfully.</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[9px] font-bold text-[#9ca3af] uppercase bg-gray-100 px-2 py-1 rounded-md border border-gray-200">{i * 12} mins ago</span>
              </div>
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">User Management</h1>
          <p className="text-sm text-[#6b7280]">View and manage registered users on the platform.</p>
        </div>
        <button
          onClick={() => alert("Add User functionality coming soon!")}
          className="px-4 py-2 bg-[#111827] text-white text-sm font-bold rounded-lg hover:bg-[#1f2937] transition-all active:scale-95"
        >
          + Add New User
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-[#e5e7eb] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#f9fafb] border-b border-[#e5e7eb]">
              <tr>
                <th className="px-6 py-4 text-[10px] font-bold text-[#6b7280] uppercase tracking-widest whitespace-nowrap">User Info</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#6b7280] uppercase tracking-widest whitespace-nowrap">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#6b7280] uppercase tracking-widest whitespace-nowrap">Joined Date</th>
                <th className="px-6 py-4 text-[10px] font-bold text-[#6b7280] uppercase tracking-widest text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f3f4f6]">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-[#f9fafb] transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#f3f4f6] flex items-center justify-center text-xs font-bold text-[#4b5563] shrink-0 border border-[#e5e7eb] group-hover:bg-white group-hover:shadow-sm transition-all">
                        {user.name.split(' ').map((n: string) => n[0]).join('')}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#111827] truncate">{user.name}</p>
                        <p className="text-xs text-[#6b7280] truncate">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleUserStatus(user.id)}
                      className={`inline-flex px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border transition-all hover:scale-105 active:scale-95 ${user.status === "Active" ? "bg-green-50 text-green-700 border-green-100" : "bg-gray-50 text-gray-700 border-gray-100"
                        }`}
                    >
                      {user.status}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-xs font-bold text-[#4b5563] whitespace-nowrap">{user.joined}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => alert(`Editing ${user.name}...`)}
                        className="p-2 text-[#6b7280] hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-transparent hover:border-blue-100 transition-all"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="p-2 text-[#9ca3af] hover:text-red-600 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-100 transition-all"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
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

function MerchantsContent({
  activeMerchants,
  setActiveMerchants,
  merchantRequests,
  setMerchantRequests
}: {
  activeMerchants: Merchant[],
  setActiveMerchants: Dispatch<SetStateAction<Merchant[]>>,
  merchantRequests: MerchantRequest[],
  setMerchantRequests: Dispatch<SetStateAction<MerchantRequest[]>>
}) {
  const [subTab, setSubTab] = useState("Active");
  const [extendingMerchant, setExtendingMerchant] = useState<string | null>(null);
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessData | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);

  const openBusinessModal = async (merchantId: string) => {
    setViewLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.from('Business').select('*').eq('id', merchantId).single();
    setViewLoading(false);

    if (error) {
      alert("Error loading merchant details: " + error.message);
      return;
    }

    setSelectedBusiness(data as BusinessData);
    setIsViewOpen(true);
  };

  const handleUpdateDate = () => {
    if (!extendingMerchant) return;
    setActiveMerchants((prev: Merchant[]) => prev.map(m =>
      m.name === extendingMerchant ? { ...m, validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] } : m
    ));
    setExtendingMerchant(null);
    alert(`${extendingMerchant}'s subscription has been extended!`);
  };

  const handleApprove = async (req: MerchantRequest) => {
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

  const handleReject = async (req: MerchantRequest) => {
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">Merchant Management</h1>
          <p className="text-sm text-[#6b7280]">Manage active partners and verify new requests.</p>
        </div>
        <div className="flex p-1 bg-[#f3f4f6] rounded-xl w-full sm:w-fit border border-[#e5e7eb]">
          <button
            onClick={() => setSubTab("Active")}
            className={`flex-1 sm:flex-none px-6 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${subTab === "Active" ? "bg-white text-[#111827] shadow-sm" : "text-[#6b7280] hover:text-[#111827]"
              }`}
          >
            Active
          </button>
          <button
            onClick={() => setSubTab("Requests")}
            className={`flex-1 sm:flex-none px-6 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${subTab === "Requests" ? "bg-white text-[#111827] shadow-sm" : "text-[#6b7280] hover:text-[#111827]"
              }`}
          >
            New Requests
          </button>
        </div>
      </div>

      {subTab === "Active" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeMerchants.map(merchant => (
            <div key={merchant.id} className="bg-white p-6 rounded-2xl border border-[#e5e7eb] shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xl shadow-inner group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
                  {merchant.name[0]}
                </div>
                <div>
                  <h3 className="font-bold text-[#111827] text-lg">{merchant.name}</h3>
                  <p className="text-xs font-bold text-[#9ca3af] uppercase tracking-wider">{merchant.category}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 py-4 border-y border-[#f3f4f6] mb-4">
                <div>
                  <p className="text-[10px] uppercase font-bold text-[#9ca3af] tracking-widest mb-1">Rating</p>
                  <p className="text-sm font-bold text-[#111827] flex items-center gap-1">
                    {merchant.rating}
                    <svg className="w-3.5 h-3.5 text-yellow-400 fill-current" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-[#9ca3af] tracking-widest mb-1">Sales</p>
                  <p className="text-sm font-bold text-[#111827]">{merchant.sales.toLocaleString()}</p>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-[10px] uppercase font-bold text-[#9ca3af] tracking-widest mb-1">Validity Period</p>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-[#111827]">Until {new Date(merchant.validUntil).toLocaleDateString()}</p>
                  <button
                    onClick={() => setExtendingMerchant(merchant.name)}
                    className="text-[10px] font-bold text-blue-600 hover:underline uppercase"
                  >
                    Extend
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => openBusinessModal(merchant.id)}
                  className="flex-1 py-3 text-[10px] font-bold uppercase tracking-wider text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-all"
                >
                  View
                </button>
                <button className="flex-1 py-3 text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-600 hover:text-white transition-all">
                  Analytics
                </button>
                <button className="flex-1 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-600 bg-gray-50 rounded-xl hover:bg-gray-200 transition-all">
                  Edit Details
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#e5e7eb] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#f9fafb] border-b border-[#e5e7eb]">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6b7280] uppercase tracking-widest whitespace-nowrap">Store Name</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6b7280] uppercase tracking-widest whitespace-nowrap">Category</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6b7280] uppercase tracking-widest whitespace-nowrap">Applied On</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6b7280] uppercase tracking-widest text-right whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f3f4f6]">
                {merchantRequests.map((req: any) => (
                  <tr key={req.id} className="hover:bg-[#f9fafb] transition-colors">
                    <td className="px-6 py-4 text-sm font-bold text-[#111827]">{req.name}</td>
                    <td className="px-6 py-4 text-xs font-bold text-[#6b7280] uppercase tracking-wider">{req.category}</td>
                    <td className="px-6 py-4 text-xs font-bold text-[#6b7280]">{req.date}</td>
                    <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => openBusinessModal(req.id)}
                        disabled={viewLoading}
                        className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-all disabled:cursor-not-allowed disabled:bg-blue-300"
                      >
                        {viewLoading ? 'Loading...' : 'View'}
                      </button>
                      <button
                        onClick={() => handleApprove(req)}
                        className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white bg-green-600 rounded-lg hover:bg-green-700 shadow-sm transition-all"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(req)}
                        className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white bg-red-600 rounded-lg hover:bg-red-700 shadow-sm transition-all"
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {extendingMerchant && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-white/20 animate-in fade-in zoom-in duration-200 overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-[#111827]">Extend Subscription</h3>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mt-1">{extendingMerchant}</p>
              </div>
              <button onClick={() => setExtendingMerchant(null)} className="p-2 hover:bg-gray-50 rounded-full text-gray-400 hover:text-gray-900 transition-all">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-[0.2em]">Select New Expiry Date</label>
                <input
                  type="date"
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  defaultValue={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                />
              </div>

              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3">
                <svg className="w-5 h-5 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-[11px] font-bold text-amber-800 leading-relaxed">
                  Extending the date will update the merchant's visibility on the platform immediately. Ensure payment confirmation.
                </p>
              </div>
            </div>

            <div className="px-8 py-6 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-4">
              <button onClick={() => setExtendingMerchant(null)} className="flex-1 py-4 bg-white text-gray-900 text-sm font-bold rounded-2xl border border-gray-200 hover:bg-gray-50 transition-all uppercase tracking-widest">Cancel</button>
              <button onClick={handleUpdateDate} className="flex-1 py-4 bg-[#111827] text-white text-sm font-bold rounded-2xl hover:bg-[#1f2937] shadow-xl shadow-black/10 transition-all active:scale-95">
                Update Date
              </button>
            </div>
          </div>
        </div>
      )}

      {isViewOpen && selectedBusiness && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 overflow-y-auto p-3 sm:p-5">
          <div className="bg-white rounded-3xl w-full max-w-full sm:max-w-3xl md:max-w-4xl lg:max-w-5xl mx-auto max-h-[calc(100vh-3rem)] shadow-2xl border border-white/20 animate-in fade-in zoom-in duration-200 overflow-hidden">
            <div className="px-5 py-4 sm:px-8 sm:py-6 border-b border-gray-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-xl font-bold text-[#111827]">Merchant Details</h3>
                <p className="text-sm text-gray-500 mt-1">Full details for {selectedBusiness.businessName || selectedBusiness.fullName}</p>
              </div>
              <button onClick={() => setIsViewOpen(false)} className="p-2 hover:bg-gray-50 rounded-full text-gray-400 hover:text-gray-900 transition-all">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto max-h-[calc(100vh-18rem)] p-5 sm:p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { label: 'Business Name', value: selectedBusiness.businessName },
                  { label: 'Owner Name', value: selectedBusiness.fullName },
                  { label: 'Work Email', value: selectedBusiness.workEmail },
                  { label: 'Email', value: selectedBusiness.email || 'N/A' },
                  { label: 'Mobile', value: selectedBusiness.mobile },
                  { label: 'Public Phone', value: selectedBusiness.publicPhone },
                  { label: 'Category', value: selectedBusiness.category },
                  { label: 'Location', value: selectedBusiness.location || 'N/A' },
                  { label: 'City', value: selectedBusiness.city || 'N/A' },
                  { label: 'State', value: selectedBusiness.state || 'N/A' },
                  { label: 'Address', value: selectedBusiness.businessAddress },
                  { label: 'Selected Plan', value: selectedBusiness.selectedPlan },
                  { label: 'Billing Cycle', value: selectedBusiness.billingCycle },
                  { label: 'KYC Status', value: selectedBusiness.kycStatus },
                  { label: 'Verified', value: selectedBusiness.isVerified ? 'Yes' : 'No' },
                  { label: 'Verified Badge', value: selectedBusiness.hasVerifiedBadge ? 'Yes' : 'No' },
                  { label: 'Payment Status', value: selectedBusiness.paymentStatus },
                  { label: 'Payment ID', value: selectedBusiness.paymentId || 'N/A' },
                  { label: 'Order ID', value: selectedBusiness.orderId || 'N/A' },
                  { label: 'Registration #', value: selectedBusiness.registrationNumber || 'N/A' },
                  { label: 'PAN #', value: selectedBusiness.panNumber || 'N/A' },
                  { label: 'Aadhar #', value: selectedBusiness.aadharNumber || 'N/A' },
                  { label: 'Created At', value: new Date(selectedBusiness.createdAt).toLocaleString() },
                  { label: 'Updated At', value: new Date(selectedBusiness.updatedAt).toLocaleString() }
                ].map((item) => (
                  <div key={item.label} className="rounded-3xl border border-[#e5e7eb] p-4 sm:p-5 bg-[#f9fafb]">
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#6b7280] mb-2">{item.label}</p>
                    <p className="text-sm font-bold text-[#111827]">{item.value}</p>
                  </div>
                ))}

                {[
                  { label: 'PAN Document', value: selectedBusiness.panUrl },
                  { label: 'Aadhar Document', value: selectedBusiness.aadharUrl },
                  { label: 'MSME/GST', value: selectedBusiness.msmeGstUrl }
                ].map((item) => (
                  <div key={item.label} className="rounded-3xl border border-[#e5e7eb] p-4 sm:p-5 bg-[#f9fafb] md:col-span-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#6b7280] mb-2">{item.label}</p>
                    {item.value ? (
                      <a href={item.value} target="_blank" rel="noreferrer" className="text-sm font-bold text-blue-600 hover:underline break-all">{item.value}</a>
                    ) : (
                      <p className="text-sm font-bold text-[#111827]">Not available</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="px-5 py-4 sm:px-8 sm:py-6 bg-gray-50 border-t border-gray-100 text-right">
              <button onClick={() => setIsViewOpen(false)} className="inline-flex items-center justify-center px-6 py-3 text-sm font-bold uppercase tracking-wider text-[#111827] bg-white border border-gray-200 rounded-2xl hover:bg-gray-100 transition-all">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CategoriesContent({ categories, setCategories, categoryError }: { categories: Category[], setCategories: Dispatch<SetStateAction<Category[]>>, categoryError: string | null }) {
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [actionType, setActionType] = useState<"banner" | "slots" | "edit" | null>(null);
  const [businesses, setBusinesses] = useState<BusinessData[]>([]);
  const [currentCategoryData, setCurrentCategoryData] = useState<any>(null);

  const filteredCategories = categories;

  useEffect(() => {
    const fetchBusinesses = async () => {
      const supabase = createClient();
      const { data } = await supabase.from('Business').select('*');
      if (data) setBusinesses(data);
    };
    fetchBusinesses();
  }, []);

  useEffect(() => {
    if (editingCategory && actionType === "slots") {
      const fetchCategoryData = async () => {
        const supabase = createClient();
        const { data } = await supabase
          .from('categories')
          .select('*')
          .eq('name', editingCategory)
          .single();
        if (data) setCurrentCategoryData(data);
      };
      fetchCategoryData();
    }
  }, [editingCategory, actionType]);

  const handleAssignPosition = async (position: number, businessId: string) => {
    if (!editingCategory) return;
    const supabase = createClient();
    const positionField = `position_${position}_business_id`;
    const { error } = await supabase
      .from('categories')
      .update({ [positionField]: businessId })
      .eq('name', editingCategory);

    if (error) {
      alert("Error assigning position: " + error.message);
      return;
    }

    // Update local state
    setCategories((prev: Category[]) => prev.map(c => {
      if (c.name === editingCategory) {
        return { ...c, fixedSlots: Math.max(c.fixedSlots, position) };
      }
      return c;
    }));
    alert(`Business assigned to position #${position}`);
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory) return;
    const nameInput = document.getElementById('edit-cat-name') as HTMLInputElement;
    const statusSelect = document.getElementById('edit-cat-status') as HTMLSelectElement;
    const typeSelect = document.getElementById('edit-cat-type') as HTMLSelectElement;

    const newName = nameInput.value;
    const newStatus = statusSelect.value;
    const newType = typeSelect.value as 'Merchant' | 'Service';

    const supabase = createClient();
    const { error } = await supabase
      .from('categories')
      .update({ name: newName, status: newStatus, type: newType })
      .eq('name', editingCategory);

    if (error) {
      alert("Error updating category: " + error.message);
      return;
    }

    setCategories((prev: Category[]) => prev.map(c =>
      c.name === editingCategory ? { ...c, name: newName, status: newStatus, type: newType } : c
    ));
    setEditingCategory(null);
    alert("Category updated successfully!");
  };

  const handleNewCategory = async () => {
    const name = prompt("Enter new category name:");
    if (name) {
      const supabase = createClient();
      const { error } = await supabase
        .from('categories')
        .insert([{ name, items_count: 0, status: 'Active', banner: 'Not Set', fixed_slots: 0, type: 'Merchant' }]);

      if (error) {
        alert("Error creating category: " + error.message);
        return;
      }

      setCategories((prev: Category[]) => [
        ...prev,
        { name, items: 0, status: "Active", banner: "Not Set", fixedSlots: 0, type: 'Merchant' as 'Merchant' | 'Service', position_1_business_id: null, position_2_business_id: null, position_3_business_id: null }
      ]);
    }
  };

  const handleDeleteCategory = async (name: string) => {
    if (confirm(`Are you sure you want to delete category "${name}"?`)) {
      const supabase = createClient();
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('name', name);

      if (error) {
        alert("Error deleting category: " + error.message);
        return;
      }

      setCategories((prev: Category[]) => prev.filter(c => c.name !== name));
    }
  };

  return (
    <div className="space-y-6">
      {categoryError && (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-bold">Categories table missing</p>
          <p>{categoryError}</p>
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">Category Management</h1>
          <p className="text-sm text-[#6b7280]">Manage category-wise banners and fixed top positions.</p>
        </div>
        <button
          onClick={handleNewCategory}
          className="w-full sm:w-auto px-4 py-2 bg-[#111827] text-white text-sm font-bold rounded-lg hover:bg-[#1f2937] transition-all active:scale-95"
        >
          + New Category
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCategories.map((cat, i) => (
          <div key={i} className="bg-white rounded-2xl border border-[#e5e7eb] shadow-sm flex flex-col hover:border-blue-500 transition-all group overflow-hidden">
            <div className="p-6 flex-1">
              <div className="flex justify-between items-start mb-4">
                <div className="min-w-0">
                  <h3 className="font-bold text-[#111827] text-lg truncate group-hover:text-blue-600 transition-colors">{cat.name}</h3>
                  <p className="text-xs font-bold text-[#6b7280]">{cat.items} products listed</p>
                </div>
                <span className={`px-2 py-0.5 text-[9px] font-bold rounded-md uppercase tracking-wider border ${cat.status === "Active" ? "bg-green-50 text-green-600 border-green-100" : "bg-gray-50 text-gray-400 border-gray-100"
                  }`}>
                  {cat.status}
                </span>
              </div>

              <div className="space-y-3 mt-4 pt-4 border-t border-[#f3f4f6]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#6b7280]">Banner Status</span>
                  <span className={`text-[10px] font-bold uppercase ${cat.banner === "Set" ? "text-blue-600" : "text-[#9ca3af]"}`}>
                    {cat.banner}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#6b7280]">Fixed Positions</span>
                  <span className="text-xs font-bold text-[#111827]">{(cat.position_1_business_id ? 1 : 0) + (cat.position_2_business_id ? 1 : 0) + (cat.position_3_business_id ? 1 : 0)} slots filled</span>
                </div>
              </div>
            </div>

            <div className="bg-[#f9fafb] px-6 py-3 flex justify-between items-center border-t border-[#e5e7eb]">
              <div className="flex gap-2">
                <button
                  onClick={() => { setEditingCategory(cat.name); setActionType("edit"); }}
                  className="text-[10px] font-bold uppercase tracking-wider text-blue-600 hover:text-blue-700"
                >
                  Edit
                </button>
                <div className="w-px h-3 bg-[#e5e7eb]"></div>
                <button
                  onClick={() => { setEditingCategory(cat.name); setActionType("banner"); }}
                  className="text-[10px] font-bold uppercase tracking-wider text-blue-600 hover:text-blue-700"
                >
                  Set Banner
                </button>
                <div className="w-px h-3 bg-[#e5e7eb]"></div>
                <button
                  onClick={() => { setEditingCategory(cat.name); setActionType("slots"); }}
                  className="text-[10px] font-bold uppercase tracking-wider text-blue-600 hover:text-blue-700"
                >
                  Fix Slots
                </button>
              </div>
              <button
                onClick={() => handleDeleteCategory(cat.name)}
                className="text-[10px] font-bold uppercase tracking-wider text-red-400 hover:text-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {editingCategory && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-white/20 animate-in fade-in zoom-in duration-200 overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-[#111827]">
                {actionType === "banner" ? `Set Banner: ${editingCategory}` : actionType === "slots" ? `Fix Positions: ${editingCategory}` : `Edit Category: ${editingCategory}`}
              </h3>
              <button onClick={() => setEditingCategory(null)} className="p-2 hover:bg-gray-50 rounded-full text-gray-400 hover:text-gray-900 transition-all">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-8 space-y-6">
              {actionType === "edit" ? (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#6b7280] uppercase tracking-wider">Category Name</label>
                    <input
                      type="text"
                      defaultValue={editingCategory || ""}
                      className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm font-bold"
                      id="edit-cat-name"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#6b7280] uppercase tracking-wider">Status</label>
                    <select
                      defaultValue={categories.find(c => c.name === editingCategory)?.status}
                      className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm font-bold"
                      id="edit-cat-status"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#6b7280] uppercase tracking-wider">Type</label>
                    <select
                      defaultValue={categories.find(c => c.name === editingCategory)?.type}
                      className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm font-bold"
                      id="edit-cat-type"
                    >
                      <option value="Merchant">Merchant</option>
                      <option value="Service">Service</option>
                    </select>
                  </div>
                </div>
              ) : actionType === "banner" ? (
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center bg-gray-50/50">
                    <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mx-auto mb-4 text-gray-400">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-sm font-bold text-gray-500">Banner Upload Feature</p>
                    <p className="text-xs text-gray-400 mt-1 uppercase tracking-wider font-medium">Coming Soon</p>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-amber-50/50 rounded-xl border border-amber-100">
                    <div className="w-2 h-2 bg-amber-600 rounded-full"></div>
                    <p className="text-xs font-bold text-amber-700">Banner upload functionality is not yet implemented.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {[1, 2, 3].map((pos) => {
                    const positionField = `position_${pos}_business_id`;
                    const currentBusinessId = currentCategoryData?.[positionField];
                    const currentBusiness = businesses.find(b => b.id === currentBusinessId);
                    return (
                      <div key={pos} className="p-4 bg-gray-50 rounded-2xl border border-gray-200 flex items-center justify-between hover:bg-white hover:border-blue-200 transition-all group">
                        <div className="flex items-center gap-4 flex-1">
                          <span className="w-8 h-8 rounded-lg bg-[#111827] text-white flex items-center justify-center text-xs font-bold shadow-sm">#{pos}</span>
                          <div className="flex-1">
                            <p className="text-sm font-bold text-gray-900">Position {pos}</p>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                              {currentBusiness ? `Assigned: ${currentBusiness.registrationNumber || currentBusiness.businessName}` : 'No merchant assigned'}
                            </p>
                          </div>
                        </div>
                        <select
                          onChange={(e) => {
                            const selectedId = e.target.value;
                            if (selectedId) handleAssignPosition(pos, selectedId);
                          }}
                          className="px-3 py-2 bg-white text-blue-600 text-[10px] font-bold uppercase tracking-wider rounded-lg border border-blue-100 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-all shadow-sm cursor-pointer"
                          defaultValue=""
                        >
                          <option value="">Select by Reg #</option>
                          {businesses
                            .filter(b => b.kycStatus !== 'pending' && b.kycStatus !== 'rejected')
                            .map(business => (
                              <option key={business.id} value={business.id}>
                                {business.registrationNumber || 'No Reg #'} - {business.businessName}
                              </option>
                            ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-8 py-6 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              <button onClick={() => setEditingCategory(null)} className="text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors uppercase tracking-widest">Discard</button>
              <button
                onClick={() => {
                  if (actionType === "edit") {
                    handleUpdateCategory();
                  } else {
                    setEditingCategory(null);
                  }
                }}
                className="px-8 py-3 bg-[#111827] text-white text-sm font-bold rounded-xl hover:bg-[#1f2937] shadow-xl shadow-black/10 transition-all active:scale-95"
              >
                {actionType === "edit" ? "Save Changes" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PaymentsContent() {
  const [subTab, setSubTab] = useState("User Payments");

  const userTransactions = [
    { id: "TXN-U001", user: "John Doe", amount: "₹1,200", status: "Completed", date: "2024-04-01", method: "UPI" },
    { id: "TXN-U002", user: "Jane Smith", amount: "₹450", status: "Processing", date: "2024-04-02", method: "Card" },
    { id: "TXN-U003", user: "Robert Brown", amount: "₹2,900", status: "Completed", date: "2024-04-02", method: "UPI" },
  ];

  const merchantSubscriptions = [
    { id: "SUB-M001", merchant: "TechHub", amount: "₹24,999", plan: "Enterprise", status: "Active", date: "2024-03-15" },
    { id: "SUB-M002", merchant: "FashionBox", amount: "₹2,499", plan: "Pro", status: "Active", date: "2024-03-20" },
    { id: "SUB-M003", merchant: "FreshMart", amount: "₹0", plan: "Basic", status: "Active", date: "2024-03-25" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">Financials</h1>
          <p className="text-sm text-[#6b7280]">Track user transactions and merchant subscriptions.</p>
        </div>
        <div className="flex p-1 bg-[#f3f4f6] rounded-xl w-full sm:w-fit border border-[#e5e7eb]">
          {["User Payments", "Merchant Subscriptions"].map((tab) => (
            <button
              key={tab}
              onClick={() => setSubTab(tab)}
              className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${subTab === tab ? "bg-white text-[#111827] shadow-sm" : "text-[#6b7280] hover:text-[#111827]"
                }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-white rounded-2xl border border-[#e5e7eb] shadow-sm">
          <p className="text-[10px] uppercase font-bold text-[#9ca3af] tracking-widest mb-1">Total Revenue</p>
          <h3 className="text-2xl font-bold text-[#111827]">₹4,29,100</h3>
          <p className="mt-1 text-xs text-green-600 font-bold">+12% vs last month</p>
        </div>
        <div className="p-6 bg-white rounded-2xl border border-[#e5e7eb] shadow-sm">
          <p className="text-[10px] uppercase font-bold text-[#9ca3af] tracking-widest mb-1">Active Subscriptions</p>
          <h3 className="text-2xl font-bold text-[#111827]">412</h3>
          <p className="mt-1 text-xs text-blue-600 font-bold">18 new this week</p>
        </div>
        <div className="p-6 bg-white rounded-2xl border border-[#e5e7eb] shadow-sm">
          <p className="text-[10px] uppercase font-bold text-[#9ca3af] tracking-widest mb-1">Pending Payouts</p>
          <h3 className="text-2xl font-bold text-[#111827]">₹82,450</h3>
          <p className="mt-1 text-xs text-orange-600 font-bold">5 scheduled for today</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#e5e7eb] shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[#f3f4f6] flex items-center justify-between bg-[#f9fafb]">
          <h3 className="font-bold text-[#111827]">{subTab} History</h3>
          <button
            onClick={() => alert(`Exporting ${subTab} history as CSV...`)}
            className="text-[10px] font-bold uppercase tracking-wider text-blue-600 hover:underline"
          >
            Export CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#f9fafb] border-b border-[#e5e7eb]">
              {subTab === "User Payments" ? (
                <tr>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6b7280] uppercase tracking-widest">ID</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6b7280] uppercase tracking-widest">User</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6b7280] uppercase tracking-widest">Amount</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6b7280] uppercase tracking-widest">Method</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6b7280] uppercase tracking-widest text-right">Status</th>
                </tr>
              ) : (
                <tr>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6b7280] uppercase tracking-widest">ID</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6b7280] uppercase tracking-widest">Merchant</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6b7280] uppercase tracking-widest">Plan</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6b7280] uppercase tracking-widest">Value</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-[#6b7280] uppercase tracking-widest text-right">Status</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-[#f3f4f6]">
              {subTab === "User Payments" ? (
                userTransactions.map((txn) => (
                  <tr key={txn.id} className="hover:bg-[#f9fafb] transition-colors text-sm">
                    <td className="px-6 py-4 font-mono text-xs font-bold text-[#9ca3af]">{txn.id}</td>
                    <td className="px-6 py-4 font-bold text-[#111827]">{txn.user}</td>
                    <td className="px-6 py-4 font-bold text-[#111827]">{txn.amount}</td>
                    <td className="px-6 py-4 font-medium text-[#6b7280]">{txn.method}</td>
                    <td className="px-6 py-4 text-right">
                      <span className={`inline-flex px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border ${txn.status === "Completed" ? "bg-green-50 text-green-700 border-green-100" : "bg-blue-50 text-blue-700 border-blue-100"
                        }`}>
                        {txn.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                merchantSubscriptions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-[#f9fafb] transition-colors text-sm">
                    <td className="px-6 py-4 font-mono text-xs font-bold text-[#9ca3af]">{sub.id}</td>
                    <td className="px-6 py-4 font-bold text-[#111827]">{sub.merchant}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${sub.plan === "Enterprise" ? "bg-indigo-100 text-indigo-700" :
                        sub.plan === "Pro" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"
                        }`}>
                        {sub.plan}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-[#111827]">{sub.amount}</td>
                    <td className="px-6 py-4 text-right">
                      <span className="inline-flex px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border bg-green-50 text-green-700 border-green-100">
                        {sub.status}
                      </span>
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

function BroadcastsContent({ message, setMessage, audience, setAudience }: {
  message: string,
  setMessage: Dispatch<SetStateAction<string>>,
  audience: string,
  setAudience: Dispatch<SetStateAction<string>>
}) {
  const handleDeploy = () => {
    if (!message.trim()) {
      alert("Please enter a message to broadcast.");
      return;
    }
    alert(`Broadcast sent to ${audience}!\nMessage: ${message}`);
    setMessage("");
  };

  return (
    <div className="max-w-2xl space-y-8 pb-20">
      <div>
        <h1 className="text-2xl font-bold text-[#111827]">Communication Hub</h1>
        <p className="text-sm font-bold text-[#6b7280]">Targeted announcements and system updates.</p>
      </div>

      <div className="bg-white p-6 lg:p-10 rounded-3xl border border-[#e5e7eb] shadow-sm space-y-8">
        <div className="space-y-4">
          <label className="text-[10px] font-bold text-[#6b7280] uppercase tracking-[0.2em]">Select Audience</label>
          <div className="flex flex-wrap gap-6">
            {["Everyone", "Verified Users", "Merchant Owners"].map((target) => (
              <label key={target} className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="radio"
                  name="target"
                  className="w-5 h-5 text-[#111827] focus:ring-offset-0 focus:ring-0 border-[#d1d5db]"
                  checked={audience === target}
                  onChange={() => setAudience(target)}
                />
                <span className="text-sm font-bold text-[#4b5563] group-hover:text-[#111827] transition-colors">{target}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <label className="text-[10px] font-bold text-[#6b7280] uppercase tracking-[0.2em]">Message Body</label>
          <textarea
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full p-6 text-sm font-bold rounded-2xl border border-[#e5e7eb] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-[#9ca3af] bg-[#f9fafb]"
            placeholder="Write your platform announcement..."
          ></textarea>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <button
            onClick={handleDeploy}
            className="w-full sm:flex-1 py-4 bg-[#111827] text-white text-sm font-bold rounded-2xl hover:bg-[#1f2937] shadow-xl shadow-black/10 active:scale-[0.98] transition-all"
          >
            Deploy Broadcast
          </button>
          <button
            onClick={() => { setMessage(""); alert("Message discarded."); }}
            className="w-full sm:w-auto px-8 py-4 text-[#4b5563] text-sm font-bold hover:text-[#111827] transition-colors"
          >
            Discard
          </button>
        </div>
      </div>

      <div className="bg-indigo-900 p-8 rounded-3xl border border-indigo-800 flex gap-6 shadow-2xl shadow-indigo-500/10">
        <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white shrink-0">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-sm font-bold text-indigo-100 leading-relaxed">
          Broadcasting updates will push notifications immediately to the mobile app and send summary emails to the selected audience segment.
        </p>
      </div>
    </div>
  );
}

function SettingsContent({ settings, setSettings }: { settings: Settings, setSettings: Dispatch<SetStateAction<Settings>> }) {
  const toggleSetting = (key: string) => {
    setSettings((prev: any) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleFlush = () => {
    if (confirm("Are you sure you want to flush the system cache? This will log out all active sessions.")) {
      alert("System cache flushed successfully!");
    }
  };

  const sections = [
    {
      title: "Platform Control",
      description: "Manage global platform behavior and visibility.",
      items: [
        {
          id: "maintenance",
          title: "Maintenance Mode",
          description: "Disable all public-facing features for updates.",
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          ),
        },
        {
          id: "expressApproval",
          title: "Express Approval",
          description: "Automatically approve merchants with high trust scores.",
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
        },
      ],
    },
    {
      title: "Security & Privacy",
      description: "Configure system security protocols and data privacy.",
      items: [
        {
          id: "twoFactor",
          title: "Mandatory 2FA",
          description: "Force all admin accounts to use two-factor authentication.",
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          ),
        },
        {
          id: "publicProfile",
          title: "Public Merchant Profiles",
          description: "Allow merchant profiles to be indexed by search engines.",
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
          ),
        },
      ],
    },
  ];

  return (
    <div className="max-w-4xl space-y-10 pb-20">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-[#111827]">System Settings</h1>
        <p className="text-sm text-[#6b7280]">Configure global platform parameters and security preferences.</p>
      </div>

      <div className="space-y-8">
        {sections.map((section, idx) => (
          <div key={idx} className="space-y-4">
            <div className="px-1">
              <h2 className="text-sm font-bold text-[#111827]">{section.title}</h2>
              <p className="text-xs text-[#6b7280]">{section.description}</p>
            </div>
            <div className="bg-white rounded-2xl border border-[#e5e7eb] shadow-sm divide-y divide-[#f3f4f6] overflow-hidden">
              {section.items.map((item) => (
                <div key={item.id} className="p-5 sm:p-6 flex items-center justify-between hover:bg-[#f9fafb] transition-colors group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[#f3f4f6] flex items-center justify-center text-[#4b5563] group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                      {item.icon}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#111827]">{item.title}</p>
                      <p className="text-xs text-[#6b7280]">{item.description}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleSetting(item.id)}
                    className={`w-12 h-6 rounded-full relative transition-all duration-300 focus:outline-none ${settings[item.id] ? "bg-blue-600" : "bg-[#d1d5db]"
                      }`}
                  >
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-300 ${settings[item.id] ? "left-7" : "left-1"
                      }`}></span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="space-y-4">
          <div className="px-1">
            <h2 className="text-sm font-bold text-[#dc2626]">Advanced Operations</h2>
            <p className="text-xs text-[#6b7280]">Irreversible actions that affect the entire system.</p>
          </div>
          <div className="bg-red-50/30 rounded-2xl border border-red-100 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-red-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-red-900">System Cache Flush</p>
                <p className="text-xs text-red-600/80">Clears all temporary data, active sessions, and CDN edge cache.</p>
              </div>
            </div>
            <button
              onClick={handleFlush}
              className="px-6 py-2.5 bg-white text-red-600 text-xs font-bold uppercase tracking-wider rounded-xl border border-red-200 hover:bg-red-600 hover:text-white transition-all shadow-sm active:scale-95"
            >
              Execute Flush
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
