import { prisma } from "@/shared/db";
import { ValidationError } from "@/shared/errors";

/**
 * Category, Product and Page all resolve from the same public URL `/{slug}`
 * (see resolveSlug() in app/(store)/[slug]/page.tsx, which checks them in that
 * order). Prisma enforces @unique per table only, so nothing stops the same
 * slug existing in two of them — and whichever comes first in resolution order
 * wins, leaving the others unreachable.
 *
 * BlogPost is deliberately excluded: it lives at /blog/{slug}, a separate namespace.
 */
export type SlugOwnerType = "category" | "product" | "page";

interface SlugSelf {
  type: SlugOwnerType;
  id: string;
}

const OWNER_LABELS: Record<SlugOwnerType, string> = {
  category: "категорією",
  product: "товаром",
  page: "сторінкою",
};

/** Who currently owns `slug` in the `/{slug}` namespace, ignoring `self`. */
export async function findSlugOwner(
  slug: string,
  self?: SlugSelf
): Promise<{ type: SlugOwnerType; name: string } | null> {
  const exclude = (type: SlugOwnerType) =>
    self?.type === type ? { NOT: { id: self.id } } : {};

  const [category, product, page] = await Promise.all([
    prisma.category.findFirst({ where: { slug, ...exclude("category") }, select: { name: true } }),
    prisma.product.findFirst({ where: { slug, ...exclude("product") }, select: { name: true } }),
    prisma.page.findFirst({ where: { slug, ...exclude("page") }, select: { title: true } }),
  ]);

  if (category) return { type: "category", name: category.name };
  if (product) return { type: "product", name: product.name };
  if (page) return { type: "page", name: page.title };
  return null;
}

/**
 * For slugs the admin typed explicitly — never silently rewrite those.
 * Throws ValidationError (HTTP 400) naming the entity that already owns the URL.
 */
export async function assertSlugAvailable(slug: string, self?: SlugSelf): Promise<void> {
  const owner = await findSlugOwner(slug, self);
  if (owner) {
    throw new ValidationError(
      `URL /${slug} вже використовується ${OWNER_LABELS[owner.type]} «${owner.name}». Вкажіть іншу адресу.`
    );
  }
}

/**
 * For slugs auto-generated from a name — returns the first free variant:
 * `hrusha`, `hrusha-2`, `hrusha-3`, ... Readable, no hashes.
 */
export async function getUniquePublicSlug(baseSlug: string, self?: SlugSelf): Promise<string> {
  if (!(await findSlugOwner(baseSlug, self))) return baseSlug;

  // Cap the scan so a pathological catalog can never spin forever.
  for (let n = 2; n <= 200; n++) {
    const candidate = `${baseSlug}-${n}`;
    if (!(await findSlugOwner(candidate, self))) return candidate;
  }

  throw new ValidationError(
    `Не вдалося підібрати вільну адресу для /${baseSlug}. Вкажіть slug вручну.`
  );
}

/**
 * The admin forms already track whether the slug was auto-filled from the name
 * or typed by hand (`slugManual` state) and send it as `slugAuto`.
 * Absent flag = treat as typed, i.e. never rewrite silently.
 */
export function isAutoSlug(body: unknown): boolean {
  const value = (body as Record<string, unknown> | null)?.slugAuto;
  return value === true || value === "true";
}

/** Slug to persist on create: auto-generated ones shift to the next free variant. */
export async function resolveSlugForCreate(slug: string, auto: boolean): Promise<string> {
  if (auto) return getUniquePublicSlug(slug);
  await assertSlugAvailable(slug);
  return slug;
}
