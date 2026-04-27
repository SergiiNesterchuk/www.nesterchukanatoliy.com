import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/shared/db";
import { sanitizeHtml } from "@/shared/sanitize-html";
import { SITE_NAME, SITE_URL } from "@/shared/constants";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const post = await prisma.blogPost.findFirst({
      where: { slug, isPublished: true },
      select: { title: true, seoTitle: true, seoDescription: true, excerpt: true, coverImageUrl: true },
    });
    if (!post) return { title: "Стаття не знайдена" };
    return {
      title: post.seoTitle || `${post.title} | ${SITE_NAME}`,
      description: post.seoDescription || post.excerpt || "",
      alternates: { canonical: `/blog/${slug}/` },
      openGraph: {
        title: post.seoTitle || post.title,
        description: post.seoDescription || post.excerpt || "",
        url: `${SITE_URL}/blog/${slug}/`,
        ...(post.coverImageUrl ? { images: [{ url: post.coverImageUrl }] } : {}),
      },
    };
  } catch {
    return { title: "Стаття" };
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;

  const post = await prisma.blogPost.findFirst({
    where: { slug, isPublished: true },
  });

  if (!post) notFound();

  const date = post.publishedAt || post.createdAt;
  const safeContent = sanitizeHtml(post.content);

  return (
    <article className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/blog/" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-6">
        <ArrowLeft className="h-4 w-4" /> Блог
      </Link>

      {post.coverImageUrl && (
        <div className="rounded-xl overflow-hidden mb-6">
          <img src={post.coverImageUrl} alt={post.title} className="w-full max-h-[400px] object-cover" />
        </div>
      )}

      <time className="text-sm text-gray-400">{date.toLocaleDateString("uk-UA", { year: "numeric", month: "long", day: "numeric" })}</time>
      <h1 className="mt-2 text-3xl font-bold text-gray-900 leading-tight">{post.title}</h1>

      <div className="mt-6 prose prose-sm md:prose-base max-w-none prose-headings:text-gray-900 prose-a:text-green-600" dangerouslySetInnerHTML={{ __html: safeContent }} />

      {post.ctaLabel && post.ctaUrl && (
        <div className="mt-8 p-6 bg-green-50 rounded-xl text-center">
          <Link
            href={post.ctaUrl}
            className="inline-flex items-center px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
          >
            {post.ctaLabel}
          </Link>
        </div>
      )}

      <div className="mt-8 pt-6 border-t">
        <Link href="/blog/" className="text-green-600 hover:underline text-sm">← Усі статті</Link>
      </div>
    </article>
  );
}
