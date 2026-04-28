"use client";

import { useState, useEffect, useRef } from "react";
import { AdminForm } from "@/components/admin/AdminForm";
import { Input } from "@/components/ui/Input";
import { Trash2, Upload, ChevronLeft, ChevronRight } from "lucide-react";
import { generateSlug } from "@/shared/slug";

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
  const [slug, setSlug] = useState(product.slug);
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

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || isNew) return;

    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.append("file", files[i]);
        const res = await fetch(`/api/admin/products/${product.id}/images`, {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (data.success) {
          setImages((prev) => [...prev, data.data]);
        }
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

  const moveImage = async (imageId: string, direction: "left" | "right") => {
    const idx = images.findIndex((img) => img.id === imageId);
    if (idx === -1) return;
    const swapIdx = direction === "left" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= images.length) return;

    const newImages = [...images];
    [newImages[idx], newImages[swapIdx]] = [newImages[swapIdx], newImages[idx]];
    setImages(newImages);

    // Persist new order
    const updates = newImages.map((img, i) => ({ id: img.id, sortOrder: i }));
    await fetch(`/api/admin/products/${product.id}/images`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates }),
    });
  };

  return (
    <div className="space-y-6">
      {/* Images section */}
      {!isNew && (
        <div className="bg-white rounded-xl border p-4">
          <h3 className="font-semibold mb-1">Фото товару</h3>
          <p className="text-xs text-gray-400 mb-3">Перше фото — головне. Стрілками можна змінити порядок.</p>
          <div className="flex flex-wrap gap-3 mb-3">
            {images.map((img, idx) => (
              <div key={img.id} className="relative group">
                <div className={`w-24 h-24 rounded-lg overflow-hidden border-2 ${idx === 0 ? "border-green-500" : "border-gray-200"}`}>
                  <img src={img.url} alt={img.alt || ""} className="w-full h-full object-cover" />
                </div>
                {idx === 0 && (
                  <span className="absolute -top-2 -left-2 bg-green-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                    Головне
                  </span>
                )}
                <div className="absolute bottom-1 left-1 right-1 flex justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => moveImage(img.id, "left")}
                    disabled={idx === 0}
                    className="bg-white/90 rounded p-0.5 text-gray-600 hover:text-gray-900 disabled:opacity-30"
                    title="Перемістити ліворуч"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteImage(img.id)}
                    className="bg-red-500/90 rounded p-0.5 text-white"
                    title="Видалити"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => moveImage(img.id, "right")}
                    disabled={idx === images.length - 1}
                    className="bg-white/90 rounded p-0.5 text-gray-600 hover:text-gray-900 disabled:opacity-30"
                    title="Перемістити праворуч"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {images.length === 0 && (
              <div className="text-sm text-gray-400">Немає фото</div>
            )}
          </div>
          <label className="inline-flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors">
            <Upload className="h-4 w-4" />
            {uploading ? "Завантаження..." : "Завантажити фото"}
            <input type="file" accept="image/*" multiple onChange={handleUpload} className="hidden" disabled={uploading} />
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
          <Input id="name" name="name" label="Назва *" defaultValue={product.name} required ref={nameRef} />
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
          <Input id="sku" name="sku" label="SKU *" defaultValue={product.sku} required />
          <div>
            <label htmlFor="categoryId" className="block text-sm font-medium text-gray-700 mb-1">Категорія *</label>
            <select id="categoryId" name="categoryId" defaultValue={product.categoryId} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" required>
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
