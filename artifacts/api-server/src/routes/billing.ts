import { Router } from "express";
import { db, plansTable, subscriptionsTable, invoicesTable, usageRecordsTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

function serializePlan(p: typeof plansTable.$inferSelect) {
  return {
    id: p.id,
    name: p.name,
    displayName: p.displayName,
    priceMonthly: parseFloat(p.priceMonthly),
    txnFeePct: parseFloat(p.txnFeePct),
    limits: p.limits,
    isActive: p.isActive,
  };
}

function serializeSubscription(s: typeof subscriptionsTable.$inferSelect) {
  return {
    id: s.id,
    tenantId: s.tenantId,
    planId: s.planId,
    status: s.status,
    billingDate: s.billingDate,
    trialEndsAt: s.trialEndsAt,
    currentPeriodStart: s.currentPeriodStart,
    currentPeriodEnd: s.currentPeriodEnd,
    cancelledAt: s.cancelledAt,
    createdAt: s.createdAt,
  };
}

function serializeInvoice(i: typeof invoicesTable.$inferSelect) {
  return {
    id: i.id,
    subscriptionId: i.subscriptionId,
    periodStart: i.periodStart,
    periodEnd: i.periodEnd,
    subtotal: parseFloat(i.subtotal),
    tax: parseFloat(i.tax),
    total: parseFloat(i.total),
    status: i.status,
    paidAt: i.paidAt,
    dueDate: i.dueDate,
    lineItems: i.lineItems,
    createdAt: i.createdAt,
  };
}

/* ───────── Plans ───────── */

router.get("/plans", async (_req, res) => {
  const plans = await db.select().from(plansTable).where(eq(plansTable.isActive, true)).orderBy(plansTable.priceMonthly);
  res.json(plans.map(serializePlan));
});

/* ───────── Subscription ───────── */

router.get("/subscription", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const [row] = await db
    .select({ subscription: subscriptionsTable, plan: plansTable })
    .from(subscriptionsTable)
    .leftJoin(plansTable, eq(subscriptionsTable.planId, plansTable.id))
    .where(eq(subscriptionsTable.tenantId, tenantId))
    .orderBy(desc(subscriptionsTable.createdAt))
    .limit(1);

  if (!row) {
    res.json(null); return;
  }
  res.json({ ...serializeSubscription(row.subscription), plan: row.plan ? serializePlan(row.plan) : null });
});

router.post("/subscription", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { planId } = req.body;
  if (!planId) { res.status(400).json({ error: "planId is required" }); return; }

  const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, planId)).limit(1);
  if (!plan) { res.status(404).json({ error: "Plan not found" }); return; }

  // Cancel existing subscriptions
  await db.update(subscriptionsTable).set({ status: "cancelled", cancelledAt: new Date() }).where(and(eq(subscriptionsTable.tenantId, tenantId), eq(subscriptionsTable.status, "active")));

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const [subscription] = await db.insert(subscriptionsTable).values({
    tenantId, planId,
    status: "active",
    billingDate: now.getDate(),
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
  }).returning();

  res.status(201).json({ ...serializeSubscription(subscription), plan: serializePlan(plan) });
});

router.post("/subscription/cancel", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const [sub] = await db.select().from(subscriptionsTable).where(and(eq(subscriptionsTable.tenantId, tenantId), eq(subscriptionsTable.status, "active"))).limit(1);
  if (!sub) { res.status(404).json({ error: "No active subscription found" }); return; }
  const [updated] = await db.update(subscriptionsTable).set({ status: "cancelled", cancelledAt: new Date() }).where(eq(subscriptionsTable.id, sub.id)).returning();
  res.json(serializeSubscription(updated));
});

/* ───────── Invoices ───────── */

router.get("/invoices", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { page = "1", perPage = "20" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page));
  const perPageNum = Math.min(100, Math.max(1, parseInt(perPage)));
  const offset = (pageNum - 1) * perPageNum;

  const [countRow] = await db.select({ total: sql<number>`count(*)::int` }).from(invoicesTable).where(eq(invoicesTable.tenantId, tenantId));
  const rows = await db.select().from(invoicesTable).where(eq(invoicesTable.tenantId, tenantId)).orderBy(desc(invoicesTable.createdAt)).limit(perPageNum).offset(offset);
  res.json({ data: rows.map(serializeInvoice), meta: { page: pageNum, perPage: perPageNum, total: countRow.total } });
});

router.post("/invoices", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { subscriptionId, subtotal, tax, dueDate, lineItems } = req.body;
  if (!subscriptionId || subtotal === undefined) { res.status(400).json({ error: "subscriptionId and subtotal are required" }); return; }

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);
  const total = parseFloat(subtotal) + parseFloat(tax ?? 0);

  const [invoice] = await db.insert(invoicesTable).values({
    tenantId, subscriptionId,
    periodStart: now,
    periodEnd,
    subtotal: String(subtotal),
    tax: String(tax ?? 0),
    total: String(total),
    dueDate: dueDate ? new Date(dueDate) : periodEnd,
    lineItems: lineItems ?? [],
  }).returning();

  res.status(201).json(serializeInvoice(invoice));
});

router.patch("/invoices/:id/pay", async (req, res) => {
  const [invoice] = await db.select().from(invoicesTable).where(and(eq(invoicesTable.id, req.params.id), eq(invoicesTable.tenantId, req.user!.tenantId))).limit(1);
  if (!invoice) { res.status(404).json({ error: "Invoice not found" }); return; }
  const [updated] = await db.update(invoicesTable).set({ status: "paid", paidAt: new Date() }).where(eq(invoicesTable.id, req.params.id)).returning();
  res.json(serializeInvoice(updated));
});

/* ───────── Usage ───────── */

router.get("/usage", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const rows = await db.select().from(usageRecordsTable).where(eq(usageRecordsTable.tenantId, tenantId)).orderBy(desc(usageRecordsTable.recordedAt)).limit(100);
  res.json(rows.map((u) => ({ id: u.id, type: u.type, quantity: parseFloat(u.quantity), unitPrice: parseFloat(u.unitPrice), referenceId: u.referenceId, recordedAt: u.recordedAt })));
});

export default router;
