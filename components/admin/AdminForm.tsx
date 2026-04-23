"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

interface AdminFormProps {
  action: string;
  method?: "POST" | "PUT";
  onSuccess?: string; // redirect path
  submitLabel?: string;
  children: ReactNode;
  className?: string;
}

export function AdminForm({
  action,
  method = "POST",
  onSuccess,
  submitLabel = "Зберегти",
  children,
  className,
}: AdminFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const formData = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {};

    for (const [key, value] of formData.entries()) {
      if (key.endsWith("[]")) {
        const k = key.replace("[]", "");
        if (!body[k]) body[k] = [];
        (body[k] as unknown[]).push(value);
      } else if (value === "on") {
        body[key] = true;
      } else {
        body[key] = value;
      }
    }

    // Handle unchecked checkboxes
    const checkboxes = e.currentTarget.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    checkboxes.forEach((cb) => {
      if (!formData.has(cb.name)) {
        body[cb.name] = false;
      }
    });

    try {
      const res = await fetch(action, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error?.message || "Помилка збереження");
        return;
      }

      setSuccess("Збережено");
      if (onSuccess) {
        router.push(onSuccess);
        router.refresh();
      } else {
        router.refresh();
      }
    } catch {
      setError("Помилка з'єднання");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={className}>
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
          {success}
        </div>
      )}

      <div className="space-y-4">{children}</div>

      <div className="mt-6 flex gap-3">
        <Button type="submit" loading={loading} disabled={loading}>
          {submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Скасувати
        </Button>
      </div>
    </form>
  );
}
