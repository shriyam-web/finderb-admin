"use client";

import { Dispatch, SetStateAction, useEffect, useMemo, useState } from "react";
import { createClient } from "../../utils/supabase/client";
import AdminOverlay from "./AdminOverlay";
import {
  ListSearchInput,
  ListSelect,
  PaginationControls,
  useClientPage,
} from "./AdminListControls";

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
  canManage = false,
  focusJobId = null,
}: {
  jobs: FinderBJob[];
  setJobs: Dispatch<SetStateAction<FinderBJob[]>>;
  canManage?: boolean;
  focusJobId?: string | null;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<JobStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedJob, setSelectedJob] = useState<FinderBJob | null>(null);
  const [rejectingJob, setRejectingJob] = useState<FinderBJob | null>(null);
  const [reason, setReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!focusJobId) return;
    const job = jobs.find((item) => item.id === focusJobId);
    if (!job) return;
    setSearchTerm("");
    setStatusFilter("pending");
    setTypeFilter("all");
    setSelectedJob(job);
  }, [focusJobId, jobs]);

  const stats = useMemo(
    () => ({
      pending: jobs.filter((job) => getJobStatus(job) === "pending").length,
      approved: jobs.filter((job) => getJobStatus(job) === "approved").length,
      rejected: jobs.filter((job) => getJobStatus(job) === "rejected").length,
    }),
    [jobs],
  );

  const jobTypes = useMemo(() => {
    const set = new Set(jobs.map((j) => j.type).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [jobs]);

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
      const matchesType = typeFilter === "all" || job.type === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [jobs, searchTerm, statusFilter, typeFilter]);

  const { page, setPage, totalPages, pageItems, pageSize, total } =
    useClientPage(
      filteredJobs,
      10,
      `${searchTerm}|${statusFilter}|${typeFilter}`,
    );

  const updateLocalJob = (id: string, updates: Partial<FinderBJob>) => {
    setJobs((prev) =>
      prev.map((job) => (job.id === id ? { ...job, ...updates } : job)),
    );
  };

  const handleApprove = async (job: FinderBJob) => {
    if (!canManage) return;
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
    if (!canManage) return;
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

  const handleDelete = async (job: FinderBJob) => {
    if (!canManage) return;
    const label = job.title || "this job";
    if (
      !confirm(
        `Delete "${label}"? This permanently removes it from FinderB Jobs.`,
      )
    ) {
      return;
    }

    setIsSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("jobs").delete().eq("id", job.id);
      if (error) throw error;

      setJobs((prev) => prev.filter((j) => j.id !== job.id));
      if (selectedJob?.id === job.id) setSelectedJob(null);
      if (rejectingJob?.id === job.id) {
        setRejectingJob(null);
        setReason("");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      alert(`Failed to delete job: ${message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const renderRowActions = (job: FinderBJob) => {
    const status = getJobStatus(job);
    const decided = status === "approved" || status === "rejected";

    return (
      <div className="flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={() => setSelectedJob(job)}
          className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-all border border-slate-100"
          title="View details"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
          </svg>
        </button>

        {canManage &&
          (decided ? (
            <button
              type="button"
              onClick={() => handleDelete(job)}
              disabled={isSaving}
              className="w-8 h-8 flex items-center justify-center text-rose-600 hover:bg-rose-50 rounded-lg transition-all border border-slate-100 disabled:opacity-40"
              title="Delete job"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => handleApprove(job)}
                disabled={isSaving}
                className="w-8 h-8 flex items-center justify-center text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all border border-slate-100 disabled:opacity-40"
                title="Approve"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </button>

              <button
                type="button"
                onClick={() => handleOpenReject(job)}
                disabled={isSaving}
                className="w-8 h-8 flex items-center justify-center text-rose-500 hover:bg-rose-50 rounded-lg transition-all border border-slate-100 disabled:opacity-40"
                title="Reject"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </>
          ))}
      </div>
    );
  };

  return (
    <div className="space-y-4 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 px-0.5">
        <div>
          <h1 className="admin-page-title">FinderB Jobs</h1>
          <p className="admin-page-subtitle">
            Review submitted jobs and approve or reject with a reason.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            {
              label: "Pending",
              value: stats.pending,
              color: "bg-amber-50 text-amber-800 border-amber-100",
            },
            {
              label: "Approved",
              value: stats.approved,
              color: "bg-emerald-50 text-emerald-800 border-emerald-100",
            },
            {
              label: "Rejected",
              value: stats.rejected,
              color: "bg-rose-50 text-rose-800 border-rose-100",
            },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() =>
                setStatusFilter(
                  item.label.toLowerCase() as JobStatus,
                )
              }
              className={`px-3 py-2 rounded-xl border text-left ${item.color}`}
            >
              <p className="text-[11px] font-medium opacity-80">{item.label}</p>
              <p className="text-base font-semibold tabular-nums leading-none mt-1">
                {item.value}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-2">
        <ListSearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search title, location, business…"
        />
        <ListSelect
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as JobStatus | "all")}
        >
          <option value="all">All status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </ListSelect>
        <ListSelect value={typeFilter} onChange={setTypeFilter}>
          <option value="all">All types</option>
          {jobTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </ListSelect>
      </div>

      <div className="admin-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/80 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 text-xs font-medium text-slate-500">
                  Job
                </th>
                <th className="px-4 py-3 text-xs font-medium text-slate-500">
                  Business
                </th>
                <th className="px-4 py-3 text-xs font-medium text-slate-500">
                  Type
                </th>
                <th className="px-4 py-3 text-xs font-medium text-slate-500">
                  Status
                </th>
                <th className="px-4 py-3 text-xs font-medium text-slate-500">
                  Reviewed
                </th>
                <th className="px-4 py-3 text-xs font-medium text-slate-500 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageItems.map((job) => {
                const status = getJobStatus(job);

                return (
                  <tr
                    key={job.id}
                    className="hover:bg-slate-50/80 transition-colors group"
                  >
                    <td className="px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {job.title}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">
                          {job.location}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-[10px] font-semibold text-teal-700 shrink-0">
                          {initials(job.business_name || job.business_id)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {job.business_name || "Unknown Business"}
                          </p>
                          <p className="text-xs text-slate-400 truncate">
                            {job.business_id}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="px-2 py-0.5 rounded-md bg-slate-50 text-slate-700 text-xs font-medium border border-slate-100 w-fit">
                          {job.type}
                        </span>
                        {job.department && (
                          <span className="text-xs text-slate-400">
                            {job.department}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-medium capitalize ${
                          status === "approved"
                            ? "bg-emerald-50 text-emerald-700"
                            : status === "rejected"
                              ? "bg-rose-50 text-rose-700"
                              : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-xs text-slate-600 tabular-nums">
                          {formatDateTime(job.reviewed_at || job.updated_at)}
                        </span>
                        {job.rejection_reason && (
                          <span className="text-xs text-rose-500 mt-0.5 max-w-[220px] truncate">
                            {job.rejection_reason}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {renderRowActions(job)}
                    </td>
                  </tr>
                );
              })}

              {pageItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <p className="text-sm text-slate-500">No jobs found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filteredJobs.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100">
            <PaginationControls
              page={page}
              totalPages={totalPages}
              total={total}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      {selectedJob && (
        <AdminOverlay className="flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h2 className="admin-page-title">{selectedJob.title}</h2>
                <p className="text-[10px] text-secondary font-medium mt-1">
                  FinderB Jobs Review Record
                </p>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-xl transition-all border border-transparent hover:border-slate-100"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  {
                    label: "Business",
                    value: selectedJob.business_name || selectedJob.business_id,
                  },
                  { label: "Location", value: selectedJob.location },
                  { label: "Type", value: selectedJob.type },
                  { label: "Department", value: selectedJob.department || "—" },
                  { label: "Salary", value: selectedJob.salary || "—" },
                  {
                    label: "Created",
                    value: formatDateTime(selectedJob.created_at),
                  },
                ].map((item) => (
                  <div key={item.label} className="space-y-1">
                    <p className="text-[9px] font-medium text-slate-400">
                      {item.label}
                    </p>
                    <p className="text-[11px] font-normal text-slate-900 break-words">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="space-y-1">
                <p className="text-[9px] font-medium text-slate-400">
                  Description
                </p>
                <p className="text-[11px] leading-relaxed text-slate-900 whitespace-pre-wrap">
                  {selectedJob.description}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-[9px] text-slate-400">Status</p>
                  <p className="text-[11px] font-medium mt-1 text-slate-900">
                    {getJobStatus(selectedJob)}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-[9px] text-slate-400">Reviewed by</p>
                  <p className="text-[11px] font-medium mt-1 break-words text-slate-900">
                    {selectedJob.reviewed_by || "—"}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-[9px] text-slate-400">Review Time</p>
                  <p className="text-[11px] font-medium mt-1 text-slate-900">
                    {formatDateTime(selectedJob.reviewed_at)}
                  </p>
                </div>
              </div>

              {selectedJob.rejection_reason && (
                <div className="p-5 rounded-xl bg-rose-50 border border-rose-100">
                  <p className="text-[9px] font-medium text-rose-600 mb-2">
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
                type="button"
                onClick={() => setSelectedJob(null)}
                className="px-6 py-2.5 text-sm font-medium text-slate-500 hover:bg-white rounded-xl transition-all border border-transparent hover:border-slate-200"
              >
                Close
              </button>

              {canManage &&
                (getJobStatus(selectedJob) === "pending" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedJob(null);
                        handleOpenReject(selectedJob);
                      }}
                      disabled={isSaving}
                      className="px-6 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 border border-rose-100 rounded-xl transition-all disabled:opacity-40"
                    >
                      Reject
                    </button>

                    <button
                      type="button"
                      onClick={() => handleApprove(selectedJob)}
                      disabled={isSaving}
                      className="px-8 py-2.5 bg-teal-700 text-white text-sm font-medium rounded-xl hover:bg-teal-800 transition-all disabled:opacity-40"
                    >
                      Approve Job
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleDelete(selectedJob)}
                    disabled={isSaving}
                    className="px-6 py-2.5 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all disabled:opacity-40"
                  >
                    Delete job
                  </button>
                ))}
            </div>
          </div>
        </AdminOverlay>
      )}

      {rejectingJob && (
        <AdminOverlay className="flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-xl overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50">
              <h2 className="admin-page-title">Reject Job</h2>
              <p className="text-[10px] text-rose-500 font-medium mt-1">
                {rejectingJob.title}
              </p>
            </div>

            <div className="p-8 space-y-5">
              <div className="space-y-2">
                <label className="block text-[9px] font-medium text-slate-400">
                  Rejection reason
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why this job is being rejected..."
                  className="w-full min-h-[140px] bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[11px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-300 transition-all"
                />
              </div>

              <div className="p-4 rounded-xl bg-amber-50 border border-amber-100">
                <p className="text-[9px] font-medium text-amber-700 mb-1">
                  Warning
                </p>
                <p className="text-[11px] text-amber-900 leading-relaxed">
                  This will mark the job as rejected and store the reason for
                  audit history.
                </p>
              </div>
            </div>

            <div className="px-8 py-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setRejectingJob(null);
                  setReason("");
                }}
                className="px-6 py-2.5 text-[10px] font-medium text-slate-500 hover:bg-white rounded-xl transition-all border border-transparent hover:border-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={isSaving}
                className="px-8 py-2.5 bg-rose-600 text-white text-[10px] font-medium rounded-xl hover:bg-rose-700 transition-all disabled:opacity-40"
              >
                {isSaving ? "Saving..." : "Reject Job"}
              </button>
            </div>
          </div>
        </AdminOverlay>
      )}
    </div>
  );
}
