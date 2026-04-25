export interface ProductImage {
  id: string;
  url: string;
  alt: string | null;
  sortOrder: number;
}

export interface ProductListItem {
  id: string;
  slug: string;
  name: string;
  sku: string;
  price: number;
  compareAtPrice: number | null;
  stockStatus: string;
  quantity: number | null;
  coverImage: string | null;
  reviewCount: number;
  averageRating: number;
  category: {
    name: string;
    slug: string;
  };
}

export interface ProductDetail {
  id: string;
  slug: string;
  name: string;
  sku: string;
  shortDescription: string | null;
  description: string | null;
  price: number;
  compareAtPrice: number | null;
  stockStatus: string;
  quantity: number | null;
  metaTitle: string | null;
  metaDesc: string | null;
  images: ProductImage[];
  category: {
    id: string;
    name: string;
    slug: string;
  };
  createdAt: Date;
  updatedAt: Date;
}
