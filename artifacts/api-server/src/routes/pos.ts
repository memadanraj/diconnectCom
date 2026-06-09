import { Router } from "express";
import { db, registersTable, posSalesTable, cashMovementsTable, branchesTable, customersTable } from "@workspace/db";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

function serializeRegister(r: typeof registersTable.$inferSelect) {
  return {
    id: r.id,
    branchId: r.branchId,
    name: r.name,
    status: r.status,
    openedBy: r.openedBy,
    openedAt: r.openedAt,
    openingCash: r.openingCash ? parseFloat(r.openingCash) : null,
    closedBy: r.closedBy,
    closedAt: r.closedAt,
    closingCash: r.closingCash ? parseFloat(r.closingCash) : null,
    expectedCash: r.expectedCash ? parseFloat(r.expectedCash) : null,
    cashVariance: r.cashVariance ? parseFloat(r.cashVariance) : null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function serializeSale(s: typeof posSalesTable.$inferSelect) {
  return {
    id: s.id,
    registerId: s.registerId,
    customerId: s.customerId,
    items: s.items,
    subtotal: parseFloat(s.subtotal),
    discount: parseFloat(s.discount),
    tax: parseFloat(s.tax),
    total: parseFloat(s.total),
    paymentMethod: s.paymentMethod,
    payments: s.payments,
    changeGiven: s.changeGiven ? parseFloat(s.changeGiven) : 0,
    loyaltyPointsEarned: s.loyaltyPointsEarned ?? 0,
    loyaltyPointsRedeemed: s.loyaltyPointsRedeemed ?? 0,
    notes: s.notes,
    status: s.status,
    syncedAt: s.syncedAt,
    createdAt: s.createdAt,
  };
}

/* ───────── Registers ───────── */

router.get("/registers", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { branchId } = req.query as Record<string, string>;

  const conditions = [eq(registersTable.tenantId, tenantId)];
  if (branchId) conditions.push(eq(registersTable.branchId, branchId));

  const rows = await db
    .select({ register: registersTable, branchName: branchesTable.name })
    .from(registersTable)
    .leftJoin(branchesTable, eq(registersTable.branchId, branchesTable.id))
    .where(and(...conditions))
    .orderBy(desc(registersTable.createdAt));

  res.json(rows.map((r) => ({ ...serializeRegister(r.register), branchName: r.branchName ?? null })));
});

router.post("/registers", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { branchId, name } = req.body;
  if (!branchId || !name) { res.status(400).json({ error: "branchId and name are required" }); return; }
  const [register] = await db.insert(registersTable).values({ tenantId, branchId, name }).returning();
  res.status(201).json(serializeRegister(register));
});

router.get("/registers/:id", async (req, res) => {
  const [row] = await db
    .select({ register: registersTable, branchName: branchesTable.name })
    .from(registersTable)
    .leftJoin(branchesTable, eq(registersTable.branchId, branchesTable.id))
    .where(and(eq(registersTable.id, req.params.id), eq(registersTable.tenantId, req.user!.tenantId)))
    .limit(1);
  if (!row) { res.status(404).json({ error: "Register not found" }); return; }
  res.json({ ...serializeRegister(row.register), branchName: row.branchName ?? null });
});

router.post("/registers/:id/open", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { openingCash = 0 } = req.body;
  const [existing] = await db.select().from(registersTable).where(and(eq(registersTable.id, req.params.id), eq(registersTable.tenantId, tenantId))).limit(1);
  if (!existing) { res.status(404).json({ error: "Register not found" }); return; }
  if (existing.status === "open") { res.status(400).json({ error: "Register is already open" }); return; }
  const [updated] = await db.update(registersTable).set({
    status: "open",
    openedBy: req.user!.userId,
    openedAt: new Date(),
    openingCash: String(openingCash),
    expectedCash: String(openingCash),
    closedAt: null,
    closedBy: null,
    closingCash: null,
    cashVariance: null,
  }).where(eq(registersTable.id, req.params.id)).returning();
  res.json(serializeRegister(updated));
});

router.post("/registers/:id/close", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { closingCash } = req.body;
  if (closingCash === undefined) { res.status(400).json({ error: "closingCash is required" }); return; }
  const [existing] = await db.select().from(registersTable).where(and(eq(registersTable.id, req.params.id), eq(registersTable.tenantId, tenantId))).limit(1);
  if (!existing) { res.status(404).json({ error: "Register not found" }); return; }
  if (existing.status !== "open") { res.status(400).json({ error: "Register is not open" }); return; }
  const expected = existing.expectedCash ? parseFloat(existing.expectedCash) : 0;
  const variance = parseFloat(closingCash) - expected;
  const [updated] = await db.update(registersTable).set({
    status: "closed",
    closedBy: req.user!.userId,
    closedAt: new Date(),
    closingCash: String(closingCash),
    cashVariance: String(variance),
  }).where(eq(registersTable.id, req.params.id)).returning();
  res.json(serializeRegister(updated));
});

/* ───────── POS Sales ───────── */

router.get("/sales", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { registerId, status, from, to, page = "1", perPage = "20" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page));
  const perPageNum = Math.min(100, Math.max(1, parseInt(perPage)));
  const offset = (pageNum - 1) * perPageNum;

  const conditions = [eq(posSalesTable.tenantId, tenantId)];
  if (registerId) conditions.push(eq(posSalesTable.registerId, registerId));
  if (status) conditions.push(eq(posSalesTable.status, status as "completed" | "voided" | "refunded"));
  if (from) conditions.push(gte(posSalesTable.createdAt, new Date(from)));
  if (to) conditions.push(lte(posSalesTable.createdAt, new Date(to)));

  const [countRow] = await db.select({ total: sql<number>`count(*)::int` }).from(posSalesTable).where(and(...conditions));
  const rows = await db
    .select({
      sale: posSalesTable,
      customerName: sql<string | null>`concat_ws(' ', ${customersTable.firstName}, ${customersTable.lastName})`,
      customerEmail: customersTable.email,
      registerName: registersTable.name,
    })
    .from(posSalesTable)
    .leftJoin(customersTable, eq(posSalesTable.customerId, customersTable.id))
    .leftJoin(registersTable, eq(posSalesTable.registerId, registersTable.id))
    .where(and(...conditions))
    .orderBy(desc(posSalesTable.createdAt))
    .limit(perPageNum)
    .offset(offset);

  res.json({
    data: rows.map((r) => ({ ...serializeSale(r.sale), customerName: r.customerName || null, customerEmail: r.customerEmail || null, registerName: r.registerName || null })),
    meta: { page: pageNum, perPage: perPageNum, total: countRow.total },
  });
});

router.post("/sales", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { registerId, customerId, items, subtotal, discount, tax, total, paymentMethod, payments, changeGiven, notes } = req.body;
  if (!registerId || !items || total === undefined || !paymentMethod) {
    res.status(400).json({ error: "registerId, items, total, and paymentMethod are required" }); return;
  }
  const [sale] = await db.insert(posSalesTable).values({
    tenantId, registerId,
    customerId: customerId ?? null,
    items, subtotal: String(subtotal ?? 0),
    discount: String(discount ?? 0),
    tax: String(tax ?? 0),
    total: String(total),
    paymentMethod, payments: payments ?? [],
    changeGiven: String(changeGiven ?? 0),
    notes: notes ?? null,
    syncedAt: new Date(),
  }).returning();

  // Update register expected cash if cash payment
  if (paymentMethod === "cash" || paymentMethod === "mixed") {
    const [register] = await db.select().from(registersTable).where(eq(registersTable.id, registerId)).limit(1);
    if (register?.status === "open") {
      const cashAmount = paymentMethod === "cash" ? parseFloat(total) : (payments as { method: string; amount: number }[])?.find((p) => p.method === "cash")?.amount ?? 0;
      const currentExpected = register.expectedCash ? parseFloat(register.expectedCash) : 0;
      await db.update(registersTable).set({ expectedCash: String(currentExpected + cashAmount - (changeGiven ?? 0)) }).where(eq(registersTable.id, registerId));
    }
  }

  res.status(201).json(serializeSale(sale));
});

router.get("/sales/:id", async (req, res) => {
  const [row] = await db
    .select({ sale: posSalesTable, registerName: registersTable.name, branchName: branchesTable.name })
    .from(posSalesTable)
    .leftJoin(registersTable, eq(posSalesTable.registerId, registersTable.id))
    .leftJoin(branchesTable, eq(registersTable.branchId, branchesTable.id))
    .where(and(eq(posSalesTable.id, req.params.id), eq(posSalesTable.tenantId, req.user!.tenantId)))
    .limit(1);
  if (!row) { res.status(404).json({ error: "Sale not found" }); return; }
  res.json({ ...serializeSale(row.sale), registerName: row.registerName ?? null, branchName: row.branchName ?? null });
});

router.post("/sales/:id/void", async (req, res) => {
  const [sale] = await db.select().from(posSalesTable).where(and(eq(posSalesTable.id, req.params.id), eq(posSalesTable.tenantId, req.user!.tenantId))).limit(1);
  if (!sale) { res.status(404).json({ error: "Sale not found" }); return; }
  if (sale.status !== "completed") { res.status(400).json({ error: "Only completed sales can be voided" }); return; }
  const [updated] = await db.update(posSalesTable).set({ status: "voided" }).where(eq(posSalesTable.id, req.params.id)).returning();
  res.json(serializeSale(updated));
});

/* ───────── Cash Movements ───────── */

router.post("/cash-movement", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { registerId, type, amount, reason } = req.body;
  if (!registerId || !type || amount === undefined) {
    res.status(400).json({ error: "registerId, type, and amount are required" }); return;
  }
  const [register] = await db.select().from(registersTable).where(and(eq(registersTable.id, registerId), eq(registersTable.tenantId, tenantId))).limit(1);
  if (!register) { res.status(404).json({ error: "Register not found" }); return; }
  if (register.status !== "open") { res.status(400).json({ error: "Register must be open" }); return; }

  const [movement] = await db.insert(cashMovementsTable).values({
    tenantId, registerId, type, amount: String(amount), reason: reason ?? null, performedBy: req.user!.userId,
  }).returning();

  const currentExpected = register.expectedCash ? parseFloat(register.expectedCash) : 0;
  const delta = type === "in" ? parseFloat(amount) : -parseFloat(amount);
  await db.update(registersTable).set({ expectedCash: String(currentExpected + delta) }).where(eq(registersTable.id, registerId));

  res.status(201).json({ id: movement.id, registerId: movement.registerId, type: movement.type, amount: parseFloat(movement.amount), reason: movement.reason, createdAt: movement.createdAt });
});

router.get("/cash-movement", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { registerId } = req.query as Record<string, string>;
  if (!registerId) { res.status(400).json({ error: "registerId is required" }); return; }
  const rows = await db.select().from(cashMovementsTable).where(and(eq(cashMovementsTable.tenantId, tenantId), eq(cashMovementsTable.registerId, registerId))).orderBy(desc(cashMovementsTable.createdAt));
  res.json(rows.map((m) => ({ id: m.id, registerId: m.registerId, type: m.type, amount: parseFloat(m.amount), reason: m.reason, createdAt: m.createdAt })));
});

/* ───────── Analytics ───────── */

router.get("/stats", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const [totalSales] = await db.select({ count: sql<number>`count(*)::int`, revenue: sql<number>`coalesce(sum(total::numeric), 0)::float` }).from(posSalesTable).where(and(eq(posSalesTable.tenantId, tenantId), eq(posSalesTable.status, "completed")));
  const [openRegisters] = await db.select({ count: sql<number>`count(*)::int` }).from(registersTable).where(and(eq(registersTable.tenantId, tenantId), eq(registersTable.status, "open")));
  res.json({ totalSales: totalSales.count, totalRevenue: totalSales.revenue, openRegisters: openRegisters.count });
});

export default router;
