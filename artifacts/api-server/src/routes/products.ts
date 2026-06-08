import { Router } from "express";
import { db, productsTable, categoriesTable } from "@workspace/db";
import { eq, and, ilike, or, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { CreateProductBody, UpdateProductBody } from "@workspace/api-zod";

const router = Router();
router.use(requireAuth);

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Math.random().toString(36).slice(2, 6);
}

router.get("/", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { status, categoryId, search, page = "1", perPage = "20" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page));
  const perPageNum = Math.min(100, Math.max(1, parseInt(perPage)));
  const offset = (pageNum - 1) * perPageNum;

  const conditions = [eq(productsTable.tenantId, tenantId)];
  if (status) conditions.push(eq(productsTable.status, status));
  if (categoryId) conditions.push(eq(productsTable.categoryId, categoryId));
  if (search) conditions.push(or(ilike(productsTable.name, `%${search}%`), ilike(productsTable.sku ?? sql`''`, `%${search}%`))!);

  const [countRow] = await db.select({ total: sql<number>`count(*)::int` }).from(productsTable).where(and(...conditions));
  const rows = await db
    .select({
      product: productsTable,
      categoryName: categoriesTable.name,
    })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(and(...conditions))
    .orderBy(sql`${productsTable.createdAt} desc`)
    .limit(perPageNum)
    .offset(offset);

  res.json({
    data: rows.map(({ product: p, categoryName }) => ({
      id: p.id, name: p.name, slug: p.slug, description: p.description,
      price: parseFloat(p.price), compareAtPrice: p.compareAtPrice ? parseFloat(p.compareAtPrice) : null,
      sku: p.sku, barcode: p.barcode, status: p.status, visibility: p.visibility,
      categoryId: p.categoryId, categoryName: categoryName ?? null,
      imageUrl: p.imageUrl, stock: p.stock, createdAt: p.createdAt,
    })),
    meta: { page: pageNum, perPage: perPageNum, total: countRow.total },
  });
});

router.post("/", async (req, res) => {
  const parse = CreateProductBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid input", details: parse.error.issues });
    return;
  }
  const d = parse.data;
  const [p] = await db.insert(productsTable).values({
    tenantId: req.user!.tenantId,
    name: d.name,
    slug: slugify(d.name),
    description: d.description,
    price: String(d.price),
    compareAtPrice: d.compareAtPrice != null ? String(d.compareAtPrice) : null,
    sku: d.sku,
    barcode: d.barcode,
    status: d.status ?? "draft",
    visibility: d.visibility ?? "public",
    categoryId: d.categoryId,
    imageUrl: d.imageUrl,
    stock: d.stock ?? 0,
  }).returning();

  let categoryName: string | null = null;
  if (p.categoryId) {
    const [cat] = await db.select({ name: categoriesTable.name }).from(categoriesTable).where(eq(categoriesTable.id, p.categoryId)).limit(1);
    categoryName = cat?.name ?? null;
  }

  res.status(201).json({
    id: p.id, name: p.name, slug: p.slug, description: p.description,
    price: parseFloat(p.price), compareAtPrice: p.compareAtPrice ? parseFloat(p.compareAtPrice) : null,
    sku: p.sku, barcode: p.barcode, status: p.status, visibility: p.visibility,
    categoryId: p.categoryId, categoryName, imageUrl: p.imageUrl, stock: p.stock, createdAt: p.createdAt,
  });
});

router.get("/:id", async (req, res) => {
  const [row] = await db
    .select({ product: productsTable, categoryName: categoriesTable.name })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(and(eq(productsTable.id, req.params.id), eq(productsTable.tenantId, req.user!.tenantId)))
    .limit(1);

  if (!row) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  const p = row.product;
  res.json({
    id: p.id, name: p.name, slug: p.slug, description: p.description,
    price: parseFloat(p.price), compareAtPrice: p.compareAtPrice ? parseFloat(p.compareAtPrice) : null,
    sku: p.sku, barcode: p.barcode, status: p.status, visibility: p.visibility,
    categoryId: p.categoryId, categoryName: row.categoryName ?? null,
    imageUrl: p.imageUrl, stock: p.stock, createdAt: p.createdAt,
  });
});

router.patch("/:id", async (req, res) => {
  const parse = UpdateProductBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const existing = await db.select({ id: productsTable.id }).from(productsTable).where(and(eq(productsTable.id, req.params.id), eq(productsTable.tenantId, req.user!.tenantId))).limit(1);
  if (!existing.length) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  const d = parse.data;
  const updates: Record<string, unknown> = {};
  if (d.name !== undefined) { updates.name = d.name; updates.slug = slugify(d.name); }
  if (d.description !== undefined) updates.description = d.description;
  if (d.price !== undefined) updates.price = String(d.price);
  if (d.compareAtPrice !== undefined) updates.compareAtPrice = d.compareAtPrice != null ? String(d.compareAtPrice) : null;
  if (d.sku !== undefined) updates.sku = d.sku;
  if (d.barcode !== undefined) updates.barcode = d.barcode;
  if (d.status !== undefined) updates.status = d.status;
  if (d.visibility !== undefined) updates.visibility = d.visibility;
  if (d.categoryId !== undefined) updates.categoryId = d.categoryId;
  if (d.imageUrl !== undefined) updates.imageUrl = d.imageUrl;
  if (d.stock !== undefined) updates.stock = d.stock;

  const [p] = await db.update(productsTable).set(updates).where(eq(productsTable.id, req.params.id)).returning();
  let categoryName: string | null = null;
  if (p.categoryId) {
    const [cat] = await db.select({ name: categoriesTable.name }).from(categoriesTable).where(eq(categoriesTable.id, p.categoryId)).limit(1);
    categoryName = cat?.name ?? null;
  }
  res.json({
    id: p.id, name: p.name, slug: p.slug, description: p.description,
    price: parseFloat(p.price), compareAtPrice: p.compareAtPrice ? parseFloat(p.compareAtPrice) : null,
    sku: p.sku, barcode: p.barcode, status: p.status, visibility: p.visibility,
    categoryId: p.categoryId, categoryName, imageUrl: p.imageUrl, stock: p.stock, createdAt: p.createdAt,
  });
});

router.delete("/:id", async (req, res) => {
  const existing = await db.select({ id: productsTable.id }).from(productsTable).where(and(eq(productsTable.id, req.params.id), eq(productsTable.tenantId, req.user!.tenantId))).limit(1);
  if (!existing.length) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  await db.delete(productsTable).where(eq(productsTable.id, req.params.id));
  res.status(204).send();
});

export default router;
