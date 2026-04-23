"use client";

import { useState } from "react";
import Image from "next/image";
import { AdminForm } from "@/components/admin/AdminForm";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Trash2, Upload } from "lucide-react";

interface ProductImage {
  id: string;
  url: string;
  alt: string | null;
  sortOrder: number;
}

interface Props {
  isNew?: boolean;
  product: {
    id: string;
    name: string;
    slug: string;
    sku: string;
    shortDescription: string | null;
    description: string | null;
    price: number;
    compareAtPrice: number | null;
    stockStatus: string;
    quantity: number | null;
    categoryId: string;
    isActive: boolean;
    sortOrder: number;
    metaTitle: string | null;
    metaDesc: string | null;
  };
  categories: { id: string; name: string }[];
  images?: ProductImage[];
}

export function ProductEditForm({ product, categories, isNew, images: initialImages }: Props) {
  const [images, setImages] = useState<ProductImage[]>(initialImages || []);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isNew) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/admin/products/${product.id}/images`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setImages((prev) => [...prev, data.data]);
      }
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    const res = await fetch(`/api/admin/products/${product.id}/images`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageId }),
    });
    const data = await res.json();
    if (data.success) {
      setImages((prev) => prev.filter((img) => img.id !== imageId));
    }
  };

  return (
    <div className="space-y-6">
      {/* Images section */}
      {!isNew && (
        <div className="bg-white rounded-xl border p-4">
          <h3 className="font-semibold mb-3">Фото товару</h3>
          <div className="flex flex-wrap gap-3 mb-3">
            {images.map((img) => (
              <div key={img.id} className="relative group w-24 h-24 rounded-lg overflow-hidden border">
                <Image src={img.url} alt={img.alt || ""} fill className="object-cover" sizes="96px" />
                <button
                  onClick={() => handleDeleteImage(img.id)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            {images.length === 0 && (
              <div className="text-sm text-gray-400">Немає фото</div>
            )}
          </div>
          <label className="inline-flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors">
            <Upload className="h-4 w-4" />
            {uploading ? "Завантаження..." : "Завантажити фото"}
            <input type="file" accept="image/*" onChange={handleUpload} className="hidden" disabled={uploading} />
          </label>
        </div>
      )}

      {/* Product form */}
      <AdminForm
        action={isNew ? "/api/admin/products" : `/api/admin/products/${product.id}`}
        method={isNew ? "POST" : "PUT"}
        onSuccess="/admin/products"
        submitLabel={isNew ? "Створити" : "Зберегти зміни"}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input id="name" name="name" label="Назва *" defaultValue={product.name} required />
          <Input id="slug" name="slug" label="Slug *" defaultValue={product.slug} required />
          <Input id="sku" name="sku" label="SKU *" defaultValue={product.sku} required />
          <div>
            <label htmlFor="categoryId" className="block text-sm font-medium text-gray-700 mb-1">
              Категорія *
            </label>
            <select
              id="categoryId"
              name="categoryId"
              defaultValue={product.categoryId}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              required
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <Input id="price" name="price" label="Ціна (копійки) *" type="number" defaultValue={product.price} required />
          <Input id="compareAtPrice" name="compareAtPrice" label="Стара ціна (копійки)" type="number" defaultValue={product.compareAtPrice ?? ""} />
          <div>
            <label htmlFor="stockStatus" className="block text-sm font-medium text-gray-700 mb-1">Наявність</label>
            <select id="stockStatus" name="stockStatus" defaultValue={product.stockStatus} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="in_stock">В наявності</option>
              <option value="out_of_stock">Немає в наявності</option>
              <option value="preorder">Передзамовлення</option>
            </select>
          </div>
          <Input id="quantity" name="quantity" label="Кількість" type="number" defaultValue={product.quantity ?? ""} />
          <Input id="sortOrder" name="sortOrder" label="Порядок" type="number" defaultValue={product.sortOrder} />
          <div className="flex items-center gap-2 pt-6">
            <input type="checkbox" id="isActive" name="isActive" defaultChecked={product.isActive} className="rounded" />
            <label htmlFor="isActive" className="text-sm">Активний</label>
          </div>
        </div>

        <div>
          <label htmlFor="shortDescription" className="block text-sm font-medium text-gray-700 mb-1">Короткий опис</label>
          <textarea id="shortDescription" name="shortDescription" rows={2} defaultValue={product.shortDescription ?? ""} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Повний опис (HTML)</label>
          <textarea id="description" name="description" rows={8} defaultValue={product.description ?? ""} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono" />
        </div>

        <fieldset className="border border-gray-200 rounded-lg p-4">
          <legend className="text-sm font-medium text-gray-700 px-2">SEO</legend>
          <div className="space-y-3">
            <Input id="metaTitle" name="metaTitle" label="Meta Title" defaultValue={product.metaTitle ?? ""} />
            <Input id="metaDesc" name="metaDesc" label="Meta Description" defaultValue={product.metaDesc ?? ""} />
          </div>
        </fieldset>
      </AdminForm>
    </div>
  );
}
