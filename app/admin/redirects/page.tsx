"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Trash2 } from "lucide-react";

interface Redirect {
  id: string;
  fromPath: string;
  toPath: string;
  statusCode: number;
  isActive: boolean;
}

export default function AdminRedirectsPage() {
  const [redirects, setRedirects] = useState<Redirect[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromPath, setFromPath] = useState("");
  const [toPath, setToPath] = useState("");
  const [statusCode, setStatusCode] = useState("301");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = () => {
    fetch("/api/admin/redirects")
      .then((r) => r.json())
      .then((d) => { if (d.success) setRedirects(d.data); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const addRedirect = async () => {
    setError("");
    setMessage("");
    if (!fromPath || !toPath) { setError("Обидва поля обов'язкові"); return; }

    const res = await fetch("/api/admin/redirects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromPath, toPath, statusCode: parseInt(statusCode), isActive: true }),
    });
    const d = await res.json();
    if (d.success) {
      setMessage("Redirect додано");
      setFromPath(""); setToPath("");
      load();
    } else {
      setError(d.error?.message || "Помилка");
    }
  };

  const deleteRedirect = async (id: string) => {
    await fetch(`/api/admin/redirects/${id}`, { method: "DELETE" });
    load();
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Завантаження...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Redirects</h1>

      {error && <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}
      {message && <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">{message}</div>}

      <div className="bg-white rounded-xl border p-4 mb-6">
        <div className="flex gap-3 items-end flex-wrap">
          <Input id="fromPath" label="З шляху *" value={fromPath} onChange={(e) => setFromPath(e.target.value)} placeholder="/old-page/" />
          <Input id="toPath" label="На шлях *" value={toPath} onChange={(e) => setToPath(e.target.value)} placeholder="/new-page/" />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Код</label>
            <select value={statusCode} onChange={(e) => setStatusCode(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="301">301</option>
              <option value="302">302</option>
            </select>
          </div>
          <Button onClick={addRedirect}>Додати</Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">З</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">На</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500">Код</th>
              <th className="px-4 py-3 w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {redirects.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs">{r.fromPath}</td>
                <td className="px-4 py-3 font-mono text-xs">{r.toPath}</td>
                <td className="px-4 py-3 text-center">{r.statusCode}</td>
                <td className="px-4 py-3">
                  <button onClick={() => deleteRedirect(r.id)} className="text-red-400 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {redirects.length === 0 && <div className="p-8 text-center text-gray-500">Redirects немає</div>}
      </div>
    </div>
  );
}
