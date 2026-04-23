"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface Setting {
  id: string;
  key: string;
  value: string;
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setSettings(d.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const saveSetting = async (key: string, value: string) => {
    setSaving(key);
    setMessage("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage(`"${key}" збережено`);
        setSettings((prev) =>
          prev.map((s) => (s.key === key ? { ...s, value } : s))
        );
      }
    } finally {
      setSaving(null);
    }
  };

  const addSetting = async () => {
    if (!newKey.trim()) return;
    await saveSetting(newKey.trim(), newValue);
    setSettings((prev) => [
      ...prev.filter((s) => s.key !== newKey.trim()),
      { id: Date.now().toString(), key: newKey.trim(), value: newValue },
    ]);
    setNewKey("");
    setNewValue("");
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Завантаження...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Налаштування</h1>

      {message && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
          {message}
        </div>
      )}

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500 w-1/3">Ключ</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Значення</th>
              <th className="px-4 py-3 w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {settings.map((setting) => (
              <SettingRow
                key={setting.key}
                setting={setting}
                onSave={saveSetting}
                saving={saving === setting.key}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 bg-white rounded-xl border p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Додати налаштування</h3>
        <div className="flex gap-3 items-end">
          <Input id="newKey" label="Ключ" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
          <Input id="newValue" label="Значення" value={newValue} onChange={(e) => setNewValue(e.target.value)} />
          <Button onClick={addSetting} size="sm">Додати</Button>
        </div>
      </div>
    </div>
  );
}

function SettingRow({
  setting,
  onSave,
  saving,
}: {
  setting: Setting;
  onSave: (key: string, value: string) => Promise<void>;
  saving: boolean;
}) {
  const [value, setValue] = useState(setting.value);
  const changed = value !== setting.value;

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3 font-mono text-xs text-gray-700">{setting.key}</td>
      <td className="px-4 py-3">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
        />
      </td>
      <td className="px-4 py-3">
        {changed && (
          <Button size="sm" loading={saving} onClick={() => onSave(setting.key, value)}>
            Зберегти
          </Button>
        )}
      </td>
    </tr>
  );
}
