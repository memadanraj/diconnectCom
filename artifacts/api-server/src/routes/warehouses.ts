import { Router } from "express";
import { db, warehousesTable, inventoryTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { CreateWarehouseBody, UpdateWarehouseBody } from "@workspace/api-zod";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const rows = await db
    .select({
      warehouse: warehousesTable,
      inventoryCount: sql<number>`count(${inventoryTable.id})::int`,
    })
    .from(warehousesTable)
    .leftJoin(inventoryTable, eq(warehousesTable.id, inventoryTable.warehouseId))
    .where(eq(warehousesTable.tenantId, tenantId))
    .groupBy(warehousesTable.id)
    .orderBy(sql`${warehousesTable.isDefault} desc, ${warehousesTable.createdAt} asc`);

  res.json(rows.map(({ warehouse: w, inventoryCount }) => ({
    id: w.id, name: w.name, address: w.address, city: w.city, country: w.country,
    isDefault: w.isDefault, isActive: w.isActive, inventoryCount: inventoryCount ?? 0, createdAt: w.createdAt,
  })));
});

router.post("/", async (req, res) => {
  const parse = CreateWarehouseBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid input", details: parse.error.issues });
    return;
  }
  const tenantId = req.user!.tenantId;
  const d = parse.data;

  if (d.isDefault) {
    await db.update(warehousesTable).set({ isDefault: false }).where(eq(warehousesTable.tenantId, tenantId));
  }

  const [w] = await db.insert(warehousesTable).values({
    tenantId,
    name: d.name,
    address: d.address,
    city: d.city,
    country: d.country,
    isDefault: d.isDefault ?? false,
  }).returning();

  res.status(201).json({ id: w.id, name: w.name, address: w.address, city: w.city, country: w.country, isDefault: w.isDefault, isActive: w.isActive, inventoryCount: 0, createdAt: w.createdAt });
});

router.get("/:id", async (req, res) => {
  const [row] = await db
    .select({ warehouse: warehousesTable, inventoryCount: sql<number>`count(${inventoryTable.id})::int` })
    .from(warehousesTable)
    .leftJoin(inventoryTable, eq(warehousesTable.id, inventoryTable.warehouseId))
    .where(and(eq(warehousesTable.id, req.params.id), eq(warehousesTable.tenantId, req.user!.tenantId)))
    .groupBy(warehousesTable.id)
    .limit(1);

  if (!row) {
    res.status(404).json({ error: "Warehouse not found" });
    return;
  }
  const w = row.warehouse;
  res.json({ id: w.id, name: w.name, address: w.address, city: w.city, country: w.country, isDefault: w.isDefault, isActive: w.isActive, inventoryCount: row.inventoryCount ?? 0, createdAt: w.createdAt });
});

router.patch("/:id", async (req, res) => {
  const parse = UpdateWarehouseBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const tenantId = req.user!.tenantId;
  const existing = await db.select({ id: warehousesTable.id }).from(warehousesTable).where(and(eq(warehousesTable.id, req.params.id), eq(warehousesTable.tenantId, tenantId))).limit(1);
  if (!existing.length) {
    res.status(404).json({ error: "Warehouse not found" });
    return;
  }
  const d = parse.data;
  if (d.isDefault) {
    await db.update(warehousesTable).set({ isDefault: false }).where(eq(warehousesTable.tenantId, tenantId));
  }
  const updates: Record<string, unknown> = {};
  if (d.name !== undefined) updates.name = d.name;
  if (d.address !== undefined) updates.address = d.address;
  if (d.city !== undefined) updates.city = d.city;
  if (d.country !== undefined) updates.country = d.country;
  if (d.isDefault !== undefined) updates.isDefault = d.isDefault;
  if (d.isActive !== undefined) updates.isActive = d.isActive;
  const [w] = await db.update(warehousesTable).set(updates).where(eq(warehousesTable.id, req.params.id)).returning();
  res.json({ id: w.id, name: w.name, address: w.address, city: w.city, country: w.country, isDefault: w.isDefault, isActive: w.isActive, createdAt: w.createdAt });
});

router.delete("/:id", async (req, res) => {
  const existing = await db.select({ id: warehousesTable.id, isDefault: warehousesTable.isDefault }).from(warehousesTable).where(and(eq(warehousesTable.id, req.params.id), eq(warehousesTable.tenantId, req.user!.tenantId))).limit(1);
  if (!existing.length) {
    res.status(404).json({ error: "Warehouse not found" });
    return;
  }
  if (existing[0].isDefault) {
    res.status(400).json({ error: "Cannot delete the default warehouse" });
    return;
  }
  await db.delete(inventoryTable).where(eq(inventoryTable.warehouseId, req.params.id));
  await db.delete(warehousesTable).where(eq(warehousesTable.id, req.params.id));
  res.status(204).send();
});

export default router;
