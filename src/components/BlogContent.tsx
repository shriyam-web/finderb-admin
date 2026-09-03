"use client";

import React, { useMemo, useState, Dispatch, SetStateAction } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Undo,
  Redo,
  Link as LinkIcon,
  Image as ImageIcon,
  Heading1,
  Heading2,
  Trash2,
  Save,
  Send,
  ChevronLeft,
  User,
  Tag,
  FileText,
  Globe,
  Eye,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  ListSearchInput,
  ListSelect,
  PaginationControls,
  useClientPage,
} from "./AdminListControls";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface Blog {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  author: string;
  category: string;
  tags: string[];
  image_url: string;
  status: "draft" | "published";
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

const MenuBar = ({ editor }: { editor: any }) => {
  if (!editor) return null;

  const addImage = () => {
    const url = window.prompt("URL");
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  const setLink = () => {
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("URL", previousUrl);

    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <div className="flex flex-wrap gap-1 p-2 border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10 backdrop-blur-sm">
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={!editor.can().chain().focus().toggleBold().run()}
        className={cn(
          "p-1.5 rounded hover:bg-slate-200 transition-colors",
          editor.isActive("bold") && "bg-slate-200 text-primary",
        )}
        title="Bold"
      >
        <Bold size={16} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={!editor.can().chain().focus().toggleItalic().run()}
        className={cn(
          "p-1.5 rounded hover:bg-slate-200 transition-colors",
          editor.isActive("italic") && "bg-slate-200 text-primary",
        )}
        title="Italic"
      >
        <Italic size={16} />
      </button>
      <div className="w-px h-6 bg-slate-200 mx-1 self-center" />
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={cn(
          "p-1.5 rounded hover:bg-slate-200 transition-colors",
          editor.isActive("heading", { level: 1 }) &&
            "bg-slate-200 text-primary",
        )}
        title="Heading 1"
      >
        <Heading1 size={16} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={cn(
          "p-1.5 rounded hover:bg-slate-200 transition-colors",
          editor.isActive("heading", { level: 2 }) &&
            "bg-slate-200 text-primary",
        )}
        title="Heading 2"
      >
        <Heading2 size={16} />
      </button>
      <div className="w-px h-6 bg-slate-200 mx-1 self-center" />
      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={cn(
          "p-1.5 rounded hover:bg-slate-200 transition-colors",
          editor.isActive("bulletList") && "bg-slate-200 text-primary",
        )}
        title="Bullet List"
      >
        <List size={16} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={cn(
          "p-1.5 rounded hover:bg-slate-200 transition-colors",
          editor.isActive("orderedList") && "bg-slate-200 text-primary",
        )}
        title="Ordered List"
      >
        <ListOrdered size={16} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={cn(
          "p-1.5 rounded hover:bg-slate-200 transition-colors",
          editor.isActive("blockquote") && "bg-slate-200 text-primary",
        )}
        title="Blockquote"
      >
        <Quote size={16} />
      </button>
      <div className="w-px h-6 bg-slate-200 mx-1 self-center" />
      <button
        onClick={setLink}
        className={cn(
          "p-1.5 rounded hover:bg-slate-200 transition-colors",
          editor.isActive("link") && "bg-slate-200 text-primary",
        )}
        title="Link"
      >
        <LinkIcon size={16} />
      </button>
      <button
        onClick={addImage}
        className="p-1.5 rounded hover:bg-slate-200 transition-colors"
        title="Image"
      >
        <ImageIcon size={16} />
      </button>
      <div className="w-px h-6 bg-slate-200 mx-1 self-center" />
      <button
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().chain().focus().undo().run()}
        className="p-1.5 rounded hover:bg-slate-200 transition-colors disabled:opacity-30"
        title="Undo"
      >
        <Undo size={16} />
      </button>
      <button
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().chain().focus().redo().run()}
        className="p-1.5 rounded hover:bg-slate-200 transition-colors disabled:opacity-30"
        title="Redo"
      >
        <Redo size={16} />
      </button>
    </div>
  );
};

const Tiptap = ({
  content,
  onChange,
}: {
  content: string;
  onChange: (content: string) => void;
}) => {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline cursor-pointer",
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: "rounded-xl max-w-full h-auto my-4",
        },
      }),
    ],
    content: content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm sm:prose-base focus:outline-none max-w-none min-h-[400px] p-6 text-slate-700",
      },
    },
  });

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white focus-within:ring-2 focus-within:ring-primary/10 transition-all">
      <MenuBar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
};

export function BlogContent({
  blogs,
  onUpdateBlog,
  onCreateBlog,
  onDeleteBlog,
  onUploadImage,
  canManage = false,
}: {
  blogs: Blog[];
  onUpdateBlog: (item: Partial<Blog>) => Promise<void>;
  onCreateBlog: (item: Partial<Blog>) => Promise<void>;
  onDeleteBlog: (id: string) => Promise<void>;
  onUploadImage: (file: File) => Promise<string>;
  canManage?: boolean;
}) {
  const [editingBlog, setEditingBlog] = useState<Blog | null>(null);
  const [isAddingBlog, setIsAddingBlog] = useState(false);
  const [newItem, setNewItem] = useState<Partial<Blog>>({
    title: "",
    slug: "",
    content: "",
    excerpt: "",
    author: "FinderB Admin",
    category: "General",
    tags: [],
    image_url: "",
    status: "draft",
    published_at: null,
  });
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "published">(
    "all",
  );
  const [categoryFilter, setCategoryFilter] = useState("all");

  const categories = useMemo(() => {
    const set = new Set(blogs.map((b) => b.category).filter(Boolean));
    return ["General", "News", "Tutorial", "Review", "Business", ...set].filter(
      (v, i, arr) => arr.indexOf(v) === i,
    );
  }, [blogs]);

  const filteredBlogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return blogs.filter((b) => {
      if (statusFilter !== "all" && b.status !== statusFilter) return false;
      if (categoryFilter !== "all" && b.category !== categoryFilter)
        return false;
      if (!q) return true;
      const hay = `${b.title} ${b.excerpt} ${b.author} ${b.category} ${b.slug}`
        .toLowerCase();
      return hay.includes(q);
    });
  }, [blogs, search, statusFilter, categoryFilter]);

  const { page, setPage, totalPages, pageItems, pageSize, total } =
    useClientPage(filteredBlogs, 9, `${search}|${statusFilter}|${categoryFilter}`);

  const handleSave = async () => {
    if (!canManage) return;
    if (editingBlog) {
      await onUpdateBlog(editingBlog);
      setEditingBlog(null);
    }
  };

  const handleCreate = async () => {
    if (!canManage) return;
    if (newItem.title && newItem.content) {
      const slug =
        newItem.slug ||
        newItem.title
          .toLowerCase()
          .replace(/ /g, "-")
          .replace(/[^\w-]+/g, "");
      await onCreateBlog({ ...newItem, slug });
      setIsAddingBlog(false);
      setNewItem({
        title: "",
        slug: "",
        content: "",
        excerpt: "",
        author: "FinderB Admin",
        category: "General",
        tags: [],
        image_url: "",
        status: "draft",
        published_at: null,
      });
    }
  };

  const handleImageUpload = async (file: File, isEditing: boolean) => {
    if (!canManage) return;
    try {
      setUploading(true);
      const url = await onUploadImage(file);
      if (isEditing && editingBlog) {
        setEditingBlog({ ...editingBlog, image_url: url });
      } else {
        setNewItem({ ...newItem, image_url: url });
      }
    } catch (error) {
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const renderBlogForm = (
    item: Partial<Blog>,
    setItem: Dispatch<SetStateAction<any>>,
    isEditing: boolean,
  ) => (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <button
          onClick={() =>
            isEditing ? setEditingBlog(null) : setIsAddingBlog(false)
          }
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors group"
        >
          <div className="p-2 rounded-full group-hover:bg-slate-100 transition-colors">
            <ChevronLeft size={18} />
          </div>
          <span className="text-sm font-medium">Back to Articles</span>
        </button>

        {canManage && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => (isEditing ? handleSave() : handleCreate())}
              disabled={!item.title || !item.content || uploading}
              className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white text-[12px] font-semibold rounded-full hover:bg-slate-800 transition-all disabled:opacity-50"
            >
              {isEditing ? <Save size={16} /> : <Send size={16} />}
              {isEditing ? "SAVE CHANGES" : "PUBLISH ARTICLE"}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200/60 p-8 space-y-6">
            <input
              type="text"
              value={item.title || ""}
              onChange={(e) => setItem({ ...item, title: e.target.value })}
              className="w-full text-4xl font-bold text-slate-900 placeholder:text-slate-200 border-none focus:outline-none focus:ring-0 p-0"
              placeholder="Article Title..."
            />

            <div className="flex flex-wrap gap-4 pt-2">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg text-slate-500">
                <Globe size={14} />
                <span className="text-[11px] font-medium">SLUG:</span>
                <input
                  type="text"
                  value={item.slug || ""}
                  onChange={(e) => setItem({ ...item, slug: e.target.value })}
                  className="bg-transparent border-none focus:outline-none focus:ring-0 p-0 text-[11px] font-medium text-primary min-w-[100px]"
                  placeholder="auto-generated-slug"
                />
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg text-slate-500">
                <Tag size={14} />
                <span className="text-[11px] font-medium tracking-wider">
                  {item.category}
                </span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg text-slate-500">
                <User size={14} />
                <span className="text-[11px] font-medium tracking-wider">
                  {item.author}
                </span>
              </div>
            </div>

            <div className="pt-4">
              <label className="block text-[10px] font-bold text-slate-400 tracking-[0.2em] mb-4">
                Content Editor
              </label>
              <Tiptap
                content={item.content || ""}
                onChange={(content) => setItem({ ...item, content })}
              />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200/60 p-8 space-y-6">
            <h4 className="text-[11px] font-bold text-slate-900 border-b border-slate-50 pb-4">
              Article Settings
            </h4>

            <div className="space-y-4">
              <div>
                <label className="block text-[9px] font-bold text-slate-400 mb-2">
                  Featured Image
                </label>
                <div className="relative group aspect-[16/10] bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl overflow-hidden hover:border-primary/50 transition-all">
                  {uploading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : item.image_url ? (
                    <>
                      <img
                        src={item.image_url}
                        className="w-full h-full object-cover"
                        alt="Featured"
                      />
                      {canManage && (
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <label
                            htmlFor="blog-image-upload"
                            className="px-4 py-2 bg-white text-[10px] font-bold rounded-lg cursor-pointer"
                          >
                            CHANGE IMAGE
                          </label>
                        </div>
                      )}
                    </>
                  ) : canManage ? (
                    <label
                      htmlFor="blog-image-upload"
                      className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer"
                    >
                      <ImageIcon size={32} className="text-slate-200 mb-2" />
                      <span className="text-[10px] font-medium text-slate-400">
                        Click to upload
                      </span>
                    </label>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <ImageIcon size={32} className="text-slate-200 mb-2" />
                      <span className="text-[10px] font-medium text-slate-400">
                        No image
                      </span>
                    </div>
                  )}
                  {canManage && (
                    <input
                      type="file"
                      id="blog-image-upload"
                      className="hidden"
                      onChange={(e) =>
                        e.target.files?.[0] &&
                        handleImageUpload(e.target.files[0], isEditing)
                      }
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-slate-400 mb-2">
                  Excerpt (Short Summary)
                </label>
                <textarea
                  value={item.excerpt || ""}
                  onChange={(e) =>
                    setItem({ ...item, excerpt: e.target.value })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[12px] text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all min-h-[100px]"
                  placeholder="Write a brief summary of this article..."
                />
              </div>

              <div>
                <label className="block text-[9px] font-bold text-slate-400 mb-2">
                  Category
                </label>
                <select
                  value={item.category || ""}
                  onChange={(e) =>
                    setItem({ ...item, category: e.target.value })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[12px] text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all appearance-none"
                >
                  <option value="General">General</option>
                  <option value="News">News</option>
                  <option value="Tutorial">Tutorial</option>
                  <option value="Review">Review</option>
                  <option value="Business">Business</option>
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-slate-400 mb-2">
                  Publishing Status
                </label>
                <div className="flex p-1 bg-slate-50 rounded-xl border border-slate-200">
                  <button
                    onClick={() => setItem({ ...item, status: "draft" })}
                    className={cn(
                      "flex-1 py-2 text-[10px] font-bold rounded-lg transition-all",
                      item.status === "draft"
                        ? "bg-white text-slate-900"
                        : "text-slate-400",
                    )}
                  >
                    DRAFT
                  </button>
                  <button
                    onClick={() => setItem({ ...item, status: "published" })}
                    className={cn(
                      "flex-1 py-2 text-[10px] font-bold rounded-lg transition-all",
                      item.status === "published"
                        ? "bg-white text-primary"
                        : "text-slate-400",
                    )}
                  >
                    PUBLISHED
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen font-sans">
      {isAddingBlog || editingBlog ? (
        renderBlogForm(
          isAddingBlog ? newItem : editingBlog!,
          isAddingBlog ? setNewItem : setEditingBlog,
          !!editingBlog,
        )
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <h1 className="admin-page-title">Blog Articles</h1>
              <p className="admin-page-subtitle">
                Manage and curate FinderB content.
              </p>
            </div>
            {canManage && (
              <button
                type="button"
                onClick={() => setIsAddingBlog(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-teal-800"
              >
                <FileText size={15} />
                Write article
              </button>
            )}
          </div>

          <div className="flex flex-col lg:flex-row gap-2">
            <ListSearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search title, author, category…"
            />
            <ListSelect
              value={statusFilter}
              onChange={(v) =>
                setStatusFilter(v as "all" | "draft" | "published")
              }
            >
              <option value="all">All status</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </ListSelect>
            <ListSelect
              value={categoryFilter}
              onChange={setCategoryFilter}
            >
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </ListSelect>
          </div>

          {filteredBlogs.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {pageItems.map((blog) => (
                  <div
                    key={blog.id}
                    className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white"
                  >
                    <div className="relative aspect-[16/9] overflow-hidden bg-slate-100">
                      {blog.image_url ? (
                        <img
                          src={blog.image_url}
                          className="h-full w-full object-cover"
                          alt={blog.title}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <FileText size={28} className="text-slate-300" />
                        </div>
                      )}
                      <span
                        className={cn(
                          "absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
                          blog.status === "published"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700",
                        )}
                      >
                        {blog.status}
                      </span>
                      {canManage && (
                        <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => setEditingBlog(blog)}
                            className="rounded-md bg-white/95 p-1.5 text-slate-700 hover:text-teal-700"
                            title="Edit"
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!canManage) return;
                              if (confirm("Delete article?"))
                                onDeleteBlog(blog.id);
                            }}
                            className="rounded-md bg-white/95 p-1.5 text-rose-600"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col p-3.5">
                      <p className="text-xs text-slate-500 mb-1">
                        {blog.category}
                        <span className="mx-1.5 text-slate-300">·</span>
                        {new Date(blog.created_at).toLocaleDateString()}
                      </p>
                      <h3 className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2">
                        {blog.title}
                      </h3>
                      <p className="mt-1.5 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {blog.excerpt || "No summary provided."}
                      </p>
                      <div className="mt-auto flex items-center justify-between gap-2 pt-3 border-t border-slate-100 mt-3">
                        <span className="truncate text-xs font-medium text-slate-600">
                          {blog.author}
                        </span>
                        {canManage && (
                          <button
                            type="button"
                            onClick={() => setEditingBlog(blog)}
                            className="text-xs font-medium text-teal-700 hover:underline"
                          >
                            Edit
                          </button>
                        )}
                      </div>
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
            <div className="rounded-xl border border-dashed border-slate-200 bg-white py-16 text-center">
              <p className="text-sm font-medium text-slate-700">
                {blogs.length === 0
                  ? "No articles yet"
                  : "No articles match your filters"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {blogs.length === 0
                  ? "Start sharing content with FinderB readers."
                  : "Try a different search or clear filters."}
              </p>
              {blogs.length === 0 && canManage && (
                <button
                  type="button"
                  onClick={() => setIsAddingBlog(true)}
                  className="mt-4 rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
                >
                  Create first article
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
