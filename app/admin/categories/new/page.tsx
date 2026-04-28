import { CategoryEditForm } from "../CategoryEditForm";

const emptyCategory = {
  id: "",
  name: "",
  slug: "",
  description: null,
  imageUrl: null,
  isActive: true,
  sortOrder: 0,
  metaTitle: null,
  metaDesc: null,
};

export default function AdminCategoryNewPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Нова категорія</h1>
      <CategoryEditForm category={emptyCategory} isNew />
    </div>
  );
}
