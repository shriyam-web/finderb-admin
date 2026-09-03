"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { createClient } from "../../utils/supabase/client";
import { uploadToCloudinary } from "../utils/cloudinary";
import {
  ListSearchInput,
  ListSelect,
  PaginationControls,
  useClientPage,
} from "./AdminListControls";

export type TouristPlaceRecord = {
  id: string;
  name: string;
  description: string | null;
  location: string;
  category: string | null;
  image_url: string | null;
  best_time: string | null;
  visit_duration: string | null;
  entry_fee: string | null;
  how_to_reach: string | null;
  highlights: string | null;
  tips: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type TagableMerchant = {
  id: string;
  name: string;
  category: string;
  city?: string | null;
  status?: string;
};

const EMPTY_PLACE: Partial<TouristPlaceRecord> & { taggedBusinessIds: string[] } = {
  name: "",
  description: "",
  location: "",
  category: "",
  image_url: "",
  best_time: "",
  visit_duration: "",
  entry_fee: "",
  how_to_reach: "",
  highlights: "",
  tips: "",
  taggedBusinessIds: [],
};

function isTourTravelCategory(category: string | null | undefined) {
  return /tour|travel|travels|holiday|trip|tourism|agent|operator|package/i.test(
    category || "",
  );
}

async function syncPlaceMerchants(placeId: string, businessIds: string[]) {
  const supabase = createClient();
  const { error: deleteError } = await supabase
    .from("tourist_place_merchants")
    .delete()
    .eq("tourist_place_id", placeId);

  if (deleteError) throw deleteError;

  const uniqueIds = [...new Set(businessIds.filter(Boolean))];
  if (!uniqueIds.length) return;

  const { error: insertError } = await supabase.from("tourist_place_merchants").insert(
    uniqueIds.map((business_id, index) => ({
      tourist_place_id: placeId,
      business_id,
      sort_order: index,
    })),
  );

  if (insertError) throw insertError;
}

export default function TouristPlacesContent({
  merchants,
  canManage = false,
}: {
  merchants: TagableMerchant[];
  canManage?: boolean;
}) {
  const [places, setPlaces] = useState<TouristPlaceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingPlace, setEditingPlace] = useState<
    (Partial<TouristPlaceRecord> & { taggedBusinessIds: string[] }) | null
  >(null);
  const [isAddingPlace, setIsAddingPlace] = useState(false);
  const [newPlace, setNewPlace] = useState({ ...EMPTY_PLACE });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [merchantSearch, setMerchantSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [tagCounts, setTagCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [partnerFilter, setPartnerFilter] = useState<
    "all" | "tagged" | "untagged"
  >("all");
  const [imageFilter, setImageFilter] = useState<"all" | "has" | "missing">(
    "all",
  );

  const travelMerchants = useMemo(
    () =>
      merchants.filter(
        (m) =>
          (m.status || "Active") === "Active" && isTourTravelCategory(m.category),
      ),
    [merchants],
  );

  const loadPlaces = useCallback(async () => {
    setLoading(true);
    setError("");
    const supabase = createClient();

    const { data, error: fetchError } = await supabase
      .from("tourist_places")
      .select(
        "id, name, description, location, category, image_url, best_time, visit_duration, entry_fee, how_to_reach, highlights, tips, created_at, updated_at",
      )
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(
        fetchError.message.includes("does not exist") ||
          fetchError.message.includes("column")
          ? "Tourist place detail columns may be missing. Run supabase/tourist_place_details.sql in Supabase."
          : fetchError.message || "Could not load tourist places",
      );
      setPlaces([]);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as TouristPlaceRecord[];
    setPlaces(rows);

    const ids = rows.map((p) => p.id);
    if (ids.length) {
      const { data: tags } = await supabase
        .from("tourist_place_merchants")
        .select("tourist_place_id")
        .in("tourist_place_id", ids);

      const counts: Record<string, number> = {};
      for (const row of tags ?? []) {
        const key = String(row.tourist_place_id);
        counts[key] = (counts[key] ?? 0) + 1;
      }
      setTagCounts(counts);
    } else {
      setTagCounts({});
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadPlaces();
  }, [loadPlaces]);

  const placeCategories = useMemo(() => {
    const set = new Set(
      places.map((p) => p.category).filter((c): c is string => Boolean(c)),
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [places]);

  const filteredPlaces = useMemo(() => {
    const q = search.trim().toLowerCase();
    return places.filter((place) => {
      if (categoryFilter !== "all" && place.category !== categoryFilter) {
        return false;
      }
      const tags = tagCounts[place.id] ?? 0;
      if (partnerFilter === "tagged" && tags === 0) return false;
      if (partnerFilter === "untagged" && tags > 0) return false;
      const hasImage = Boolean(place.image_url);
      if (imageFilter === "has" && !hasImage) return false;
      if (imageFilter === "missing" && hasImage) return false;
      if (!q) return true;
      const hay = [
        place.name,
        place.location,
        place.category,
        place.description,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [places, search, categoryFilter, partnerFilter, imageFilter, tagCounts]);

  const { page, setPage, totalPages, pageItems, pageSize, total } =
    useClientPage(
      filteredPlaces,
      12,
      `${search}|${categoryFilter}|${partnerFilter}|${imageFilter}`,
    );

  const loadTagsForPlace = async (placeId: string) => {
    const supabase = createClient();
    const { data, error: tagError } = await supabase
      .from("tourist_place_merchants")
      .select("business_id, sort_order")
      .eq("tourist_place_id", placeId)
      .order("sort_order", { ascending: true });

    if (tagError) {
      if (
        tagError.message.includes("does not exist") ||
        tagError.message.includes("relation")
      ) {
        setError(
          "tourist_place_merchants table missing. Run supabase/tourist_place_details.sql in Supabase.",
        );
      }
      return [] as string[];
    }

    return (data ?? []).map((row) => String(row.business_id));
  };

  const openEdit = async (place: TouristPlaceRecord) => {
    setIsAddingPlace(false);
    setMerchantSearch("");
    const taggedBusinessIds = await loadTagsForPlace(place.id);
    setEditingPlace({ ...place, taggedBusinessIds });
  };

  const handleImageUpload = async (
    file: File,
    isEditing: boolean,
  ) => {
    if (!canManage) return;
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
    } catch (err) {
      alert(
        "Upload failed: " + (err instanceof Error ? err.message : "Unknown error"),
      );
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const placePayload = (place: Partial<TouristPlaceRecord>) => ({
    name: place.name?.trim() || "",
    description: place.description?.trim() || null,
    location: place.location?.trim() || "",
    category: place.category?.trim() || null,
    image_url: place.image_url || null,
    best_time: place.best_time?.trim() || null,
    visit_duration: place.visit_duration?.trim() || null,
    entry_fee: place.entry_fee?.trim() || null,
    how_to_reach: place.how_to_reach?.trim() || null,
    highlights: place.highlights?.trim() || null,
    tips: place.tips?.trim() || null,
  });

  const handleCreate = async () => {
    if (!canManage) return;
    if (!newPlace.name?.trim()) return;
    setSaving(true);
    setError("");
    const supabase = createClient();
    const payload = placePayload(newPlace);

    const { data, error: insertError } = await supabase
      .from("tourist_places")
      .insert([payload])
      .select("*")
      .single();

    if (insertError) {
      setSaving(false);
      setError(insertError.message || "Could not create place");
      return;
    }

    try {
      await syncPlaceMerchants(String(data.id), newPlace.taggedBusinessIds || []);
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : "Place saved but merchant tags failed");
      await loadPlaces();
      return;
    }

    setSaving(false);
    setIsAddingPlace(false);
    setNewPlace({ ...EMPTY_PLACE });
    await loadPlaces();
  };

  const handleSave = async () => {
    if (!canManage) return;
    if (!editingPlace?.id || !editingPlace.name?.trim()) return;
    setSaving(true);
    setError("");
    const supabase = createClient();
    const payload = {
      ...placePayload(editingPlace),
      updated_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from("tourist_places")
      .update(payload)
      .eq("id", editingPlace.id);

    if (updateError) {
      setSaving(false);
      setError(updateError.message || "Could not update place");
      return;
    }

    try {
      await syncPlaceMerchants(
        editingPlace.id,
        editingPlace.taggedBusinessIds || [],
      );
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : "Place saved but merchant tags failed");
      await loadPlaces();
      return;
    }

    setSaving(false);
    setEditingPlace(null);
    await loadPlaces();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!canManage) return;
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setError("");
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("tourist_places")
      .delete()
      .eq("id", id);
    if (deleteError) {
      setError(deleteError.message || "Could not delete place");
      return;
    }
    if (editingPlace?.id === id) setEditingPlace(null);
    await loadPlaces();
  };

  const merchantPool = useMemo(() => {
    const term = merchantSearch.trim().toLowerCase();
    const active = merchants.filter((m) => (m.status || "Active") === "Active");
    const preferred = active.filter((m) => isTourTravelCategory(m.category));
    const other = active.filter((m) => !isTourTravelCategory(m.category));
    const ordered = [...preferred, ...other];

    if (!term) return ordered.slice(0, 12);

    return ordered
      .filter(
        (m) =>
          m.name.toLowerCase().includes(term) ||
          m.category.toLowerCase().includes(term) ||
          (m.city || "").toLowerCase().includes(term) ||
          m.id.toLowerCase().includes(term),
      )
      .slice(0, 12);
  }, [merchants, merchantSearch]);

  const setTaggedIds = (
    isEditing: boolean,
    place: Partial<TouristPlaceRecord> & { taggedBusinessIds: string[] },
    businessId: string,
  ) => {
    if (!canManage) return;
    const current = place.taggedBusinessIds || [];
    const next = current.includes(businessId)
      ? current.filter((id) => id !== businessId)
      : [...current, businessId];

    if (isEditing) {
      setEditingPlace({ ...place, taggedBusinessIds: next });
    } else {
      setNewPlace({ ...place, taggedBusinessIds: next });
    }
  };

  const renderMerchantTagger = (
    place: Partial<TouristPlaceRecord> & { taggedBusinessIds: string[] },
    isEditing: boolean,
  ) => {
    const tagged = place.taggedBusinessIds || [];
    const taggedMerchants = tagged
      .map((id) => merchants.find((m) => m.id === id))
      .filter(Boolean) as TagableMerchant[];

    return (
      <div className="md:col-span-2 space-y-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
        <div>
          <h4 className="text-xs font-semibold text-slate-900">
            Tour &amp; Travels merchants
          </h4>
          <p className="mt-1 text-[10px] text-slate-500">
            Tag merchants that can take visitors to this destination. Prefer Tour &amp;
            Travels categories; you can still search any active merchant.
          </p>
        </div>

        {taggedMerchants.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {taggedMerchants.map((m) => (
              <button
                key={m.id}
                type="button"
                disabled={!canManage}
                onClick={() => setTaggedIds(isEditing, place, m.id)}
                className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1 text-[10px] font-medium text-sky-800 ring-1 ring-sky-200 disabled:cursor-default"
                title={canManage ? "Click to remove" : undefined}
              >
                {m.name}
                <span className="text-sky-500">×</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-slate-400">No merchants tagged yet.</p>
        )}

        <input
          value={merchantSearch}
          onChange={(e) => setMerchantSearch(e.target.value)}
          disabled={!canManage}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-900 disabled:bg-slate-50 disabled:text-slate-400"
          placeholder="Search merchants (Tour & Travels first)…"
        />

        <div className="max-h-48 space-y-1 overflow-y-auto">
          {merchantPool.length === 0 ? (
            <p className="px-1 py-2 text-[10px] text-slate-400">No matching merchants.</p>
          ) : (
            merchantPool.map((m) => {
              const selected = tagged.includes(m.id);
              const travel = isTourTravelCategory(m.category);
              return (
                <button
                  key={m.id}
                  type="button"
                  disabled={!canManage}
                  onClick={() => setTaggedIds(isEditing, place, m.id)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[11px] transition disabled:cursor-default disabled:opacity-60 ${
                    selected
                      ? "bg-sky-100 text-sky-900"
                      : "bg-white text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{m.name}</span>
                    <span className="block truncate text-[9px] text-slate-500">
                      {m.category}
                      {m.city ? ` · ${m.city}` : ""}
                      {travel ? " · Tour & Travels" : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-[10px] font-semibold">
                    {selected ? "Tagged" : "Tag"}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {travelMerchants.length === 0 ? (
          <p className="text-[10px] text-amber-700">
            No active merchants match Tour/Travel categories yet. You can still search and
            tag any merchant by name.
          </p>
        ) : null}
      </div>
    );
  };

  const renderPlaceForm = (
    place: Partial<TouristPlaceRecord> & { taggedBusinessIds: string[] },
    setPlace: Dispatch<SetStateAction<any>>,
    isEditing: boolean,
  ) => (
    <div className="mb-8 space-y-6 rounded-3xl border border-slate-200/60 bg-white p-8 animate-in slide-in-from-top-4 duration-300">
      <div className="flex items-center justify-between border-b border-slate-50 pb-5">
        <h3 className="flex items-center gap-2 text-sm font-medium text-slate-900">
          <span className="h-2 w-2 rounded-full bg-primary" />
          {isEditing ? `Edit: ${place.name}` : "Add New Tourist Place"}
        </h3>
        <button
          type="button"
          onClick={() =>
            isEditing ? setEditingPlace(null) : setIsAddingPlace(false)
          }
          className="text-slate-400 hover:text-slate-600"
        >
          ✕
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[9px] font-medium text-slate-400">
              Place Name
            </label>
            <input
              type="text"
              value={place.name || ""}
              onChange={(e) => setPlace({ ...place, name: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[11px] text-slate-900"
              placeholder="Enter place name"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[9px] font-medium text-slate-400">
              Location (City, State)
            </label>
            <input
              type="text"
              value={place.location || ""}
              onChange={(e) => setPlace({ ...place, location: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[11px] text-slate-900"
              placeholder="e.g. Jaipur, Rajasthan"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[9px] font-medium text-slate-400">
              Category / Type
            </label>
            <input
              type="text"
              value={place.category || ""}
              onChange={(e) => setPlace({ ...place, category: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[11px] text-slate-900"
              placeholder="e.g. Historical, Nature, Sightseeing"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[9px] font-medium text-slate-400">
              Description
            </label>
            <textarea
              value={place.description || ""}
              onChange={(e) => setPlace({ ...place, description: e.target.value })}
              className="min-h-[100px] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[11px] text-slate-900"
              placeholder="About this place"
            />
          </div>
        </div>

        <div className="space-y-4">
          <label className="mb-1.5 block text-[9px] font-medium text-slate-400">
            Place Image
          </label>
          <div className="relative">
            <input
              type="file"
              onChange={(e) =>
                e.target.files?.[0] &&
                handleImageUpload(e.target.files[0], isEditing)
              }
              className="hidden"
              id={`tp-upload-${isEditing ? "edit" : "new"}`}
              disabled={uploading || !canManage}
            />
            <label
              htmlFor={`tp-upload-${isEditing ? "edit" : "new"}`}
              className={`flex aspect-video w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-slate-50 p-4 text-[10px] text-slate-500 ${
                canManage
                  ? uploading
                    ? "cursor-pointer border-primary/30"
                    : "cursor-pointer border-slate-200 hover:border-primary/30"
                  : "cursor-default border-slate-200 opacity-60"
              }`}
            >
              {uploading ? (
                <span className="font-medium text-primary">
                  {uploadProgress}% Uploading...
                </span>
              ) : place.image_url ? (
                <img
                  src={place.image_url}
                  className="h-full w-full rounded-xl object-cover"
                  alt="Preview"
                />
              ) : (
                <span>Click to Upload Image</span>
              )}
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[9px] font-medium text-slate-400">
                Best time
              </label>
              <input
                value={place.best_time || ""}
                onChange={(e) => setPlace({ ...place, best_time: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px]"
                placeholder="Oct – Mar"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[9px] font-medium text-slate-400">
                Visit duration
              </label>
              <input
                value={place.visit_duration || ""}
                onChange={(e) =>
                  setPlace({ ...place, visit_duration: e.target.value })
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px]"
                placeholder="2–3 hrs"
              />
            </div>
            <div className="col-span-2">
              <label className="mb-1.5 block text-[9px] font-medium text-slate-400">
                Entry fee
              </label>
              <input
                value={place.entry_fee || ""}
                onChange={(e) => setPlace({ ...place, entry_fee: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px]"
                placeholder="Free / ₹50 adults"
              />
            </div>
          </div>
        </div>

        <div className="md:col-span-2 grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-[9px] font-medium text-slate-400">
              How to reach
            </label>
            <textarea
              value={place.how_to_reach || ""}
              onChange={(e) => setPlace({ ...place, how_to_reach: e.target.value })}
              className="min-h-[80px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px]"
              placeholder="Nearest station, airport, road tips…"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[9px] font-medium text-slate-400">
              Highlights
            </label>
            <textarea
              value={place.highlights || ""}
              onChange={(e) => setPlace({ ...place, highlights: e.target.value })}
              className="min-h-[80px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px]"
              placeholder="Must-see spots…"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[9px] font-medium text-slate-400">
              Visitor tips
            </label>
            <textarea
              value={place.tips || ""}
              onChange={(e) => setPlace({ ...place, tips: e.target.value })}
              className="min-h-[80px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px]"
              placeholder="Timing, tickets, what to carry…"
            />
          </div>
        </div>

        {renderMerchantTagger(place, isEditing)}
      </div>

      <div className="flex justify-end gap-3 border-t border-slate-50 pt-4">
        <button
          type="button"
          onClick={() =>
            isEditing ? setEditingPlace(null) : setIsAddingPlace(false)
          }
          className="rounded-xl px-6 py-2.5 text-[10px] font-medium text-slate-500 hover:bg-slate-50"
        >
          Cancel
        </button>
        {canManage ? (
          <button
            type="button"
            onClick={isEditing ? handleSave : handleCreate}
            disabled={!place.name || uploading || saving}
            className="rounded-xl bg-primary px-8 py-2.5 text-[10px] font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : isEditing ? "Save Changes" : "Save Place"}
          </button>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="space-y-4 font-sans">
      <div className="flex flex-col justify-between gap-3 px-0.5 sm:flex-row sm:items-end">
        <div>
          <h1 className="admin-page-title">Tourist Places</h1>
          <p className="admin-page-subtitle">
            Destinations and tagged Tour &amp; Travels partners.
          </p>
        </div>
        {canManage && !isAddingPlace && !editingPlace && (
          <button
            type="button"
            onClick={() => {
              setEditingPlace(null);
              setMerchantSearch("");
              setNewPlace({ ...EMPTY_PLACE });
              setIsAddingPlace(true);
            }}
            className="rounded-lg bg-teal-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-teal-800"
          >
            Add place
          </button>
        )}
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {isAddingPlace && renderPlaceForm(newPlace, setNewPlace, false)}
      {editingPlace && renderPlaceForm(editingPlace, setEditingPlace, true)}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-500">
          Loading tourist places…
        </div>
      ) : !isAddingPlace && !editingPlace ? (
        <div className="space-y-3">
          <div className="flex flex-col lg:flex-row gap-2">
            <ListSearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search name, location, category…"
            />
            <ListSelect value={categoryFilter} onChange={setCategoryFilter}>
              <option value="all">All categories</option>
              {placeCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </ListSelect>
            <ListSelect
              value={partnerFilter}
              onChange={(v) =>
                setPartnerFilter(v as "all" | "tagged" | "untagged")
              }
            >
              <option value="all">All partners</option>
              <option value="tagged">Has partners</option>
              <option value="untagged">No partners</option>
            </ListSelect>
            <ListSelect
              value={imageFilter}
              onChange={(v) => setImageFilter(v as "all" | "has" | "missing")}
            >
              <option value="all">All images</option>
              <option value="has">Has image</option>
              <option value="missing">Missing image</option>
            </ListSelect>
          </div>

          {filteredPlaces.length > 0 ? (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {pageItems.map((place) => (
                  <div
                    key={place.id}
                    className="group overflow-hidden rounded-xl border border-slate-200 bg-white"
                  >
                    <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
                      {place.image_url ? (
                        <img
                          src={place.image_url}
                          className="h-full w-full object-cover"
                          alt={place.name}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                          No image
                        </div>
                      )}
                      {canManage ? (
                        <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => openEdit(place)}
                            className="rounded-md bg-white/95 px-2 py-1 text-xs font-medium text-slate-700 hover:text-teal-700"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(place.id, place.name)}
                            className="rounded-md bg-white/95 px-2 py-1 text-xs font-medium text-rose-600"
                          >
                            Delete
                          </button>
                        </div>
                      ) : null}
                    </div>
                    <div className="p-3">
                      <h3 className="truncate text-sm font-semibold text-slate-900">
                        {place.name}
                      </h3>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {place.location}
                        {place.category ? ` · ${place.category}` : ""}
                      </p>
                      <p className="mt-1.5 line-clamp-2 text-xs text-slate-400 leading-relaxed">
                        {place.description || "No description"}
                      </p>
                      <p className="mt-2 text-xs font-medium text-teal-700 tabular-nums">
                        {tagCounts[place.id] ?? 0} travel partner
                        {(tagCounts[place.id] ?? 0) === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <PaginationControls
                page={page}
                totalPages={totalPages}
                total={total}
                pageSize={pageSize}
                onPageChange={setPage}
              />
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white py-14 text-center">
              <p className="text-sm font-medium text-slate-700">
                {places.length === 0
                  ? "No tourist places found"
                  : "No places match your filters"}
              </p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
