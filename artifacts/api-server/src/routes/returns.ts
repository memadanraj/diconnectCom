import { Router } from "express";
import { db, returnsTable, returnItemsTable, ordersTable } from "@workspace/db";
import { eq, and, ilike, or, sql, desc, inArray } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

function generateReturnNumber() {
  const now = new Date();
  return `RET-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function serializeReturn(r: typeof returnsTable.$inferSelect, itemCount = 0) {
  return {
    id: r.id,
    returnNumber: r.returnNumber,
    orderId: r.orderId,
    orderNumber: r.orderNumber,
    customerName: r.customerName,
    customerEmail: r.customerEmail,
    status: r.status,
    reason: r.reason,
    notes: r.notes,
    refundAmount: parseFloat(r.refundAmount),
    refundMethod: r.refundMethod,
    itemCount,
    createdAt: r.createdAt,
  };
}

function serializeItem(i: typeof returnItemsTable.$inferSelect) {
  return {
    id: i.id,
    returnId: i.returnId,
    orderItemId: i.orderItemId,
    productId: i.productId,
    productName: i.productName,
    sku: i.sku,
    quantity: i.quantity,
    unitPrice: parseFloat(i.unitPrice),
    reason: i.reason,
    condition: i.condition,
  };
}

router.get("/", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { search, status, page = "1", perPage = "20" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page));
  const perPageNum = Math.min(100, Math.max(1, parseInt(perPage)));
  const offset = (pageNum - 1) * perPageNum;

  const conditions = [eq(returnsTable.tenantId, tenantId)];
  if (status) conditions.push(eq(returnsTable.status, status as typeof returnsTable.$inferSelect["status"]));
  if (search) {
    conditions.push(
      or(
        ilike(returnsTable.returnNumber, `%${search}%`),
        ilike(returnsTable.orderNumber ?? sql`''`, `%${search}%`),
        ilike(returnsTable.customerName ?? sql`''`, `%${search}%`),
        ilike(returnsTable.customerEmail ?? sql`''`, `%${search}%`),
      )!
    );
  }

  const [countRow] = await db.select({ total: sql<number>`count(*)::int` }).from(returnsTable).where(and(...conditions));
  const rows = await db.select().from(returnsTable).where(and(...conditions)).orderBy(desc(returnsTable.createdAt)).limit(perPageNum).offset(offset);

  const returnIds = rows.map((r) => r.id);
  const itemCounts = returnIds.length
    ? await db.select({ returnId: returnItemsTable.returnId, count: sql<number>`count(*)::int` }).from(returnItemsTable).where(inArray(returnItemsTable.returnId, returnIds)).groupBy(returnItemsTable.returnId)
    : [];
  const countMap = new Map(itemCounts.map((c) => [c.returnId, c.count]));

  res.json({ data: rows.map((r) => serializeReturn(r, countMap.get(r.id) ?? 0)), meta: { page: pageNum, perPage: perPageNum, total: countRow.total } });
});

router.post("/", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const d = req.body as {
    orderId: string;
    reason: typeof returnsTable.$inferSelect["reason"];
    notes?: string;
    refundAmount?: number;
    refundMethod?: typeof returnsTable.$inferSelect["refundMethod"];
    items: Array<{
      orderItemId?: string;
      productId?: string;
      productName: string;
      sku?: string;
      quantity: number;
      unitPrice: number;
      reason?: string;
      condition?: "unopened" | "opened" | "damaged";
    }>;
  };

  if (!d.orderId || !d.reason || !d.items?.length) {
    res.status(400).json({ error: "orderId, reason, and items are required" });
    return;
  }

  const [order] = await db.select({ id: ordersTable.id, orderNumber: ordersTable.orderNumber, customerName: ordersTable.customerName, customerEmail: ordersTable.customerEmail })
    .from(ordersTable)
    .where(and(eq(ordersTable.id, d.orderId), eq(ordersTable.tenantId, tenantId)))
    .limit(1);

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  const refundAmount = d.refundAmount ?? d.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  const [ret] = await db.insert(returnsTable).values({
    tenantId,
    returnNumber: generateReturnNumber(),
    orderId: d.orderId,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    reason: d.reason,
    notes: d.notes ?? null,
    refundAmount: String(refundAmount),
    refundMethod: d.refundMethod ?? null,
  }).returning();

  const items = await db.insert(returnItemsTable).values(
    d.items.map((item) => ({
      returnId: ret.id,
      orderItemId: item.orderItemId ?? null,
      productId: item.productId ?? null,
      productName: item.productName,
      sku: item.sku ?? null,
      quantity: item.quantity,
      unitPrice: String(item.unitPrice),
      reason: item.reason ?? null,
      condition: item.condition ?? null,
    }))
  ).returning();

  res.status(201).json({ ...serializeReturn(ret, items.length), items: items.map(serializeItem) });
});

router.get("/:id", async (req, res) => {
  const [ret] = await db.select().from(returnsTable).where(and(eq(returnsTable.id, req.params.id), eq(returnsTable.tenantId, req.user!.tenantId))).limit(1);
  if (!ret) {
    res.status(404).json({ error: "Return not found" });
    return;
  }
  const items = await db.select().from(returnItemsTable).where(eq(returnItemsTable.returnId, ret.id));
  res.json({ ...serializeReturn(ret, items.length), items: items.map(serializeItem), updatedAt: ret.updatedAt });
});

router.patch("/:id/status", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const [existing] = await db.select().from(returnsTable).where(and(eq(returnsTable.id, req.params.id), eq(returnsTable.tenantId, tenantId))).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Return not found" });
    return;
  }
  const d = req.body as { status: typeof returnsTable.$inferSelect["status"]; notes?: string; refundAmount?: number; refundMethod?: typeof returnsTable.$inferSelect["refundMethod"] };
  if (!d.status) {
    res.status(400).json({ error: "status is required" });
    return;
  }
  const updates: Record<string, unknown> = { status: d.status };
  if (d.notes !== undefined) updates.notes = d.notes;
  if (d.refundAmount !== undefined) updates.refundAmount = String(d.refundAmount);
  if (d.refundMethod !== undefined) updates.refundMethod = d.refundMethod;

  const [updated] = await db.update(returnsTable).set(updates).where(eq(returnsTable.id, req.params.id)).returning();
  const items = await db.select().from(returnItemsTable).where(eq(returnItemsTable.returnId, updated.id));
  res.json({ ...serializeReturn(updated, items.length), items: items.map(serializeItem), updatedAt: updated.updatedAt });
});

export default router;
