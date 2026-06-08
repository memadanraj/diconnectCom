import { Router } from "express";
import { db, categoriesTable, productsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { CreateCategoryBody, UpdateCategoryBody } from "@workspace/api-zod";

const router = Router();
router.use(requireAuth);

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

router.get("/", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const rows = await db.select().from(categoriesTable).where(eq(categoriesTable.tenantId, tenantId));

  const counts = await db
    .select({ categoryId: productsTable.categoryId, count: sql<number>`count(*)::int` })
    .from(productsTable)
    .where(eq(productsTable.tenantId, tenantId))
    .groupBy(productsTable.categoryId);

  const countMap = new Map(counts.map((c) => [c.categoryId, c.count]));

  res.json(rows.map((c) => ({ id: c.id, name: c.name, slug: c.slug, description: c.description, productCount: countMap.get(c.id) ?? 0, createdAt: c.createdAt })));
});

router.post("/", async (req, res) => {
  const parse = CreateCategoryBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { name, description } = parse.data;
  const [cat] = await db.insert(categoriesTable).values({ tenantId: req.user!.tenantId, name, slug: slugify(name), description }).returning();
  res.status(201).json({ id: cat.id, name: cat.name, slug: cat.slug, description: cat.description, productCount: 0, createdAt: cat.createdAt });
});

router.get("/:id", async (req, res) => {
  const [cat] = await db.select().from(categoriesTable).where(and(eq(categoriesTable.id, req.params.id), eq(categoriesTable.tenantId, req.user!.tenantId))).limit(1);
  if (!cat) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  const [cnt] = await db.select({ count: sql<number>`count(*)::int` }).from(productsTable).where(and(eq(productsTable.categoryId, cat.id), eq(productsTable.tenantId, req.user!.tenantId)));
  res.json({ id: cat.id, name: cat.name, slug: cat.slug, description: cat.description, productCount: cnt?.count ?? 0, createdAt: cat.createdAt });
});

router.patch("/:id", async (req, res) => {
  const parse = UpdateCategoryBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const existing = await db.select().from(categoriesTable).where(and(eq(categoriesTable.id, req.params.id), eq(categoriesTable.tenantId, req.user!.tenantId))).limit(1);
  if (!existing.length) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  const updates: Record<string, unknown> = {};
  if (parse.data.name) { updates.name = parse.data.name; updates.slug = slugify(parse.data.name); }
  if (parse.data.description !== undefined) updates.description = parse.data.description;
  const [cat] = await db.update(categoriesTable).set(updates).where(eq(categoriesTable.id, req.params.id)).returning();
  res.json({ id: cat.id, name: cat.name, slug: cat.slug, description: cat.description, productCount: 0, createdAt: cat.createdAt });
});

router.delete("/:id", async (req, res) => {
  const existing = await db.select().from(categoriesTable).where(and(eq(categoriesTable.id, req.params.id), eq(categoriesTable.tenantId, req.user!.tenantId))).limit(1);
  if (!existing.length) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  await db.delete(categoriesTable).where(eq(categoriesTable.id, req.params.id));
  res.status(204).send();
});

export default router;
