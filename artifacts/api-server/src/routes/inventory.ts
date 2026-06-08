import { Router } from "express";
import { db, inventoryTable, inventoryTransactionsTable, productsTable, warehousesTable } from "@workspace/db";
import { eq, and, lte, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { CreateInventoryBody, UpdateInventoryBody, CreateInventoryTransactionBody } from "@workspace/api-zod";

const router = Router();
router.use(requireAuth);

function formatItem(inv: typeof inventoryTable.$inferSelect, productName?: string | null, productSku?: string | null, warehouseName?: string | null) {
  const onHand = inv.available + inv.reserved + inv.damaged + inv.returned;
  return {
    id: inv.id, productId: inv.productId, productName: productName ?? null, productSku: productSku ?? null,
    warehouseId: inv.warehouseId, warehouseName: warehouseName ?? null,
    available: inv.available, reserved: inv.reserved, damaged: inv.damaged, returned: inv.returned,
    onHand, reorderPoint: inv.reorderPoint, isLowStock: inv.available <= inv.reorderPoint,
    createdAt: inv.createdAt, updatedAt: inv.updatedAt,
  };
}

router.get("/", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { warehouseId, productId, lowStock, page = "1", perPage = "20" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page));
  const perPageNum = Math.min(100, Math.max(1, parseInt(perPage)));
  const offset = (pageNum - 1) * perPageNum;

  const conditions = [eq(inventoryTable.tenantId, tenantId)];
  if (warehouseId) conditions.push(eq(inventoryTable.warehouseId, warehouseId));
  if (productId) conditions.push(eq(inventoryTable.productId, productId));
  if (lowStock === "true") conditions.push(lte(inventoryTable.available, inventoryTable.reorderPoint));

  const [countRow] = await db.select({ total: sql<number>`count(*)::int` }).from(inventoryTable).where(and(...conditions));
  const rows = await db
    .select({ inv: inventoryTable, productName: productsTable.name, productSku: productsTable.sku, warehouseName: warehousesTable.name })
    .from(inventoryTable)
    .leftJoin(productsTable, eq(inventoryTable.productId, productsTable.id))
    .leftJoin(warehousesTable, eq(inventoryTable.warehouseId, warehousesTable.id))
    .where(and(...conditions))
    .orderBy(sql`${inventoryTable.updatedAt} desc`)
    .limit(perPageNum).offset(offset);

  res.json({ data: rows.map(r => formatItem(r.inv, r.productName, r.productSku, r.warehouseName)), meta: { page: pageNum, perPage: perPageNum, total: countRow.total } });
});

router.post("/", async (req, res) => {
  const parse = CreateInventoryBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid input", details: parse.error.issues });
    return;
  }
  const tenantId = req.user!.tenantId;
  const d = parse.data;
  const [inv] = await db.insert(inventoryTable).values({
    tenantId, productId: d.productId, warehouseId: d.warehouseId,
    available: d.available ?? 0, reserved: d.reserved ?? 0, damaged: d.damaged ?? 0,
    returned: d.returned ?? 0, reorderPoint: d.reorderPoint ?? 0,
  }).returning();

  const [prod] = await db.select({ name: productsTable.name, sku: productsTable.sku }).from(productsTable).where(eq(productsTable.id, inv.productId)).limit(1);
  const [wh] = await db.select({ name: warehousesTable.name }).from(warehousesTable).where(eq(warehousesTable.id, inv.warehouseId)).limit(1);

  if (inv.available > 0) {
    await db.insert(inventoryTransactionsTable).values({
      tenantId, inventoryId: inv.id, type: "purchase", quantityDelta: inv.available, note: "Initial stock", referenceType: "manual", createdBy: req.user!.sub,
    });
  }

  res.status(201).json(formatItem(inv, prod?.name, prod?.sku, wh?.name));
});

router.get("/:id", async (req, res) => {
  const [row] = await db
    .select({ inv: inventoryTable, productName: productsTable.name, productSku: productsTable.sku, warehouseName: warehousesTable.name })
    .from(inventoryTable)
    .leftJoin(productsTable, eq(inventoryTable.productId, productsTable.id))
    .leftJoin(warehousesTable, eq(inventoryTable.warehouseId, warehousesTable.id))
    .where(and(eq(inventoryTable.id, req.params.id), eq(inventoryTable.tenantId, req.user!.tenantId)))
    .limit(1);

  if (!row) {
    res.status(404).json({ error: "Inventory record not found" });
    return;
  }
  res.json(formatItem(row.inv, row.productName, row.productSku, row.warehouseName));
});

router.patch("/:id", async (req, res) => {
  const parse = UpdateInventoryBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const existing = await db.select().from(inventoryTable).where(and(eq(inventoryTable.id, req.params.id), eq(inventoryTable.tenantId, req.user!.tenantId))).limit(1);
  if (!existing.length) {
    res.status(404).json({ error: "Inventory record not found" });
    return;
  }
  const d = parse.data;
  const updates: Record<string, unknown> = {};
  if (d.available !== undefined) updates.available = d.available;
  if (d.reserved !== undefined) updates.reserved = d.reserved;
  if (d.damaged !== undefined) updates.damaged = d.damaged;
  if (d.returned !== undefined) updates.returned = d.returned;
  if (d.reorderPoint !== undefined) updates.reorderPoint = d.reorderPoint;

  if (d.available !== undefined) {
    const delta = d.available - existing[0].available;
    if (delta !== 0) {
      await db.insert(inventoryTransactionsTable).values({
        tenantId: req.user!.tenantId, inventoryId: req.params.id,
        type: "adjustment", quantityDelta: delta, note: "Manual adjustment", referenceType: "manual", createdBy: req.user!.sub,
      });
    }
  }

  const [inv] = await db.update(inventoryTable).set(updates).where(eq(inventoryTable.id, req.params.id)).returning();
  const [prod] = await db.select({ name: productsTable.name, sku: productsTable.sku }).from(productsTable).where(eq(productsTable.id, inv.productId)).limit(1);
  const [wh] = await db.select({ name: warehousesTable.name }).from(warehousesTable).where(eq(warehousesTable.id, inv.warehouseId)).limit(1);
  res.json(formatItem(inv, prod?.name, prod?.sku, wh?.name));
});

router.get("/:id/transactions", async (req, res) => {
  const { page = "1", perPage = "20" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page));
  const perPageNum = Math.min(100, Math.max(1, parseInt(perPage)));
  const offset = (pageNum - 1) * perPageNum;

  const invCheck = await db.select({ id: inventoryTable.id }).from(inventoryTable).where(and(eq(inventoryTable.id, req.params.id), eq(inventoryTable.tenantId, req.user!.tenantId))).limit(1);
  if (!invCheck.length) {
    res.status(404).json({ error: "Inventory record not found" });
    return;
  }
  const [countRow] = await db.select({ total: sql<number>`count(*)::int` }).from(inventoryTransactionsTable).where(eq(inventoryTransactionsTable.inventoryId, req.params.id));
  const txs = await db.select().from(inventoryTransactionsTable).where(eq(inventoryTransactionsTable.inventoryId, req.params.id)).orderBy(sql`${inventoryTransactionsTable.createdAt} desc`).limit(perPageNum).offset(offset);

  res.json({ data: txs.map(t => ({ id: t.id, inventoryId: t.inventoryId, type: t.type, quantityDelta: t.quantityDelta, note: t.note, referenceId: t.referenceId, referenceType: t.referenceType, createdBy: t.createdBy, createdAt: t.createdAt })), meta: { page: pageNum, perPage: perPageNum, total: countRow.total } });
});

router.post("/:id/transactions", async (req, res) => {
  const parse = CreateInventoryTransactionBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid input", details: parse.error.issues });
    return;
  }
  const inv = await db.select().from(inventoryTable).where(and(eq(inventoryTable.id, req.params.id), eq(inventoryTable.tenantId, req.user!.tenantId))).limit(1);
  if (!inv.length) {
    res.status(404).json({ error: "Inventory record not found" });
    return;
  }
  const d = parse.data;
  const [tx] = await db.insert(inventoryTransactionsTable).values({
    tenantId: req.user!.tenantId, inventoryId: req.params.id, type: d.type,
    quantityDelta: d.quantityDelta, note: d.note, referenceId: d.referenceId,
    referenceType: d.referenceType, createdBy: req.user!.sub,
  }).returning();

  // Update available stock
  const newAvailable = Math.max(0, inv[0].available + d.quantityDelta);
  await db.update(inventoryTable).set({ available: newAvailable }).where(eq(inventoryTable.id, req.params.id));

  res.status(201).json({ id: tx.id, inventoryId: tx.inventoryId, type: tx.type, quantityDelta: tx.quantityDelta, note: tx.note, referenceId: tx.referenceId, referenceType: tx.referenceType, createdBy: tx.createdBy, createdAt: tx.createdAt });
});

export default router;
