import { Router } from "express";
import { db, ordersTable, productsTable, orderItemsTable, customersTable } from "@workspace/db";
import { eq, and, gte, sql, desc, inArray } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

router.get("/stats", async (req, res) => {
  const tenantId = req.user!.tenantId;

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const [totalRevenueRow] = await db.select({ val: sql<string>`coalesce(sum(total), 0)` }).from(ordersTable).where(and(eq(ordersTable.tenantId, tenantId), sql`status NOT IN ('cancelled', 'refunded')`));
  const [thisMonthRevenueRow] = await db.select({ val: sql<string>`coalesce(sum(total), 0)` }).from(ordersTable).where(and(eq(ordersTable.tenantId, tenantId), gte(ordersTable.createdAt, thisMonthStart), sql`status NOT IN ('cancelled', 'refunded')`));
  const [lastMonthRevenueRow] = await db.select({ val: sql<string>`coalesce(sum(total), 0)` }).from(ordersTable).where(and(eq(ordersTable.tenantId, tenantId), gte(ordersTable.createdAt, lastMonthStart), sql`created_at <= ${lastMonthEnd}`, sql`status NOT IN ('cancelled', 'refunded')`));

  const [totalOrdersRow] = await db.select({ val: sql<number>`count(*)::int` }).from(ordersTable).where(eq(ordersTable.tenantId, tenantId));
  const [thisMonthOrdersRow] = await db.select({ val: sql<number>`count(*)::int` }).from(ordersTable).where(and(eq(ordersTable.tenantId, tenantId), gte(ordersTable.createdAt, thisMonthStart)));
  const [lastMonthOrdersRow] = await db.select({ val: sql<number>`count(*)::int` }).from(ordersTable).where(and(eq(ordersTable.tenantId, tenantId), gte(ordersTable.createdAt, lastMonthStart), sql`created_at <= ${lastMonthEnd}`));

  const [totalProductsRow] = await db.select({ val: sql<number>`count(*)::int` }).from(productsTable).where(eq(productsTable.tenantId, tenantId));
  const [activeProductsRow] = await db.select({ val: sql<number>`count(*)::int` }).from(productsTable).where(and(eq(productsTable.tenantId, tenantId), eq(productsTable.status, "active")));
  const [pendingOrdersRow] = await db.select({ val: sql<number>`count(*)::int` }).from(ordersTable).where(and(eq(ordersTable.tenantId, tenantId), sql`status IN ('pending', 'confirmed')`));
  const [totalCustomersRow] = await db.select({ val: sql<number>`count(*)::int` }).from(customersTable).where(eq(customersTable.tenantId, tenantId));

  const thisRevenue = parseFloat(thisMonthRevenueRow.val);
  const lastRevenue = parseFloat(lastMonthRevenueRow.val);
  const revenueGrowth = lastRevenue > 0 ? ((thisRevenue - lastRevenue) / lastRevenue) * 100 : 0;

  const thisOrders = thisMonthOrdersRow.val;
  const lastOrders = lastMonthOrdersRow.val;
  const ordersGrowth = lastOrders > 0 ? ((thisOrders - lastOrders) / lastOrders) * 100 : 0;

  res.json({
    totalRevenue: parseFloat(totalRevenueRow.val),
    totalOrders: totalOrdersRow.val,
    totalProducts: totalProductsRow.val,
    totalCustomers: totalCustomersRow.val,
    revenueGrowth: Math.round(revenueGrowth * 10) / 10,
    ordersGrowth: Math.round(ordersGrowth * 10) / 10,
    pendingOrders: pendingOrdersRow.val,
    activeProducts: activeProductsRow.val,
  });
});

router.get("/recent-orders", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const limit = Math.min(50, parseInt((req.query.limit as string) ?? "10"));

  const rows = await db.select().from(ordersTable).where(eq(ordersTable.tenantId, tenantId)).orderBy(desc(ordersTable.createdAt)).limit(limit);

  const orderIds = rows.map((o) => o.id);
  const itemCounts = orderIds.length
    ? await db.select({ orderId: orderItemsTable.orderId, count: sql<number>`count(*)::int` }).from(orderItemsTable).where(inArray(orderItemsTable.orderId, orderIds)).groupBy(orderItemsTable.orderId)
    : [];
  const countMap = new Map(itemCounts.map((c) => [c.orderId, c.count]));

  res.json(rows.map((o) => ({
    id: o.id, orderNumber: o.orderNumber, status: o.status, customerId: null,
    customerName: o.customerName, customerEmail: o.customerEmail,
    subtotal: parseFloat(o.subtotal), discount: parseFloat(o.discount),
    shippingFee: parseFloat(o.shippingFee), tax: parseFloat(o.tax),
    total: parseFloat(o.total), currency: o.currency, notes: o.notes,
    itemCount: countMap.get(o.id) ?? 0, createdAt: o.createdAt,
  })));
});

router.get("/revenue-chart", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const rows = await db
    .select({
      date: sql<string>`to_char(created_at, 'YYYY-MM-DD')`,
      revenue: sql<string>`coalesce(sum(total), 0)`,
      orders: sql<number>`count(*)::int`,
    })
    .from(ordersTable)
    .where(and(eq(ordersTable.tenantId, tenantId), gte(ordersTable.createdAt, thirtyDaysAgo), sql`status NOT IN ('cancelled', 'refunded')`))
    .groupBy(sql`to_char(created_at, 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(created_at, 'YYYY-MM-DD')`);

  const dataMap = new Map(rows.map((r) => [r.date, { revenue: parseFloat(r.revenue), orders: r.orders }]));

  const result = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const entry = dataMap.get(dateStr);
    result.push({ date: dateStr, revenue: entry?.revenue ?? 0, orders: entry?.orders ?? 0 });
  }

  res.json(result);
});

router.get("/orders-by-status", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const rows = await db
    .select({ status: ordersTable.status, count: sql<number>`count(*)::int` })
    .from(ordersTable)
    .where(eq(ordersTable.tenantId, tenantId))
    .groupBy(ordersTable.status);
  res.json(rows.map((r) => ({ status: r.status, count: r.count })));
});

router.get("/top-products", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const limit = Math.min(20, parseInt((req.query.limit as string) ?? "5"));

  const rows = await db
    .select({
      productId: orderItemsTable.productId,
      productName: orderItemsTable.productName,
      imageUrl: orderItemsTable.imageUrl,
      totalSold: sql<number>`sum(${orderItemsTable.quantity})::int`,
      totalRevenue: sql<string>`sum(${orderItemsTable.totalPrice})`,
    })
    .from(orderItemsTable)
    .innerJoin(ordersTable, and(eq(orderItemsTable.orderId, ordersTable.id), eq(ordersTable.tenantId, tenantId), sql`${ordersTable.status} NOT IN ('cancelled', 'refunded')`))
    .groupBy(orderItemsTable.productId, orderItemsTable.productName, orderItemsTable.imageUrl)
    .orderBy(sql`sum(${orderItemsTable.quantity}) desc`)
    .limit(limit);

  res.json(rows.map((r) => ({
    id: r.productId,
    name: r.productName,
    imageUrl: r.imageUrl,
    totalSold: r.totalSold,
    totalRevenue: parseFloat(r.totalRevenue),
  })));
});

export default router;
