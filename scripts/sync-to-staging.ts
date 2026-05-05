/**
 * Sync production data to staging database.
 * Copies: categories, products, images, pages, blog posts, banners,
 *         settings, payment methods, admin users, redirects, product reviews.
 * Skips: orders, customers, payment events, integration logs, sync jobs.
 *
 * Usage:
 *   DATABASE_URL=<staging_public_url> PROD_DATABASE_URL=<prod_public_url> npx tsx scripts/sync-to-staging.ts
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const stagingUrl = process.env.DATABASE_URL;
const prodUrl = process.env.PROD_DATABASE_URL;

if (!stagingUrl) throw new Error("DATABASE_URL (staging) is not set");
if (!prodUrl) throw new Error("PROD_DATABASE_URL is not set");

if (stagingUrl === prodUrl) {
  throw new Error("SAFETY: DATABASE_URL and PROD_DATABASE_URL are the same! Aborting to prevent data loss.");
}

// Double-check: production URL should NOT contain "staging"
if (prodUrl.toLowerCase().includes("staging")) {
  throw new Error("SAFETY: PROD_DATABASE_URL contains 'staging'. Are you sure this is production?");
}

const prodPool = new pg.Pool({ connectionString: prodUrl });
const prodPrisma = new PrismaClient({ adapter: new PrismaPg(prodPool) });

const stagingPool = new pg.Pool({ connectionString: stagingUrl });
const stagingPrisma = new PrismaClient({ adapter: new PrismaPg(stagingPool) });

async function sync() {
  console.log("Connecting to production (read-only)...");
  console.log("Connecting to staging...\n");

  // Clear staging tables (order matters: FK dependencies first)
  console.log("Clearing staging tables...");
  // Orders & related (remove test orders that reference products)
  await stagingPrisma.orderStatusHistory.deleteMany();
  await stagingPrisma.paymentEvent.deleteMany();
  await stagingPrisma.orderItem.deleteMany();
  await stagingPrisma.order.deleteMany();
  await stagingPrisma.customerSession.deleteMany();
  await stagingPrisma.customer.deleteMany();
  await stagingPrisma.syncJob.deleteMany();
  await stagingPrisma.integrationLog.deleteMany();
  // Content tables
  await stagingPrisma.productReview.deleteMany();
  await stagingPrisma.productImage.deleteMany();
  await stagingPrisma.product.deleteMany();
  await stagingPrisma.category.deleteMany();
  await stagingPrisma.blogPost.deleteMany();
  await stagingPrisma.banner.deleteMany();
  await stagingPrisma.page.deleteMany();
  await stagingPrisma.settings.deleteMany();
  await stagingPrisma.paymentMethod.deleteMany();
  await stagingPrisma.redirect.deleteMany();
  await stagingPrisma.adminUser.deleteMany();
  await stagingPrisma.orderCounter.deleteMany();
  console.log("Staging tables cleared.\n");

  // 1. Categories
  const categories = await prodPrisma.category.findMany();
  console.log(`Categories: ${categories.length}`);
  for (const cat of categories) {
    await stagingPrisma.category.upsert({
      where: { id: cat.id },
      update: { ...cat },
      create: { ...cat },
    });
  }

  // 2. Products (without relations)
  const products = await prodPrisma.product.findMany();
  console.log(`Products: ${products.length}`);
  for (const prod of products) {
    await stagingPrisma.product.upsert({
      where: { id: prod.id },
      update: { ...prod },
      create: { ...prod },
    });
  }

  // 3. Product Images
  const images = await prodPrisma.productImage.findMany();
  console.log(`Product Images: ${images.length}`);
  for (const img of images) {
    await stagingPrisma.productImage.upsert({
      where: { id: img.id },
      update: { ...img },
      create: { ...img },
    });
  }

  // 4. Pages
  const pages = await prodPrisma.page.findMany();
  console.log(`Pages: ${pages.length}`);
  for (const page of pages) {
    await stagingPrisma.page.upsert({
      where: { id: page.id },
      update: { ...page },
      create: { ...page },
    });
  }

  // 5. Blog Posts
  const posts = await prodPrisma.blogPost.findMany();
  console.log(`Blog Posts: ${posts.length}`);
  for (const post of posts) {
    await stagingPrisma.blogPost.upsert({
      where: { id: post.id },
      update: { ...post },
      create: { ...post },
    });
  }

  // 6. Banners
  const banners = await prodPrisma.banner.findMany();
  console.log(`Banners: ${banners.length}`);
  for (const banner of banners) {
    await stagingPrisma.banner.upsert({
      where: { id: banner.id },
      update: { ...banner },
      create: { ...banner },
    });
  }

  // 7. Settings
  const settings = await prodPrisma.settings.findMany();
  console.log(`Settings: ${settings.length}`);
  for (const s of settings) {
    await stagingPrisma.settings.upsert({
      where: { id: s.id },
      update: { ...s },
      create: { ...s },
    });
  }

  // 8. Payment Methods
  const paymentMethods = await prodPrisma.paymentMethod.findMany();
  console.log(`Payment Methods: ${paymentMethods.length}`);
  for (const pm of paymentMethods) {
    await stagingPrisma.paymentMethod.upsert({
      where: { id: pm.id },
      update: { ...pm },
      create: { ...pm },
    });
  }

  // 9. Admin Users
  const admins = await prodPrisma.adminUser.findMany();
  console.log(`Admin Users: ${admins.length}`);
  for (const admin of admins) {
    await stagingPrisma.adminUser.upsert({
      where: { id: admin.id },
      update: { ...admin },
      create: { ...admin },
    });
  }

  // 10. Redirects
  const redirects = await prodPrisma.redirect.findMany();
  console.log(`Redirects: ${redirects.length}`);
  for (const r of redirects) {
    await stagingPrisma.redirect.upsert({
      where: { id: r.id },
      update: { ...r },
      create: { ...r },
    });
  }

  // 11. Product Reviews
  const reviews = await prodPrisma.productReview.findMany();
  console.log(`Product Reviews: ${reviews.length}`);
  for (const rev of reviews) {
    await stagingPrisma.productReview.upsert({
      where: { id: rev.id },
      update: { ...rev },
      create: { ...rev },
    });
  }

  // 12. Order Counter (sync so order numbers continue correctly)
  const counter = await prodPrisma.orderCounter.findFirst();
  if (counter) {
    await stagingPrisma.orderCounter.upsert({
      where: { id: counter.id },
      update: { value: counter.value },
      create: { ...counter },
    });
    console.log(`Order Counter: ${counter.value}`);
  }

  console.log("\nSync complete! Staging DB now mirrors production content.");
  console.log("Skipped: orders, customers, payment events, integration logs, sync jobs.");
}

sync()
  .catch((e) => {
    console.error("Sync failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prodPrisma.$disconnect();
    await stagingPrisma.$disconnect();
    await prodPool.end();
    await stagingPool.end();
  });
