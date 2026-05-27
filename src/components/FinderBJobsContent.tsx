"use client";

import { Dispatch, SetStateAction, useMemo, useState } from "react";
import { createClient } from "../../utils/supabase/client";

export interface FinderBJob {
  id: string;
  title: string;
  type: string;
  location: string;
  salary: string | null;
  description: string;
  department: string | null;
  status: string;
  business_id: string;
  created_at: string;
  updated_at: string;
  approval_status?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  rejection_reason?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  business_name?: string | null;
}

type JobStatus = "pending" | "approved" | "rejected";

function getJobStatus(job: FinderBJob): JobStatus {
  const status = job.approval_status?.toLowerCase();
  if (status === "approved" || status === "rejected" || status === "pending") {
    return status;
  }
  return "pending";
}

function getReviewerLabel(): string {
  if (typeof window === "undefined") return "admin";
  const sessionStr = localStorage.getItem("admin_session");
  if (!sessionStr) return "admin";

  try {
    const session = JSON.parse(sessionStr) as { email?: string; id?: string };
    return session.email || session.id || "admin";
  } catch {
    return "admin";
  }
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initials(text: string): string {
  return text
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function FinderBJobsContent({
  jobs,
  setJobs,
}: {
  jobs: FinderBJob[];
  setJobs: Dispatch<SetStateAction<FinderBJob[]>>;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<JobStatus | "all">("all");
  const [selectedJob, setSelectedJob] = useState<FinderBJob | null>(null);
  const [rejectingJob, setRejectingJob] = useState<FinderBJob | null>(null);
  const [reason, setReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const stats = useMemo(
    () => ({
      pending: jobs.filter((job) => getJobStatus(job) === "pending").length,
      approved: jobs.filter((job) => getJobStatus(job) === "approved").length,
      rejected: jobs.filter((job) => getJobStatus(job) === "rejected").length,
    }),
    [jobs]
  );

  const filteredJobs = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return jobs.filter((job) => {
      const status = getJobStatus(job);
      const searchableText = [
        job.title,
        job.type,
        job.location,
        job.department || "",
        job.business_name || "",
        job.description,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = term.length === 0 || searchableText.includes(term);
      const matchesStatus = statusFilter === "all" || status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [jobs, searchTerm, statusFilter]);

  const updateLocalJob = (id: string, updates: Partial<FinderBJob>) => {
    setJobs((prev) =>
      prev.map((job) => (job.id === id ? { ...job, ...updates } : job))
    );
  };

  const handleApprove = async (job: FinderBJob) => {
    const reviewer = getReviewerLabel();
    setIsSaving(true);

    try {
      const supabase = createClient();
      const now = new Date().toISOString();

      const { error } = await supabase
        .from("jobs")
        .update({
          approval_status: "approved",
          approved_at: now,
          approved_by: reviewer,
          rejection_reason: null,
          reviewed_at: now,
          reviewed_by: reviewer,
        })
        .eq("id", job.id);

      if (error) throw error;

      updateLocalJob(job.id, {
        approval_status: "approved",
        approved_at: now,
        approved_by: reviewer,
        rejection_reason: null,
        reviewed_at: now,
        reviewed_by: reviewer,
      });

      setSelectedJob(null);
      alert(`Job "${job.title}" approved successfully.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      alert(`Failed to approve job: ${message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectingJob || !reason.trim()) {
      alert("Please provide a rejection reason.");
      return;
    }

    const reviewer = getReviewerLabel();
    setIsSaving(true);

    try {
      const supabase = createClient();
      const now = new Date().toISOString();

      const { error } = await supabase
        .from("jobs")
        .update({
          approval_status: "rejected",
          approved_at: null,
          approved_by: null,
          rejection_reason: reason.trim(),
          reviewed_at: now,
          reviewed_by: reviewer,
        })
        .eq("id", rejectingJob.id);

      if (error) throw error;

      updateLocalJob(rejectingJob.id, {
        approval_status: "rejected",
        approved_at: null,
        approved_by: null,
        rejection_reason: reason.trim(),
        reviewed_at: now,
        reviewed_by: reviewer,
      });

      setRejectingJob(null);
      setReason("");
      alert(`Job "${rejectingJob.title}" rejected.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      alert(`Failed to reject job: ${message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenReject = (job: FinderBJob) => {
    setRejectingJob(job);
    setReason(job.rejection_reason || "");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 px-1">
        <div>
          <h1 className="text-xl font-medium text-slate-900 tracking-tight uppercase">
            FinderB Jobs Approval
          </h1>
          <p className="text-[10px] text-slate-500 font-normal uppercase tracking-widest opacity-70">
            Review submitted jobs and approve or reject them with a reason.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Pending", value: stats.pending, color: "bg-amber-50 text-amber-700 border-amber-100" },
            { label: "Approved", value: stats.approved, color: "bg-emerald-50 text-emerald-700 border-emerald-100" },
            { label: "Rejected", value: stats.rejected, color: "bg-rose-50 text-rose-700 border-rose-100" },
          ].map((item) => (
            <div
              key={item.label}
              className={`px-4 py-3 rounded-2xl border shadow-sm ${item.color}`}
            >
              <p className="text-[9px] font-medium uppercase tracking-[0.2em] opacity-80">
                {item.label}
              </p>
              <p className="text-lg font-semibold tabular-nums leading-none mt-1">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[240px]">
          <input
            type="text"
            placeholder="Search by title, location, business, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all uppercase tracking-widest"
          />
          <svg
            className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as JobStatus | "all")}
          className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all uppercase tracking-widest min-w-[160px]"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-[9px] font-medium text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">
                  Job
                </th>
                <th className="px-6 py-4 text-[9px] font-medium text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">
                  Business
                </th>
                <th className="px-6 py-4 text-[9px] font-medium text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">
                  Type
                </th>
                <th className="px-6 py-4 text-[9px] font-medium text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">
                  Status
                </th>
                <th className="px-6 py-4 text-[9px] font-medium text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">
                  Reviewed
                </th>
                <th className="px-6 py-4 text-[9px] font-medium text-slate-400 uppercase tracking-[0.2em] text-right whitespace-nowrap">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50/80">
              {filteredJobs.map((job) => {
                const status = getJobStatus(job);

                return (
                  <tr key={job.id} className="hover:bg-primary/[0.01] transition-colors group">
                    <td className="px-6 py-4">
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium text-slate-900 tracking-tight truncate">
                          {job.title}
                        </p>
                        <p className="text-[9px] text-slate-500 mt-0.5 truncate">
                          {job.location}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-[9px] font-bold text-primary shrink-0">
                          {initials(job.business_name || job.business_id)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium text-slate-900 truncate">
                            {job.business_name || "Unknown Business"}
                          </p>
                          <p className="text-[9px] text-slate-500 truncate">
                            {job.business_id}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-50 text-secondary font-medium text-[9px] uppercase tracking-widest border border-slate-100 w-fit">
                          {job.type}
                        </span>
                        {job.department && (
                          <span className="text-[9px] text-slate-400 uppercase tracking-widest">
                            {job.department}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[9px] font-medium uppercase tracking-widest border ${
                          status === "approved"
                            ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                            : status === "rejected"
                              ? "bg-rose-50 text-rose-600 border-rose-100"
                              : "bg-amber-50 text-amber-600 border-amber-100"
                        }`}
                      >
                        {status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-600 tabular-nums">
                          {formatDateTime(job.reviewed_at || job.updated_at)}
                        </span>
                        {job.rejection_reason && (
                          <span className="text-[9px] text-rose-500 mt-0.5 max-w-[220px] truncate">
                            Reason: {job.rejection_reason}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedJob(job)}
                          className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary/5 hover:border-primary/20 rounded-xl transition-all border border-slate-100 shadow-sm"
                          title="View details"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>

                        <button
                          onClick={() => handleApprove(job)}
                          disabled={isSaving || status === "approved"}
                          className="w-8 h-8 flex items-center justify-center text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all border border-slate-100 hover:border-emerald-200 shadow-sm disabled:opacity-40"
                          title="Approve"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                          </svg>
                        </button>

                        <button
                          onClick={() => handleOpenReject(job)}
                          disabled={isSaving || status === "rejected"}
                          className="w-8 h-8 flex items-center justify-center text-rose-500 hover:bg-rose-50 rounded-xl transition-all border border-slate-100 hover:border-rose-200 shadow-sm disabled:opacity-40"
                          title="Reject"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredJobs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-14 text-center">
                    <div className="flex flex-col items-center opacity-35">
                      <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-4">
                        <svg className="w-7 h-7 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">
                        No jobs found
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedJob && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h2 className="text-xl font-medium text-slate-900 tracking-tight uppercase">
                  {selectedJob.title}
                </h2>
                <p className="text-[10px] text-secondary font-medium uppercase tracking-widest mt-1">
                  FinderB Jobs Review Record
                </p>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-xl transition-all border border-transparent hover:border-slate-100 shadow-sm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  { label: "Business", value: selectedJob.business_name || selectedJob.business_id },
                  { label: "Location", value: selectedJob.location },
                  { label: "Type", value: selectedJob.type },
                  { label: "Department", value: selectedJob.department || "—" },
                  { label: "Salary", value: selectedJob.salary || "—" },
                  { label: "Created", value: formatDateTime(selectedJob.created_at) },
                ].map((item) => (
                  <div key={item.label} className="space-y-1">
                    <p className="text-[9px] font-medium text-slate-400 uppercase tracking-widest">
                      {item.label}
                    </p>
                    <p className="text-[11px] font-normal text-slate-900 break-words">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="space-y-1">
                <p className="text-[9px] font-medium text-slate-400 uppercase tracking-widest">
                  Description
                </p>
                <p className="text-[11px] leading-relaxed text-slate-900 whitespace-pre-wrap">
                  {selectedJob.description}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <p className="text-[9px] uppercase tracking-widest text-slate-400">Status</p>
                  <p className="text-[11px] font-medium mt-1 uppercase tracking-widest text-slate-900">
                    {getJobStatus(selectedJob)}
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <p className="text-[9px] uppercase tracking-widest text-slate-400">Reviewed by</p>
                  <p className="text-[11px] font-medium mt-1 break-words text-slate-900">
                    {selectedJob.reviewed_by || "—"}
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <p className="text-[9px] uppercase tracking-widest text-slate-400">Review Time</p>
                  <p className="text-[11px] font-medium mt-1 text-slate-900">
                    {formatDateTime(selectedJob.reviewed_at)}
                  </p>
                </div>
              </div>

              {selectedJob.rejection_reason && (
                <div className="p-5 rounded-2xl bg-rose-50 border border-rose-100">
                  <p className="text-[9px] font-medium text-rose-600 uppercase tracking-widest mb-2">
                    Rejection Reason
                  </p>
                  <p className="text-[11px] leading-relaxed text-rose-900 whitespace-pre-wrap">
                    {selectedJob.rejection_reason}
                  </p>
                </div>
              )}
            </div>

            <div className="px-8 py-6 border-t border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-end gap-3">
              <button
                onClick={() => setSelectedJob(null)}
                className="px-6 py-2.5 text-[10px] font-medium text-slate-500 uppercase tracking-widest hover:bg-white rounded-xl transition-all border border-transparent hover:border-slate-200"
              >
                Close
              </button>

              <button
                onClick={() => {
                  setSelectedJob(null);
                  handleOpenReject(selectedJob);
                }}
                disabled={isSaving || getJobStatus(selectedJob) === "rejected"}
                className="px-6 py-2.5 text-[10px] font-medium text-rose-600 hover:bg-rose-50 border border-rose-100 rounded-xl transition-all uppercase tracking-widest shadow-sm disabled:opacity-40"
              >
                Reject
              </button>

              <button
                onClick={() => handleApprove(selectedJob)}
                disabled={isSaving || getJobStatus(selectedJob) === "approved"}
                className="px-8 py-2.5 bg-primary text-white text-[10px] font-medium rounded-xl hover:bg-primary-700 shadow-xl shadow-primary/20 transition-all active:scale-[0.98] uppercase tracking-widest disabled:opacity-40"
              >
                Approve Job
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectingJob && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-xl font-medium text-slate-900 tracking-tight uppercase">
                Reject Job
              </h2>
              <p className="text-[10px] text-rose-500 font-medium uppercase tracking-widest mt-1">
                {rejectingJob.title}
              </p>
            </div>

            <div className="p-8 space-y-5">
              <div className="space-y-2">
                <label className="block text-[9px] font-medium text-slate-400 uppercase tracking-widest">
                  Rejection reason
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why this job is being rejected..."
                  className="w-full min-h-[140px] bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-[11px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-300 transition-all"
                />
              </div>

              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100">
                <p className="text-[9px] font-medium text-amber-700 uppercase tracking-widest mb-1">
                  Warning
                </p>
                <p className="text-[11px] text-amber-900 leading-relaxed">
                  This will mark the job as rejected and store the reason for audit history.
                </p>
              </div>
            </div>

            <div className="px-8 py-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setRejectingJob(null);
                  setReason("");
                }}
                className="px-6 py-2.5 text-[10px] font-medium text-slate-500 uppercase tracking-widest hover:bg-white rounded-xl transition-all border border-transparent hover:border-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={isSaving}
                className="px-8 py-2.5 bg-rose-600 text-white text-[10px] font-medium rounded-xl hover:bg-rose-700 shadow-xl shadow-rose-200 transition-all uppercase tracking-widest disabled:opacity-40"
              >
                {isSaving ? "Saving..." : "Reject Job"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
