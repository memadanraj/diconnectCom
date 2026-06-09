import { Router } from "express";
import { db, ordersTable, orderItemsTable, productsTable, discountsTable, discountUsagesTable } from "@workspace/db";
import { eq, and, ilike, or, sql, desc, inArray } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { CreateOrderBody, UpdateOrderStatusBody } from "@workspace/api-zod";

const router = Router();
router.use(requireAuth);

function generateOrderNumber() {
  const now = new Date();
  return `ORD-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function serializeOrder(o: typeof ordersTable.$inferSelect, itemCount = 0) {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    customerId: null,
    customerName: o.customerName,
    customerEmail: o.customerEmail,
    subtotal: parseFloat(o.subtotal),
    discount: parseFloat(o.discount),
    shippingFee: parseFloat(o.shippingFee),
    tax: parseFloat(o.tax),
    total: parseFloat(o.total),
    currency: o.currency,
    notes: o.notes,
    itemCount,
    createdAt: o.createdAt,
  };
}

router.get("/", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { status, search, page = "1", perPage = "20" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page));
  const perPageNum = Math.min(100, Math.max(1, parseInt(perPage)));
  const offset = (pageNum - 1) * perPageNum;

  const conditions = [eq(ordersTable.tenantId, tenantId)];
  if (status) conditions.push(eq(ordersTable.status, status));
  if (search) conditions.push(or(ilike(ordersTable.orderNumber, `%${search}%`), ilike(ordersTable.customerName ?? sql`''`, `%${search}%`), ilike(ordersTable.customerEmail ?? sql`''`, `%${search}%`))!);

  const [countRow] = await db.select({ total: sql<number>`count(*)::int` }).from(ordersTable).where(and(...conditions));
  const rows = await db.select().from(ordersTable).where(and(...conditions)).orderBy(desc(ordersTable.createdAt)).limit(perPageNum).offset(offset);

  const orderIds = rows.map((o) => o.id);
  const itemCounts = orderIds.length
    ? await db.select({ orderId: orderItemsTable.orderId, count: sql<number>`count(*)::int` }).from(orderItemsTable).where(inArray(orderItemsTable.orderId, orderIds)).groupBy(orderItemsTable.orderId)
    : [];
  const countMap = new Map(itemCounts.map((c) => [c.orderId, c.count]));

  res.json({
    data: rows.map((o) => serializeOrder(o, countMap.get(o.id) ?? 0)),
    meta: { page: pageNum, perPage: perPageNum, total: countRow.total },
  });
});

router.post("/", async (req, res) => {
  const parse = CreateOrderBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid input", details: parse.error.issues });
    return;
  }
  const d = parse.data;
  const tenantId = req.user!.tenantId;

  const subtotal = d.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const shippingFee = d.shippingFee ?? 0;
  const tax = 0;
  let discount = d.discount ?? 0;
  let appliedDiscountId: string | null = null;

  if ((d as any).discountCode) {
    const code = String((d as any).discountCode).toUpperCase().trim();
    const [disc] = await db
      .select()
      .from(discountsTable)
      .where(and(eq(discountsTable.tenantId, tenantId), eq(discountsTable.code, code)))
      .limit(1);

    if (disc && disc.isActive) {
      const now = new Date();
      const notStarted = disc.startsAt && disc.startsAt > now;
      const expired = disc.expiresAt && disc.expiresAt < now;
      const limitReached = disc.usageLimit !== null && disc.usageCount >= disc.usageLimit;
      const belowMin = disc.minOrderAmount && subtotal < parseFloat(disc.minOrderAmount);

      if (!notStarted && !expired && !limitReached && !belowMin) {
        if (disc.type === "percentage") {
          discount = (subtotal * parseFloat(disc.value)) / 100;
        } else if (disc.type === "fixed") {
          discount = parseFloat(disc.value);
        }
        if (disc.maxDiscountAmount) {
          discount = Math.min(discount, parseFloat(disc.maxDiscountAmount));
        }
        discount = Math.min(discount, subtotal);
        appliedDiscountId = disc.id;
      }
    }
  }

  const total = subtotal - discount + shippingFee + tax;

  const [order] = await db.insert(ordersTable).values({
    tenantId,
    orderNumber: generateOrderNumber(),
    status: "pending",
    customerName: d.customerName,
    customerEmail: d.customerEmail,
    customerPhone: d.customerPhone,
    shippingAddress: d.shippingAddress,
    subtotal: String(subtotal),
    discount: String(discount),
    shippingFee: String(shippingFee),
    tax: String(tax),
    total: String(total),
    currency: d.currency ?? "NPR",
    notes: d.notes,
  }).returning();

  if (appliedDiscountId) {
    await db.insert(discountUsagesTable).values({
      tenantId,
      discountId: appliedDiscountId,
      orderId: order.id,
      discountAmount: String(discount),
    });
    await db
      .update(discountsTable)
      .set({ usageCount: sql`${discountsTable.usageCount} + 1` })
      .where(eq(discountsTable.id, appliedDiscountId));
  }

  for (const item of d.items) {
    const [product] = await db.select({ name: productsTable.name, sku: productsTable.sku, imageUrl: productsTable.imageUrl }).from(productsTable).where(eq(productsTable.id, item.productId)).limit(1);
    await db.insert(orderItemsTable).values({
      orderId: order.id,
      productId: item.productId,
      productName: product?.name ?? "Unknown Product",
      sku: product?.sku,
      imageUrl: product?.imageUrl,
      quantity: item.quantity,
      unitPrice: String(item.unitPrice),
      totalPrice: String(item.unitPrice * item.quantity),
    });
  }

  res.status(201).json(serializeOrder(order, d.items.length));
});

router.get("/:id", async (req, res) => {
  const [order] = await db.select().from(ordersTable).where(and(eq(ordersTable.id, req.params.id), eq(ordersTable.tenantId, req.user!.tenantId))).limit(1);
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));

  res.json({
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    customerId: null,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    shippingAddress: order.shippingAddress,
    subtotal: parseFloat(order.subtotal),
    discount: parseFloat(order.discount),
    shippingFee: parseFloat(order.shippingFee),
    tax: parseFloat(order.tax),
    total: parseFloat(order.total),
    currency: order.currency,
    notes: order.notes,
    items: items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: i.productName,
      sku: i.sku,
      imageUrl: i.imageUrl,
      quantity: i.quantity,
      unitPrice: parseFloat(i.unitPrice),
      totalPrice: parseFloat(i.totalPrice),
    })),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  });
});

router.patch("/:id/status", async (req, res) => {
  const parse = UpdateOrderStatusBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const [existing] = await db.select().from(ordersTable).where(and(eq(ordersTable.id, req.params.id), eq(ordersTable.tenantId, req.user!.tenantId))).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  const updates: Record<string, unknown> = { status: parse.data.status };
  if (parse.data.notes) updates.notes = parse.data.notes;
  const [updated] = await db.update(ordersTable).set(updates).where(eq(ordersTable.id, req.params.id)).returning();
  const [cntRow] = await db.select({ count: sql<number>`count(*)::int` }).from(orderItemsTable).where(eq(orderItemsTable.orderId, updated.id));
  res.json(serializeOrder(updated, cntRow?.count ?? 0));
});

export default router;
