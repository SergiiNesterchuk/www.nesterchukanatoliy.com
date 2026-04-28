"use client";

import { useEffect, useRef, useState } from "react";
import { AdminForm } from "@/components/admin/AdminForm";
import { Input } from "@/components/ui/Input";
import { generateSlug } from "@/shared/slug";

interface Props {
  isNew?: boolean;
  category: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    imageUrl: string | null;
    isActive: boolean;
    sortOrder: number;
    metaTitle: string | null;
    metaDesc: string | null;
  };
}

export function CategoryEditForm({ category, isNew }: Props) {
  const [slug, setSlug] = useState(category.slug);
  const [slugManual, setSlugManual] = useState(!isNew);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isNew && !slugManual && nameRef.current) {
      const handler = () => {
        const val = nameRef.current?.value || "";
        setSlug(generateSlug(val));
      };
      const input = nameRef.current;
      input.addEventListener("input", handler);
      return () => input.removeEventListener("input", handler);
    }
  }, [isNew, slugManual]);

  return (
    <AdminForm
      action={isNew ? "/api/admin/categories" : `/api/admin/categories/${category.id}`}
      method={isNew ? "POST" : "PUT"}
      onSuccess="/admin/categories"
      submitLabel={isNew ? "Створити" : "Зберегти зміни"}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          id="name"
          name="name"
          label="Назва *"
          defaultValue={category.name}
          required
          ref={nameRef}
        />
        <div>
          <Input
            id="slug"
            name="slug"
            label="Slug *"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugManual(true);
            }}
            required
          />
          {isNew && slugManual && (
            <button
              type="button"
              className="text-xs text-green-600 hover:underline mt-1"
              onClick={() => {
                setSlugManual(false);
                setSlug(generateSlug(nameRef.current?.value || ""));
              }}
            >
              Генерувати з назви
            </button>
          )}
        </div>
        <Input id="sortOrder" name="sortOrder" label="Порядок" type="number" defaultValue={category.sortOrder} />
        <div className="flex items-center gap-2 pt-6">
          <input type="checkbox" id="isActive" name="isActive" defaultChecked={category.isActive} className="rounded" />
          <label htmlFor="isActive" className="text-sm">Активна</label>
        </div>
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Опис</label>
        <textarea id="description" name="description" rows={3} defaultValue={category.description ?? ""} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </div>

      <Input id="imageUrl" name="imageUrl" label="URL зображення" defaultValue={category.imageUrl ?? ""} />

      <fieldset className="border border-gray-200 rounded-lg p-4">
        <legend className="text-sm font-medium text-gray-700 px-2">SEO</legend>
        <div className="space-y-3">
          <Input id="metaTitle" name="metaTitle" label="Meta Title" defaultValue={category.metaTitle ?? ""} />
          <Input id="metaDesc" name="metaDesc" label="Meta Description" defaultValue={category.metaDesc ?? ""} />
        </div>
      </fieldset>
    </AdminForm>
  );
}
