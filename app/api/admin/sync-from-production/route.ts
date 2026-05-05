import { NextRequest, NextResponse } from "next/server";
import { adminGuard } from "@/shared/admin-auth";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { prisma } from "@/shared/db";

export const maxDuration = 60;

export const POST = adminGuard(async (_req: NextRequest) => {
  if (process.env.NEXT_PUBLIC_APP_ENV !== "staging") {
    return NextResponse.json(
      { success: false, error: "Sync available only on staging" },
      { status: 403 }
    );
  }

  const prodUrl = process.env.PROD_DATABASE_URL;
  if (!prodUrl) {
    return NextResponse.json(
      { success: false, error: "PROD_DATABASE_URL not configured" },
      { status: 500 }
    );
  }

  const prodPool = new pg.Pool({ connectionString: prodUrl });
  const prodPrisma = new PrismaClient({ adapter: new PrismaPg(prodPool) });

  try {
    // Clear staging content (FK order matters)
    await prisma.orderStatusHistory.deleteMany();
    await prisma.paymentEvent.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.customerSession.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.syncJob.deleteMany();
    await prisma.integrationLog.deleteMany();
    await prisma.productReview.deleteMany();
    await prisma.productImage.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.blogPost.deleteMany();
    await prisma.banner.deleteMany();
    await prisma.page.deleteMany();
    await prisma.settings.deleteMany();
    await prisma.paymentMethod.deleteMany();
    await prisma.redirect.deleteMany();
    await prisma.adminUser.deleteMany();
    await prisma.orderCounter.deleteMany();

    const counts: Record<string, number> = {};

    // Categories
    const categories = await prodPrisma.category.findMany();
    for (const row of categories) await prisma.category.create({ data: row });
    counts.categories = categories.length;

    // Products
    const products = await prodPrisma.product.findMany();
    for (const row of products) await prisma.product.create({ data: row });
    counts.products = products.length;

    // Product Images
    const images = await prodPrisma.productImage.findMany();
    for (const row of images) await prisma.productImage.create({ data: row });
    counts.images = images.length;

    // Pages
    const pages = await prodPrisma.page.findMany();
    for (const row of pages) await prisma.page.create({ data: row });
    counts.pages = pages.length;

    // Blog Posts
    const posts = await prodPrisma.blogPost.findMany();
    for (const row of posts) await prisma.blogPost.create({ data: row });
    counts.blogPosts = posts.length;

    // Banners
    const banners = await prodPrisma.banner.findMany();
    for (const row of banners) await prisma.banner.create({ data: row });
    counts.banners = banners.length;

    // Settings
    const settings = await prodPrisma.settings.findMany();
    for (const row of settings) await prisma.settings.create({ data: row });
    counts.settings = settings.length;

    // Payment Methods
    const pms = await prodPrisma.paymentMethod.findMany();
    for (const row of pms) await prisma.paymentMethod.create({ data: row });
    counts.paymentMethods = pms.length;

    // Admin Users
    const admins = await prodPrisma.adminUser.findMany();
    for (const row of admins) await prisma.adminUser.create({ data: row });
    counts.adminUsers = admins.length;

    // Redirects
    const redirects = await prodPrisma.redirect.findMany();
    for (const row of redirects) await prisma.redirect.create({ data: row });
    counts.redirects = redirects.length;

    // Product Reviews
    const reviews = await prodPrisma.productReview.findMany();
    for (const row of reviews) await prisma.productReview.create({ data: row });
    counts.reviews = reviews.length;

    // Order Counter
    const counter = await prodPrisma.orderCounter.findFirst();
    if (counter) {
      await prisma.orderCounter.create({ data: counter });
      counts.orderCounter = counter.value;
    }

    return NextResponse.json({ success: true, data: counts });
  } finally {
    await prodPrisma.$disconnect();
    await prodPool.end();
  }
});
