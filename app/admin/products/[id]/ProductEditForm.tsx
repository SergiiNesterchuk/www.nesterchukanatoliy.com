"use client";

import { AdminForm } from "@/components/admin/AdminForm";
import { Input } from "@/components/ui/Input";

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
}

export function ProductEditForm({ product, categories, isNew }: Props) {
  return (
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
        <Input
          id="price"
          name="price"
          label="Ціна (копійки) *"
          type="number"
          defaultValue={product.price}
          required
        />
        <Input
          id="compareAtPrice"
          name="compareAtPrice"
          label="Стара ціна (копійки)"
          type="number"
          defaultValue={product.compareAtPrice ?? ""}
        />
        <div>
          <label htmlFor="stockStatus" className="block text-sm font-medium text-gray-700 mb-1">
            Наявність
          </label>
          <select
            id="stockStatus"
            name="stockStatus"
            defaultValue={product.stockStatus}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="in_stock">В наявності</option>
            <option value="out_of_stock">Немає в наявності</option>
            <option value="preorder">Передзамовлення</option>
          </select>
        </div>
        <Input
          id="quantity"
          name="quantity"
          label="Кількість"
          type="number"
          defaultValue={product.quantity ?? ""}
        />
        <Input id="sortOrder" name="sortOrder" label="Порядок сортування" type="number" defaultValue={product.sortOrder} />
        <div className="flex items-center gap-2 pt-6">
          <input
            type="checkbox"
            id="isActive"
            name="isActive"
            defaultChecked={product.isActive}
            className="rounded"
          />
          <label htmlFor="isActive" className="text-sm">Активний</label>
        </div>
      </div>

      <div>
        <label htmlFor="shortDescription" className="block text-sm font-medium text-gray-700 mb-1">
          Короткий опис
        </label>
        <textarea
          id="shortDescription"
          name="shortDescription"
          rows={2}
          defaultValue={product.shortDescription ?? ""}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
          Повний опис (HTML)
        </label>
        <textarea
          id="description"
          name="description"
          rows={8}
          defaultValue={product.description ?? ""}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
        />
      </div>

      <fieldset className="border border-gray-200 rounded-lg p-4">
        <legend className="text-sm font-medium text-gray-700 px-2">SEO</legend>
        <div className="space-y-3">
          <Input id="metaTitle" name="metaTitle" label="Meta Title" defaultValue={product.metaTitle ?? ""} />
          <Input id="metaDesc" name="metaDesc" label="Meta Description" defaultValue={product.metaDesc ?? ""} />
        </div>
      </fieldset>
    </AdminForm>
  );
}
