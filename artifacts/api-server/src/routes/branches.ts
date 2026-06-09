import { Router } from "express";
import { db, branchesTable, warehousesTable } from "@workspace/db";
import { eq, and, ilike, sql, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

function serialize(b: typeof branchesTable.$inferSelect) {
  return {
    id: b.id,
    name: b.name,
    warehouseId: b.warehouseId,
    address: b.address,
    city: b.city,
    phone: b.phone,
    email: b.email,
    isActive: b.isActive,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}

router.get("/", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { search, page = "1", perPage = "20" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page));
  const perPageNum = Math.min(100, Math.max(1, parseInt(perPage)));
  const offset = (pageNum - 1) * perPageNum;

  const conditions = [eq(branchesTable.tenantId, tenantId)];
  if (search) conditions.push(ilike(branchesTable.name, `%${search}%`));

  const [countRow] = await db.select({ total: sql<number>`count(*)::int` }).from(branchesTable).where(and(...conditions));

  const rows = await db
    .select({ branch: branchesTable, warehouseName: warehousesTable.name })
    .from(branchesTable)
    .leftJoin(warehousesTable, eq(branchesTable.warehouseId, warehousesTable.id))
    .where(and(...conditions))
    .orderBy(desc(branchesTable.createdAt))
    .limit(perPageNum)
    .offset(offset);

  res.json({
    data: rows.map((r) => ({ ...serialize(r.branch), warehouseName: r.warehouseName ?? null })),
    meta: { page: pageNum, perPage: perPageNum, total: countRow.total },
  });
});

router.post("/", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { name, warehouseId, address, city, phone, email, isActive } = req.body;
  if (!name) { res.status(400).json({ error: "name is required" }); return; }

  const [branch] = await db.insert(branchesTable).values({
    tenantId, name,
    warehouseId: warehouseId ?? null,
    address: address ?? null,
    city: city ?? null,
    phone: phone ?? null,
    email: email ?? null,
    isActive: isActive !== false,
  }).returning();

  res.status(201).json(serialize(branch));
});

router.get("/:id", async (req, res) => {
  const [row] = await db
    .select({ branch: branchesTable, warehouseName: warehousesTable.name })
    .from(branchesTable)
    .leftJoin(warehousesTable, eq(branchesTable.warehouseId, warehousesTable.id))
    .where(and(eq(branchesTable.id, req.params.id), eq(branchesTable.tenantId, req.user!.tenantId)))
    .limit(1);

  if (!row) { res.status(404).json({ error: "Branch not found" }); return; }
  res.json({ ...serialize(row.branch), warehouseName: row.warehouseName ?? null });
});

router.patch("/:id", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const existing = await db.select({ id: branchesTable.id }).from(branchesTable).where(and(eq(branchesTable.id, req.params.id), eq(branchesTable.tenantId, tenantId))).limit(1);
  if (!existing.length) { res.status(404).json({ error: "Branch not found" }); return; }

  const { name, warehouseId, address, city, phone, email, isActive } = req.body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (warehouseId !== undefined) updates.warehouseId = warehouseId;
  if (address !== undefined) updates.address = address;
  if (city !== undefined) updates.city = city;
  if (phone !== undefined) updates.phone = phone;
  if (email !== undefined) updates.email = email;
  if (isActive !== undefined) updates.isActive = isActive;

  const [updated] = await db.update(branchesTable).set(updates).where(eq(branchesTable.id, req.params.id)).returning();
  res.json(serialize(updated));
});

router.delete("/:id", async (req, res) => {
  const existing = await db.select({ id: branchesTable.id }).from(branchesTable).where(and(eq(branchesTable.id, req.params.id), eq(branchesTable.tenantId, req.user!.tenantId))).limit(1);
  if (!existing.length) { res.status(404).json({ error: "Branch not found" }); return; }
  await db.delete(branchesTable).where(eq(branchesTable.id, req.params.id));
  res.status(204).send();
});

export default router;
