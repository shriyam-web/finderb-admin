"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "../../utils/supabase/client";
import { useAdminPanelRefresh } from "../lib/adminPanelRefresh";

export type YoutubePlaylist = {
  id: string;
  title: string;
  description: string | null;
  sort_order: number;
  is_published: boolean;
  created_at: string | null;
  updated_at: string | null;
  video_count?: number;
};

export type YoutubeVideo = {
  id: string;
  playlist_id: string;
  youtube_video_id: string;
  title: string;
  description: string | null;
  topic: string | null;
  thumbnail_url: string;
  watch_url: string;
  sort_order: number;
  is_published: boolean;
  created_at: string | null;
  updated_at: string | null;
};

const SOFT_VIDEO_CAP = 4;
const YOUTUBE_VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

function youtubeThumbnailUrl(videoId: string) {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

function youtubeWatchUrl(videoId: string, isShort = false) {
  return isShort
    ? `https://www.youtube.com/shorts/${videoId}`
    : `https://www.youtube.com/watch?v=${videoId}`;
}

function parseYoutubeVideoUrl(input: string): {
  videoId: string;
  isShort: boolean;
  watchUrl: string;
} | null {
  const raw = input.trim();
  if (!raw) return null;

  if (YOUTUBE_VIDEO_ID_RE.test(raw)) {
    return { videoId: raw, isShort: false, watchUrl: youtubeWatchUrl(raw) };
  }

  let url: URL;
  try {
    url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (!["youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"].includes(host)) {
    return null;
  }

  let videoId: string | null = null;
  let isShort = false;

  if (host === "youtu.be") {
    videoId = url.pathname.split("/").filter(Boolean)[0] ?? null;
  } else {
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] === "shorts" || parts[0] === "embed" || parts[0] === "live" || parts[0] === "v") {
      videoId = parts[1] ?? null;
      isShort = parts[0] === "shorts";
    } else {
      videoId = url.searchParams.get("v");
    }
  }

  if (!videoId || !YOUTUBE_VIDEO_ID_RE.test(videoId)) return null;

  return {
    videoId,
    isShort,
    watchUrl: youtubeWatchUrl(videoId, isShort),
  };
}

export default function YouTubePlaylistsContent({
  canManage = false,
}: {
  canManage?: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [playlists, setPlaylists] = useState<YoutubePlaylist[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [videos, setVideos] = useState<YoutubeVideo[]>([]);
  const [videosLoading, setVideosLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const [newPlaylistTitle, setNewPlaylistTitle] = useState("");
  const [newPlaylistDescription, setNewPlaylistDescription] = useState("");
  const [editingTitle, setEditingTitle] = useState("");

  const [videoUrl, setVideoUrl] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [videoTopic, setVideoTopic] = useState("");

  const selectedPlaylist = playlists.find((p) => p.id === selectedId) ?? null;

  const loadPlaylists = useCallback(async () => {
    setLoading(true);
    setError("");
    const supabase = createClient();

    const { data, error: fetchError } = await supabase
      .from("youtube_playlists")
      .select("id, title, description, sort_order, is_published, created_at, updated_at")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(
        fetchError.message.includes("does not exist")
          ? "YouTube tables are missing. Run supabase/youtube_playlists.sql in Supabase first."
          : fetchError.message || "Could not load playlists",
      );
      setPlaylists([]);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as YoutubePlaylist[];
    const ids = rows.map((row) => row.id);
    const counts = new Map<string, number>();

    if (ids.length) {
      const { data: videoRows } = await supabase
        .from("youtube_videos")
        .select("playlist_id")
        .in("playlist_id", ids);

      for (const row of videoRows ?? []) {
        const key = String(row.playlist_id);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }

    const withCounts = rows.map((row) => ({
      ...row,
      video_count: counts.get(row.id) ?? 0,
    }));

    setPlaylists(withCounts);
    setSelectedId((current) => {
      if (current && withCounts.some((p) => p.id === current)) return current;
      return withCounts[0]?.id ?? null;
    });
    setLoading(false);
  }, []);

  const loadVideos = useCallback(async (playlistId: string) => {
    setVideosLoading(true);
    const supabase = createClient();
    const { data, error: fetchError } = await supabase
      .from("youtube_videos")
      .select(
        "id, playlist_id, youtube_video_id, title, description, topic, thumbnail_url, watch_url, sort_order, is_published, created_at, updated_at",
      )
      .eq("playlist_id", playlistId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message || "Could not load videos");
      setVideos([]);
      setVideosLoading(false);
      return;
    }

    setVideos((data ?? []) as YoutubeVideo[]);
    setVideosLoading(false);
  }, []);

  useEffect(() => {
    loadPlaylists();
  }, [loadPlaylists]);

  const reloadPlaylists = useCallback(() => {
    void loadPlaylists();
    if (selectedId) void loadVideos(selectedId);
  }, [loadPlaylists, loadVideos, selectedId]);

  useAdminPanelRefresh(reloadPlaylists);

  useEffect(() => {
    if (!selectedId) {
      setVideos([]);
      setEditingTitle("");
      return;
    }
    const playlist = playlists.find((p) => p.id === selectedId);
    setEditingTitle(playlist?.title ?? "");
    loadVideos(selectedId);
  }, [selectedId, playlists, loadVideos]);

  const handleCreatePlaylist = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManage) return;
    const title = newPlaylistTitle.trim();
    if (!title) return;

    setBusy(true);
    setError("");
    const supabase = createClient();
    const maxSort = playlists.reduce((max, p) => Math.max(max, p.sort_order ?? 0), -1);

    const { data, error: insertError } = await supabase
      .from("youtube_playlists")
      .insert([
        {
          title,
          description: newPlaylistDescription.trim() || null,
          is_published: true,
          sort_order: maxSort + 1,
          updated_at: new Date().toISOString(),
        },
      ])
      .select("*")
      .single();

    setBusy(false);

    if (insertError) {
      setError(insertError.message || "Could not create playlist");
      return;
    }

    setNewPlaylistTitle("");
    setNewPlaylistDescription("");
    await loadPlaylists();
    if (data?.id) setSelectedId(String(data.id));
  };

  const handleSavePlaylistTitle = async () => {
    if (!canManage) return;
    if (!selectedId || !editingTitle.trim()) return;
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("youtube_playlists")
      .update({ title: editingTitle.trim(), updated_at: new Date().toISOString() })
      .eq("id", selectedId);
    setBusy(false);
    if (updateError) {
      setError(updateError.message || "Could not update playlist");
      return;
    }
    await loadPlaylists();
  };

  const handleTogglePlaylistPublished = async () => {
    if (!canManage) return;
    if (!selectedPlaylist) return;
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("youtube_playlists")
      .update({
        is_published: !selectedPlaylist.is_published,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selectedPlaylist.id);
    setBusy(false);
    if (updateError) {
      setError(updateError.message || "Could not update publish state");
      return;
    }
    await loadPlaylists();
  };

  const handleDeletePlaylist = async () => {
    if (!canManage) return;
    if (!selectedPlaylist) return;
    if (
      !window.confirm(
        `Delete playlist "${selectedPlaylist.title}" and all its videos? This cannot be undone.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("youtube_playlists")
      .delete()
      .eq("id", selectedPlaylist.id);
    setBusy(false);
    if (deleteError) {
      setError(deleteError.message || "Could not delete playlist");
      return;
    }
    setSelectedId(null);
    await loadPlaylists();
  };

  const handleReorderPlaylist = async (id: string, direction: "up" | "down") => {
    if (!canManage) return;
    const sorted = [...playlists].sort((a, b) => a.sort_order - b.sort_order);
    const index = sorted.findIndex((p) => p.id === id);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || swapIndex < 0 || swapIndex >= sorted.length) return;

    const current = sorted[index];
    const neighbor = sorted[swapIndex];
    setBusy(true);
    setError("");
    const supabase = createClient();
    const now = new Date().toISOString();
    const [{ error: err1 }, { error: err2 }] = await Promise.all([
      supabase
        .from("youtube_playlists")
        .update({ sort_order: neighbor.sort_order, updated_at: now })
        .eq("id", current.id),
      supabase
        .from("youtube_playlists")
        .update({ sort_order: current.sort_order, updated_at: now })
        .eq("id", neighbor.id),
    ]);
    setBusy(false);
    if (err1 || err2) {
      setError(err1?.message || err2?.message || "Could not reorder playlists");
      return;
    }
    await loadPlaylists();
  };

  const handleAddVideo = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManage) return;
    if (!selectedId) return;

    const parsed = parseYoutubeVideoUrl(videoUrl);
    if (!parsed) {
      setError("Enter a valid YouTube link (watch, youtu.be, or shorts)");
      return;
    }

    setBusy(true);
    setError("");
    const supabase = createClient();
    const maxSort = videos.reduce((max, v) => Math.max(max, v.sort_order ?? 0), -1);
    const title = videoTitle.trim() || `FinderB video ${parsed.videoId}`;

    const { error: insertError } = await supabase.from("youtube_videos").insert([
      {
        playlist_id: selectedId,
        youtube_video_id: parsed.videoId,
        title,
        description: null,
        topic: videoTopic.trim() || null,
        thumbnail_url: youtubeThumbnailUrl(parsed.videoId),
        watch_url: parsed.watchUrl,
        sort_order: maxSort + 1,
        is_published: true,
        updated_at: new Date().toISOString(),
      },
    ]);

    setBusy(false);

    if (insertError) {
      setError(
        insertError.code === "23505"
          ? "That video is already in this playlist"
          : insertError.message || "Could not add video",
      );
      return;
    }

    setVideoUrl("");
    setVideoTitle("");
    setVideoTopic("");
    await loadPlaylists();
    await loadVideos(selectedId);
  };

  const handleToggleVideoPublished = async (video: YoutubeVideo) => {
    if (!canManage) return;
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("youtube_videos")
      .update({
        is_published: !video.is_published,
        updated_at: new Date().toISOString(),
      })
      .eq("id", video.id);
    setBusy(false);
    if (updateError) {
      setError(updateError.message || "Could not update video");
      return;
    }
    if (selectedId) await loadVideos(selectedId);
  };

  const handleDeleteVideo = async (video: YoutubeVideo) => {
    if (!canManage) return;
    if (!window.confirm(`Remove "${video.title}" from this playlist?`)) return;
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("youtube_videos")
      .delete()
      .eq("id", video.id);
    setBusy(false);
    if (deleteError) {
      setError(deleteError.message || "Could not delete video");
      return;
    }
    await loadPlaylists();
    if (selectedId) await loadVideos(selectedId);
  };

  const handleReorderVideo = async (id: string, direction: "up" | "down") => {
    if (!canManage) return;
    if (!selectedId) return;
    const sorted = [...videos].sort((a, b) => a.sort_order - b.sort_order);
    const index = sorted.findIndex((v) => v.id === id);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || swapIndex < 0 || swapIndex >= sorted.length) return;

    const current = sorted[index];
    const neighbor = sorted[swapIndex];
    setBusy(true);
    setError("");
    const supabase = createClient();
    const now = new Date().toISOString();
    const [{ error: err1 }, { error: err2 }] = await Promise.all([
      supabase
        .from("youtube_videos")
        .update({ sort_order: neighbor.sort_order, updated_at: now })
        .eq("id", current.id),
      supabase
        .from("youtube_videos")
        .update({ sort_order: current.sort_order, updated_at: now })
        .eq("id", neighbor.id),
    ]);
    setBusy(false);
    if (err1 || err2) {
      setError(err1?.message || err2?.message || "Could not reorder videos");
      return;
    }
    await loadVideos(selectedId);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">YouTube Playlists</h1>
        <p className="mt-1 text-sm text-slate-500">
          Create playlists and paste YouTube video links. The FinderB homepage Tutorials section
          shows each published playlist with about {SOFT_VIDEO_CAP} videos.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="admin-card px-5 py-10 text-center text-sm text-slate-500">
          Loading playlists…
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_1fr]">
          <aside className="space-y-4">
            {canManage ? (
              <form onSubmit={handleCreatePlaylist} className="admin-card p-4">
                <h2 className="text-sm font-semibold text-slate-900">New playlist</h2>
                <label className="mt-3 block text-xs font-medium text-slate-500">
                  Title
                  <input
                    value={newPlaylistTitle}
                    onChange={(e) => setNewPlaylistTitle(e.target.value)}
                    required
                    className="admin-input mt-1 w-full"
                    placeholder="e.g. Getting started"
                  />
                </label>
                <label className="mt-3 block text-xs font-medium text-slate-500">
                  Description (optional)
                  <textarea
                    value={newPlaylistDescription}
                    onChange={(e) => setNewPlaylistDescription(e.target.value)}
                    rows={2}
                    className="admin-input mt-1 w-full"
                    placeholder="Shown under the playlist on the homepage"
                  />
                </label>
                <button
                  type="submit"
                  disabled={busy || !newPlaylistTitle.trim()}
                  className="admin-btn-primary mt-3 w-full disabled:opacity-50"
                >
                  {busy ? "Working…" : "Create playlist"}
                </button>
              </form>
            ) : null}

            <div className="admin-card overflow-hidden">
              <div className="border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-900">Playlists</h2>
              </div>
              {playlists.length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-500">No playlists yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {playlists.map((playlist, index) => (
                    <li key={playlist.id}>
                      <div
                        className={`flex items-start gap-2 px-3 py-3 ${
                          selectedId === playlist.id ? "bg-slate-50" : ""
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedId(playlist.id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {playlist.title}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {playlist.video_count ?? 0} video
                            {(playlist.video_count ?? 0) === 1 ? "" : "s"}
                            {" · "}
                            {playlist.is_published ? "Published" : "Draft"}
                          </p>
                        </button>
                        {canManage ? (
                          <div className="flex flex-col gap-1">
                            <button
                              type="button"
                              disabled={busy || index === 0}
                              onClick={() => handleReorderPlaylist(playlist.id, "up")}
                              className="rounded border border-slate-200 px-1.5 py-0.5 text-xs text-slate-500 hover:bg-white disabled:opacity-30"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              disabled={busy || index === playlists.length - 1}
                              onClick={() => handleReorderPlaylist(playlist.id, "down")}
                              className="rounded border border-slate-200 px-1.5 py-0.5 text-xs text-slate-500 hover:bg-white disabled:opacity-30"
                            >
                              ↓
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>

          <section className="space-y-4">
            {!selectedPlaylist ? (
              <div className="admin-card border-dashed px-5 py-12 text-center text-sm text-slate-500">
                Select or create a playlist to manage its videos.
              </div>
            ) : (
              <>
                <div className="admin-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    {canManage ? (
                      <label className="block min-w-0 flex-1 text-xs font-medium text-slate-500">
                        Playlist title
                        <input
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          className="admin-input mt-1 w-full max-w-md"
                        />
                      </label>
                    ) : (
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-slate-500">Playlist title</p>
                        <p className="mt-1 text-base font-semibold text-slate-900">
                          {selectedPlaylist.title}
                        </p>
                      </div>
                    )}
                    {canManage ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={handleSavePlaylistTitle}
                          disabled={busy || !editingTitle.trim()}
                          className="admin-btn-secondary disabled:opacity-50"
                        >
                          Save title
                        </button>
                        <button
                          type="button"
                          onClick={handleTogglePlaylistPublished}
                          disabled={busy}
                          className={`rounded-lg px-3 py-2 text-sm font-medium ${
                            selectedPlaylist.is_published
                              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                              : "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
                          }`}
                        >
                          {selectedPlaylist.is_published ? "Published" : "Draft"} — toggle
                        </button>
                        <button
                          type="button"
                          onClick={handleDeletePlaylist}
                          disabled={busy}
                          className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    ) : (
                      <span
                        className={`rounded-lg px-3 py-2 text-sm font-medium ${
                          selectedPlaylist.is_published
                            ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                            : "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
                        }`}
                      >
                        {selectedPlaylist.is_published ? "Published" : "Draft"}
                      </span>
                    )}
                  </div>
                  {selectedPlaylist.description ? (
                    <p className="mt-3 text-sm text-slate-500">{selectedPlaylist.description}</p>
                  ) : null}
                </div>

                {canManage ? (
                  <form onSubmit={handleAddVideo} className="admin-card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-sm font-semibold text-slate-900">Add video by link</h2>
                      {videos.length >= SOFT_VIDEO_CAP ? (
                        <p className="text-xs font-medium text-amber-700">
                          Tip: homepage shows about {SOFT_VIDEO_CAP} videos per playlist
                        </p>
                      ) : null}
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="block text-xs font-medium text-slate-500 sm:col-span-2">
                        YouTube URL
                        <input
                          value={videoUrl}
                          onChange={(e) => setVideoUrl(e.target.value)}
                          required
                          className="admin-input mt-1 w-full"
                          placeholder="https://www.youtube.com/watch?v=…"
                        />
                      </label>
                      <label className="block text-xs font-medium text-slate-500">
                        Title (optional)
                        <input
                          value={videoTitle}
                          onChange={(e) => setVideoTitle(e.target.value)}
                          className="admin-input mt-1 w-full"
                          placeholder="Display title on homepage"
                        />
                      </label>
                      <label className="block text-xs font-medium text-slate-500">
                        Topic (optional)
                        <input
                          value={videoTopic}
                          onChange={(e) => setVideoTopic(e.target.value)}
                          className="admin-input mt-1 w-full"
                          placeholder="e.g. For merchants"
                        />
                      </label>
                    </div>
                    <button
                      type="submit"
                      disabled={busy || !videoUrl.trim()}
                      className="mt-3 rounded-lg bg-[#ff0033] px-4 py-2 text-sm font-semibold text-white hover:bg-[#e6002f] disabled:opacity-50"
                    >
                      {busy ? "Working…" : "Add video"}
                    </button>
                  </form>
                ) : null}

                <div className="admin-card overflow-hidden">
                  <div className="border-b border-slate-100 px-4 py-3">
                    <h2 className="text-sm font-semibold text-slate-900">
                      Videos ({videos.length})
                    </h2>
                  </div>
                  {videosLoading ? (
                    <p className="px-4 py-8 text-center text-sm text-slate-500">Loading videos…</p>
                  ) : videos.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-slate-500">
                      {canManage
                        ? "No videos in this playlist yet. Paste a YouTube link above."
                        : "No videos in this playlist yet."}
                    </p>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {videos.map((video, index) => (
                        <li key={video.id} className="flex items-stretch gap-3 px-4 py-3">
                          <img
                            src={video.thumbnail_url}
                            alt=""
                            className="h-16 w-28 shrink-0 rounded-lg object-cover bg-slate-100"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {video.title}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-slate-500">
                              {video.topic || "No topic"} · {video.youtube_video_id}
                              {" · "}
                              {video.is_published ? "Published" : "Draft"}
                            </p>
                            <a
                              href={video.watch_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 inline-block text-xs font-medium text-sky-700 hover:underline"
                            >
                              Open on YouTube
                            </a>
                          </div>
                          {canManage ? (
                            <div className="flex flex-col items-end gap-1">
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  disabled={busy || index === 0}
                                  onClick={() => handleReorderVideo(video.id, "up")}
                                  className="rounded border border-slate-200 px-1.5 py-0.5 text-xs text-slate-500 disabled:opacity-30"
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  disabled={busy || index === videos.length - 1}
                                  onClick={() => handleReorderVideo(video.id, "down")}
                                  className="rounded border border-slate-200 px-1.5 py-0.5 text-xs text-slate-500 disabled:opacity-30"
                                >
                                  ↓
                                </button>
                              </div>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleToggleVideoPublished(video)}
                                className="text-xs font-medium text-slate-600 hover:underline"
                              >
                                {video.is_published ? "Unpublish" : "Publish"}
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleDeleteVideo(video)}
                                className="text-xs font-medium text-red-600 hover:underline"
                              >
                                Remove
                              </button>
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
