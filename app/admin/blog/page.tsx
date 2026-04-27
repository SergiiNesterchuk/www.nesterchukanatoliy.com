"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { adminFetch } from "@/shared/admin-fetch";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  coverImageUrl: string | null;
  publishedAt: string | null;
  isPublished: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  sortOrder: number;
}

const emptyPost = {
  title: "", slug: "", excerpt: "", content: "", coverImageUrl: "",
  publishedAt: "", isPublished: false, seoTitle: "", seoDescription: "",
  ctaLabel: "", ctaUrl: "", sortOrder: 0,
};

function slugify(text: string): string {
  return text.toLowerCase()
    .replace(/[їі]/g, "i").replace(/є/g, "ye").replace(/ю/g, "yu").replace(/я/g, "ya")
    .replace(/ь/g, "").replace(/ґ/g, "g").replace(/ж/g, "zh").replace(/х/g, "kh")
    .replace(/ц/g, "ts").replace(/ч/g, "ch").replace(/ш/g, "sh").replace(/щ/g, "shch")
    .replace(/а/g, "a").replace(/б/g, "b").replace(/в/g, "v").replace(/г/g, "h")
    .replace(/д/g, "d").replace(/е/g, "e").replace(/з/g, "z").replace(/и/g, "y")
    .replace(/й/g, "i").replace(/к/g, "k").replace(/л/g, "l").replace(/м/g, "m")
    .replace(/н/g, "n").replace(/о/g, "o").replace(/п/g, "p").replace(/р/g, "r")
    .replace(/с/g, "s").replace(/т/g, "t").replace(/у/g, "u").replace(/ф/g, "f")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").substring(0, 80);
}

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<BlogPost | null>(null);
  const [form, setForm] = useState(emptyPost);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = () => {
    setLoading(true);
    adminFetch("/api/admin/blog").then((r) => r.json()).then((d) => {
      if (d.success) setPosts(d.data);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const startNew = () => {
    setEditing(null);
    setForm(emptyPost);
  };

  const startEdit = (p: BlogPost) => {
    setEditing(p);
    setForm({
      title: p.title, slug: p.slug, excerpt: p.excerpt || "", content: p.content,
      coverImageUrl: p.coverImageUrl || "",
      publishedAt: p.publishedAt ? new Date(p.publishedAt).toISOString().slice(0, 16) : "",
      isPublished: p.isPublished, seoTitle: p.seoTitle || "",
      seoDescription: p.seoDescription || "", ctaLabel: p.ctaLabel || "",
      ctaUrl: p.ctaUrl || "", sortOrder: p.sortOrder,
    });
  };

  const handleTitleChange = (title: string) => {
    setForm((prev) => ({
      ...prev, title,
      slug: !editing ? slugify(title) : prev.slug,
    }));
  };

  const save = async () => {
    if (!form.title || !form.slug) { setMessage("Заголовок і slug обовʼязкові"); return; }
    setSaving(true);
    setMessage("");
    const body = {
      ...form,
      publishedAt: form.publishedAt ? new Date(form.publishedAt).toISOString() : null,
      coverImageUrl: form.coverImageUrl || null,
      excerpt: form.excerpt || null,
      seoTitle: form.seoTitle || null,
      seoDescription: form.seoDescription || null,
      ctaLabel: form.ctaLabel || null,
      ctaUrl: form.ctaUrl || null,
    };
    try {
      const url = editing ? `/api/admin/blog/${editing.id}` : "/api/admin/blog";
      const res = await adminFetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (d.success) { setMessage(editing ? "Збережено" : "Створено"); setEditing(null); setForm(emptyPost); load(); }
      else setMessage(d.error?.message || "Помилка");
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm("Видалити статтю?")) return;
    await adminFetch(`/api/admin/blog/${id}`, { method: "DELETE" });
    load();
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Завантаження...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Блог</h1>
        <Button size="sm" onClick={startNew}>+ Нова стаття</Button>
      </div>

      {message && <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">{message}</div>}

      {/* Form */}
      {(form.title !== "" || !editing) && form !== emptyPost || !editing ? null : null}
      <div className="bg-white rounded-xl border p-6 mb-6">
        <h2 className="font-semibold mb-4">{editing ? `Редагувати: ${editing.title}` : "Нова стаття"}</h2>
        <div className="space-y-4">
          <Input id="blog-title" label="Заголовок *" value={form.title} onChange={(e) => handleTitleChange(e.target.value)} />
          <Input id="blog-slug" label="Slug (URL) *" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          <Input id="blog-cover" label="URL обкладинки" value={form.coverImageUrl} onChange={(e) => setForm({ ...form, coverImageUrl: e.target.value })} placeholder="https://..." />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Короткий опис</label>
            <textarea value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} rows={2} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Контент (HTML) *</label>
            <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={10} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono" />
            <p className="mt-1 text-xs text-gray-400">HTML: h2, h3, p, ul, ol, li, strong, em, a, img</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input id="blog-cta-label" label="CTA кнопка (текст)" value={form.ctaLabel} onChange={(e) => setForm({ ...form, ctaLabel: e.target.value })} placeholder="Купити яблучний оцет" />
            <Input id="blog-cta-url" label="CTA кнопка (URL)" value={form.ctaUrl} onChange={(e) => setForm({ ...form, ctaUrl: e.target.value })} placeholder="/yabluchnyi-otset/" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input id="blog-date" label="Дата публікації" type="datetime-local" value={form.publishedAt} onChange={(e) => setForm({ ...form, publishedAt: e.target.value })} />
            <Input id="blog-sort" label="Порядок" type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })} />
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} className="rounded text-green-600" />
                <span className="text-sm font-medium">Опубліковано</span>
              </label>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input id="blog-seo-title" label="SEO Title" value={form.seoTitle} onChange={(e) => setForm({ ...form, seoTitle: e.target.value })} />
            <Input id="blog-seo-desc" label="SEO Description" value={form.seoDescription} onChange={(e) => setForm({ ...form, seoDescription: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <Button loading={saving} onClick={save}>{editing ? "Зберегти" : "Створити"}</Button>
            {editing && <Button variant="outline" onClick={() => { setEditing(null); setForm(emptyPost); }}>Скасувати</Button>}
          </div>
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {posts.map((p) => (
          <div key={p.id} className="bg-white rounded-xl border p-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`inline-block w-2 h-2 rounded-full ${p.isPublished ? "bg-green-500" : "bg-gray-300"}`} />
                <span className="font-medium text-gray-900 truncate">{p.title}</span>
              </div>
              <div className="text-xs text-gray-400 mt-1">
                /blog/{p.slug}/ {p.publishedAt && `• ${new Date(p.publishedAt).toLocaleDateString("uk-UA")}`}
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button size="sm" variant="outline" onClick={() => startEdit(p)}>Ред.</Button>
              <Button size="sm" variant="outline" onClick={() => remove(p.id)}>🗑</Button>
            </div>
          </div>
        ))}
        {posts.length === 0 && <p className="text-center text-gray-500 py-8">Статей поки немає</p>}
      </div>
    </div>
  );
}
