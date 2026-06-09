import { Router } from "express";
import { db, discountsTable, discountUsagesTable } from "@workspace/db";
import { eq, and, ilike, sql, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

function serializeDiscount(d: typeof discountsTable.$inferSelect) {
  return {
    id: d.id,
    code: d.code,
    description: d.description,
    type: d.type,
    value: parseFloat(d.value),
    minOrderAmount: d.minOrderAmount ? parseFloat(d.minOrderAmount) : null,
    maxDiscountAmount: d.maxDiscountAmount ? parseFloat(d.maxDiscountAmount) : null,
    usageLimit: d.usageLimit,
    usageCount: d.usageCount,
    isActive: d.isActive,
    startsAt: d.startsAt,
    expiresAt: d.expiresAt,
    createdAt: d.createdAt,
  };
}

router.get("/", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { search, isActive, page = "1", perPage = "20" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page));
  const perPageNum = Math.min(100, Math.max(1, parseInt(perPage)));
  const offset = (pageNum - 1) * perPageNum;

  const conditions = [eq(discountsTable.tenantId, tenantId)];
  if (search) conditions.push(ilike(discountsTable.code, `%${search}%`));
  if (isActive !== undefined) conditions.push(eq(discountsTable.isActive, isActive === "true"));

  const [countRow] = await db.select({ total: sql<number>`count(*)::int` }).from(discountsTable).where(and(...conditions));
  const rows = await db.select().from(discountsTable).where(and(...conditions)).orderBy(desc(discountsTable.createdAt)).limit(perPageNum).offset(offset);

  res.json({ data: rows.map(serializeDiscount), meta: { page: pageNum, perPage: perPageNum, total: countRow.total } });
});

router.post("/", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const d = req.body;
  if (!d.code || !d.type || d.value === undefined) {
    res.status(400).json({ error: "code, type, and value are required" });
    return;
  }
  const upper = String(d.code).toUpperCase().trim();
  const existing = await db.select({ id: discountsTable.id }).from(discountsTable).where(and(eq(discountsTable.tenantId, tenantId), eq(discountsTable.code, upper))).limit(1);
  if (existing.length) {
    res.status(409).json({ error: "Discount code already exists" });
    return;
  }
  const [discount] = await db.insert(discountsTable).values({
    tenantId,
    code: upper,
    description: d.description ?? null,
    type: d.type,
    value: String(d.value),
    minOrderAmount: d.minOrderAmount != null ? String(d.minOrderAmount) : null,
    maxDiscountAmount: d.maxDiscountAmount != null ? String(d.maxDiscountAmount) : null,
    usageLimit: d.usageLimit ?? null,
    isActive: d.isActive !== false,
    startsAt: d.startsAt ? new Date(d.startsAt) : null,
    expiresAt: d.expiresAt ? new Date(d.expiresAt) : null,
  }).returning();
  res.status(201).json(serializeDiscount(discount));
});

router.post("/validate", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { code, orderAmount } = req.body as { code: string; orderAmount?: number };
  if (!code) {
    res.status(400).json({ error: "code is required" });
    return;
  }
  const [discount] = await db.select().from(discountsTable).where(and(eq(discountsTable.tenantId, tenantId), eq(discountsTable.code, code.toUpperCase().trim()))).limit(1);

  if (!discount) {
    res.json({ valid: false, message: "Discount code not found" });
    return;
  }
  if (!discount.isActive) {
    res.json({ valid: false, message: "Discount code is inactive" });
    return;
  }
  const now = new Date();
  if (discount.startsAt && discount.startsAt > now) {
    res.json({ valid: false, message: "Discount code is not active yet" });
    return;
  }
  if (discount.expiresAt && discount.expiresAt < now) {
    res.json({ valid: false, message: "Discount code has expired" });
    return;
  }
  if (discount.usageLimit !== null && discount.usageCount >= discount.usageLimit) {
    res.json({ valid: false, message: "Discount code usage limit reached" });
    return;
  }
  if (discount.minOrderAmount && orderAmount !== undefined && orderAmount < parseFloat(discount.minOrderAmount)) {
    res.json({ valid: false, message: `Minimum order amount is ${discount.minOrderAmount}` });
    return;
  }

  let discountAmount = 0;
  if (orderAmount !== undefined) {
    if (discount.type === "percentage") {
      discountAmount = (orderAmount * parseFloat(discount.value)) / 100;
    } else if (discount.type === "fixed") {
      discountAmount = parseFloat(discount.value);
    }
    if (discount.maxDiscountAmount) {
      discountAmount = Math.min(discountAmount, parseFloat(discount.maxDiscountAmount));
    }
    discountAmount = Math.min(discountAmount, orderAmount);
  }

  res.json({ valid: true, discount: serializeDiscount(discount), discountAmount });
});

router.get("/:id", async (req, res) => {
  const [discount] = await db.select().from(discountsTable).where(and(eq(discountsTable.id, req.params.id), eq(discountsTable.tenantId, req.user!.tenantId))).limit(1);
  if (!discount) {
    res.status(404).json({ error: "Discount not found" });
    return;
  }
  res.json(serializeDiscount(discount));
});

router.patch("/:id", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const existing = await db.select({ id: discountsTable.id }).from(discountsTable).where(and(eq(discountsTable.id, req.params.id), eq(discountsTable.tenantId, tenantId))).limit(1);
  if (!existing.length) {
    res.status(404).json({ error: "Discount not found" });
    return;
  }
  const d = req.body;
  const updates: Record<string, unknown> = {};
  if (d.code !== undefined) updates.code = String(d.code).toUpperCase().trim();
  if (d.description !== undefined) updates.description = d.description;
  if (d.type !== undefined) updates.type = d.type;
  if (d.value !== undefined) updates.value = String(d.value);
  if (d.minOrderAmount !== undefined) updates.minOrderAmount = d.minOrderAmount != null ? String(d.minOrderAmount) : null;
  if (d.maxDiscountAmount !== undefined) updates.maxDiscountAmount = d.maxDiscountAmount != null ? String(d.maxDiscountAmount) : null;
  if (d.usageLimit !== undefined) updates.usageLimit = d.usageLimit;
  if (d.isActive !== undefined) updates.isActive = d.isActive;
  if (d.startsAt !== undefined) updates.startsAt = d.startsAt ? new Date(d.startsAt) : null;
  if (d.expiresAt !== undefined) updates.expiresAt = d.expiresAt ? new Date(d.expiresAt) : null;

  const [updated] = await db.update(discountsTable).set(updates).where(eq(discountsTable.id, req.params.id)).returning();
  res.json(serializeDiscount(updated));
});

router.delete("/:id", async (req, res) => {
  const existing = await db.select({ id: discountsTable.id }).from(discountsTable).where(and(eq(discountsTable.id, req.params.id), eq(discountsTable.tenantId, req.user!.tenantId))).limit(1);
  if (!existing.length) {
    res.status(404).json({ error: "Discount not found" });
    return;
  }
  await db.delete(discountUsagesTable).where(eq(discountUsagesTable.discountId, req.params.id));
  await db.delete(discountsTable).where(eq(discountsTable.id, req.params.id));
  res.status(204).send();
});

export default router;
