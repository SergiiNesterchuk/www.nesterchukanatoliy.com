import { prisma } from "@/shared/db";

export class PageRepository {
  static async findBySlug(slug: string) {
    return prisma.page.findFirst({
      where: { slug, isActive: true },
    });
  }

  /** Pages visible in desktop header navigation */
  static async findForNav() {
    return prisma.page.findMany({
      where: { isActive: true, showInNav: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, title: true, slug: true },
    });
  }

  /** Pages visible in footer */
  static async findForFooter() {
    return prisma.page.findMany({
      where: { isActive: true, showInFooter: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, title: true, slug: true },
    });
  }

  /** Pages visible in mobile menu */
  static async findForMobile() {
    return prisma.page.findMany({
      where: { isActive: true, showInMobileMenu: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, title: true, slug: true },
    });
  }

  /** Pages marked for homepage display */
  static async findForHome() {
    return prisma.page.findMany({
      where: { isActive: true, displayOnHome: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, title: true, slug: true },
    });
  }

  /** All active pages (for sitemap, catch-all slug) */
  static async findAll() {
    return prisma.page.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, title: true, slug: true },
    });
  }
}
