import { prisma } from "@/shared/db";
import { notFound } from "next/navigation";
import { AdminForm } from "@/components/admin/AdminForm";
import { Input } from "@/components/ui/Input";

export const dynamic = "force-dynamic";

export default async function AdminPageEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const isNew = id === "new";

  const page = isNew
    ? null
    : await prisma.page.findUnique({ where: { id } });

  if (!isNew && !page) notFound();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {isNew ? "Нова сторінка" : `Редагування: ${page!.title}`}
      </h1>
      <AdminForm
        action={isNew ? "/api/admin/pages" : `/api/admin/pages/${id}`}
        method={isNew ? "POST" : "PUT"}
        onSuccess="/admin/pages"
        submitLabel={isNew ? "Створити" : "Зберегти"}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input id="title" name="title" label="Заголовок *" defaultValue={page?.title ?? ""} required />
          <Input id="slug" name="slug" label="Slug *" defaultValue={page?.slug ?? ""} required />
          <Input id="sortOrder" name="sortOrder" label="Порядок" type="number" defaultValue={page?.sortOrder ?? 0} />
          <div className="flex items-center gap-2 pt-6">
            <input type="checkbox" id="isActive" name="isActive" defaultChecked={page?.isActive ?? true} className="rounded" />
            <label htmlFor="isActive" className="text-sm">Активна</label>
          </div>
        </div>
        <div>
          <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">Контент (HTML) *</label>
          <textarea
            id="content"
            name="content"
            rows={15}
            defaultValue={page?.content ?? ""}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
            required
          />
        </div>
        <fieldset className="border border-gray-200 rounded-lg p-4">
          <legend className="text-sm font-medium text-gray-700 px-2">SEO</legend>
          <div className="space-y-3">
            <Input id="metaTitle" name="metaTitle" label="Meta Title" defaultValue={page?.metaTitle ?? ""} />
            <Input id="metaDesc" name="metaDesc" label="Meta Description" defaultValue={page?.metaDesc ?? ""} />
          </div>
        </fieldset>
      </AdminForm>
    </div>
  );
}
