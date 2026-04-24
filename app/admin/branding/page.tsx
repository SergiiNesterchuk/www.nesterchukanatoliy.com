"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Upload } from "lucide-react";

export default function AdminBrandingPage() {
  const [faviconUrl, setFaviconUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          const map: Record<string, string> = {};
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (d.data as any[]).forEach((s: any) => { map[s.key] = s.value; });
          setFaviconUrl(map.site_favicon_url || "");
          setLogoUrl(map.site_logo_url || "");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const saveSetting = async (key: string, value: string) => {
    await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
  };

  const handleUpload = async (type: "favicon" | "logo", e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(type);
    setMessage("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
      const data = await res.json();

      if (data.success) {
        const url = data.data.url;
        if (type === "favicon") {
          setFaviconUrl(url);
          await saveSetting("site_favicon_url", url);
        } else {
          setLogoUrl(url);
          await saveSetting("site_logo_url", url);
        }
        setMessage(`${type === "favicon" ? "Favicon" : "Логотип"} збережено`);
      } else {
        setMessage(data.error?.message || "Помилка завантаження");
      }
    } finally {
      setUploading(null);
      e.target.value = "";
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Завантаження...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Брендинг</h1>
      {message && <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">{message}</div>}

      <div className="space-y-6">
        {/* Favicon */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold mb-2">Favicon (іконка вкладки)</h2>
          <p className="text-sm text-gray-500 mb-4">PNG або ICO, рекомендований розмір 180×180 або 512×512. Показується у вкладці браузера.</p>

          <div className="flex items-center gap-4 mb-4">
            {faviconUrl ? (
              <img src={faviconUrl} alt="Favicon" className="w-16 h-16 rounded-lg border object-contain bg-gray-50" />
            ) : (
              <div className="w-16 h-16 rounded-lg border bg-gray-100 flex items-center justify-center text-gray-400 text-xs">Немає</div>
            )}
            <div>
              <label className="inline-flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer">
                <Upload className="h-4 w-4" />
                {uploading === "favicon" ? "Завантаження..." : "Завантажити favicon"}
                <input type="file" accept=".png,.ico,.webp,.svg" onChange={(e) => handleUpload("favicon", e)} className="hidden" disabled={!!uploading} />
              </label>
            </div>
          </div>
          {faviconUrl && <p className="text-xs text-gray-400 font-mono break-all">{faviconUrl}</p>}
        </div>

        {/* Logo */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold mb-2">Логотип сайту</h2>
          <p className="text-sm text-gray-500 mb-4">PNG або SVG, показується в header сайту. Рекомендований розмір: висота 40-60px.</p>

          <div className="flex items-center gap-4 mb-4">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-12 rounded border object-contain bg-gray-50 px-2" />
            ) : (
              <div className="h-12 w-24 rounded border bg-gray-100 flex items-center justify-center text-gray-400 text-xs">Немає</div>
            )}
            <div>
              <label className="inline-flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer">
                <Upload className="h-4 w-4" />
                {uploading === "logo" ? "Завантаження..." : "Завантажити логотип"}
                <input type="file" accept=".png,.svg,.webp,.jpg,.jpeg" onChange={(e) => handleUpload("logo", e)} className="hidden" disabled={!!uploading} />
              </label>
            </div>
          </div>
          {logoUrl && <p className="text-xs text-gray-400 font-mono break-all">{logoUrl}</p>}
        </div>
      </div>
    </div>
  );
}
