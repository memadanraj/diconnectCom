import { Router } from "express";
import { db, loyaltyAccountsTable, loyaltyTransactionsTable, customersTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

function calcTier(lifetimePoints: number): "bronze" | "silver" | "gold" | "platinum" {
  if (lifetimePoints >= 20000) return "platinum";
  if (lifetimePoints >= 5000) return "gold";
  if (lifetimePoints >= 1000) return "silver";
  return "bronze";
}

function serializeAccount(a: typeof loyaltyAccountsTable.$inferSelect) {
  return {
    id: a.id,
    customerId: a.customerId,
    points: a.points,
    lifetimePoints: a.lifetimePoints,
    tier: a.tier,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

router.get("/", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { page = "1", perPage = "20" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page));
  const perPageNum = Math.min(100, Math.max(1, parseInt(perPage)));
  const offset = (pageNum - 1) * perPageNum;

  const [countRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(loyaltyAccountsTable)
    .where(eq(loyaltyAccountsTable.tenantId, tenantId));

  const rows = await db
    .select({
      account: loyaltyAccountsTable,
      customerEmail: customersTable.email,
      customerFirstName: customersTable.firstName,
      customerLastName: customersTable.lastName,
    })
    .from(loyaltyAccountsTable)
    .leftJoin(customersTable, eq(loyaltyAccountsTable.customerId, customersTable.id))
    .where(eq(loyaltyAccountsTable.tenantId, tenantId))
    .orderBy(desc(loyaltyAccountsTable.lifetimePoints))
    .limit(perPageNum)
    .offset(offset);

  res.json({
    data: rows.map((r) => ({
      ...serializeAccount(r.account),
      customerEmail: r.customerEmail,
      customerName: [r.customerFirstName, r.customerLastName].filter(Boolean).join(" ") || r.customerEmail,
    })),
    meta: { page: pageNum, perPage: perPageNum, total: countRow.total },
  });
});

router.get("/:customerId", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { customerId } = req.params;

  let [account] = await db
    .select()
    .from(loyaltyAccountsTable)
    .where(and(eq(loyaltyAccountsTable.tenantId, tenantId), eq(loyaltyAccountsTable.customerId, customerId)))
    .limit(1);

  if (!account) {
    const [customer] = await db
      .select({ id: customersTable.id })
      .from(customersTable)
      .where(and(eq(customersTable.tenantId, tenantId), eq(customersTable.id, customerId)))
      .limit(1);
    if (!customer) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }
    [account] = await db
      .insert(loyaltyAccountsTable)
      .values({ tenantId, customerId, points: 0, lifetimePoints: 0, tier: "bronze" })
      .returning();
  }

  const transactions = await db
    .select()
    .from(loyaltyTransactionsTable)
    .where(and(eq(loyaltyTransactionsTable.tenantId, tenantId), eq(loyaltyTransactionsTable.customerId, customerId)))
    .orderBy(desc(loyaltyTransactionsTable.createdAt))
    .limit(20);

  res.json({ ...serializeAccount(account), transactions });
});

router.post("/:customerId/adjust", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { customerId } = req.params;
  const { type, points, note } = req.body as { type: "earn" | "redeem" | "expire" | "adjust"; points: number; note?: string };

  if (!type || points === undefined) {
    res.status(400).json({ error: "type and points are required" });
    return;
  }

  let [account] = await db
    .select()
    .from(loyaltyAccountsTable)
    .where(and(eq(loyaltyAccountsTable.tenantId, tenantId), eq(loyaltyAccountsTable.customerId, customerId)))
    .limit(1);

  if (!account) {
    [account] = await db
      .insert(loyaltyAccountsTable)
      .values({ tenantId, customerId, points: 0, lifetimePoints: 0, tier: "bronze" })
      .returning();
  }

  const delta = type === "redeem" || type === "expire" ? -Math.abs(points) : Math.abs(points);
  const newPoints = Math.max(0, account.points + delta);
  const newLifetime = type === "earn" ? account.lifetimePoints + Math.abs(points) : account.lifetimePoints;
  const newTier = calcTier(newLifetime);

  const [updated] = await db
    .update(loyaltyAccountsTable)
    .set({ points: newPoints, lifetimePoints: newLifetime, tier: newTier })
    .where(eq(loyaltyAccountsTable.id, account.id))
    .returning();

  await db.insert(loyaltyTransactionsTable).values({
    tenantId,
    customerId,
    type,
    points: delta,
    note: note ?? null,
  });

  res.json(serializeAccount(updated));
});

export default router;
