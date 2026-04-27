import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/shared/db";
import { SITE_NAME } from "@/shared/constants";

export const metadata: Metadata = {
  title: `Блог | ${SITE_NAME}`,
  description: "Корисні статті про натуральний яблучний оцет, бордоську суміш та догляд за садом.",
  alternates: { canonical: "/blog/" },
};

export const dynamic = "force-dynamic";

export default async function BlogPage() {
  let posts: Array<{
    slug: string; title: string; excerpt: string | null;
    coverImageUrl: string | null; publishedAt: Date | null; createdAt: Date;
  }> = [];

  try {
    posts = await prisma.blogPost.findMany({
      where: { isPublished: true },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      select: { slug: true, title: true, excerpt: true, coverImageUrl: true, publishedAt: true, createdAt: true },
    });
  } catch { /* */ }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Блог</h1>

      {posts.length === 0 ? (
        <p className="text-center text-gray-500 py-16">Статей поки немає. Слідкуйте за оновленнями!</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {posts.map((post) => {
            const date = post.publishedAt || post.createdAt;
            return (
              <Link key={post.slug} href={`/blog/${post.slug}/`} className="group bg-white rounded-xl border overflow-hidden hover:shadow-md transition-shadow">
                {post.coverImageUrl && (
                  <div className="aspect-[16/9] bg-gray-100 overflow-hidden">
                    <img src={post.coverImageUrl} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                  </div>
                )}
                <div className="p-5">
                  <time className="text-xs text-gray-400">{date.toLocaleDateString("uk-UA", { year: "numeric", month: "long", day: "numeric" })}</time>
                  <h2 className="mt-1 text-lg font-semibold text-gray-900 group-hover:text-green-600 transition-colors line-clamp-2">{post.title}</h2>
                  {post.excerpt && <p className="mt-2 text-sm text-gray-500 line-clamp-3">{post.excerpt}</p>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
