import { Router } from "express";
import { db, campaignsTable, segmentsTable, discountsTable, segmentMembersTable } from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

async function enrichCampaign(c: typeof campaignsTable.$inferSelect, tenantId: string) {
  let segmentName: string | null = null;
  let discountCode: string | null = null;
  let audienceCount = c.audienceCount;

  if (c.targetSegmentId) {
    const [seg] = await db.select({ name: segmentsTable.name }).from(segmentsTable).where(eq(segmentsTable.id, c.targetSegmentId)).limit(1);
    segmentName = seg?.name ?? null;
    const [cnt] = await db.select({ count: sql<number>`count(*)::int` }).from(segmentMembersTable).where(eq(segmentMembersTable.segmentId, c.targetSegmentId));
    audienceCount = cnt?.count ?? 0;
  }
  if (c.discountId) {
    const [disc] = await db.select({ code: discountsTable.code }).from(discountsTable).where(eq(discountsTable.id, c.discountId)).limit(1);
    discountCode = disc?.code ?? null;
  }

  return {
    id: c.id,
    name: c.name,
    description: c.description,
    type: c.type,
    status: c.status,
    targetSegmentId: c.targetSegmentId,
    segmentName,
    discountId: c.discountId,
    discountCode,
    conditions: c.conditions,
    startsAt: c.startsAt,
    endsAt: c.endsAt,
    audienceCount,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

router.get("/", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { status, page = "1", perPage = "20" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page));
  const perPageNum = Math.min(100, Math.max(1, parseInt(perPage)));
  const offset = (pageNum - 1) * perPageNum;

  const conditions = [eq(campaignsTable.tenantId, tenantId)];
  if (status) conditions.push(eq(campaignsTable.status, status as any));

  const [countRow] = await db.select({ total: sql<number>`count(*)::int` }).from(campaignsTable).where(and(...conditions));
  const rows = await db.select().from(campaignsTable).where(and(...conditions)).orderBy(desc(campaignsTable.createdAt)).limit(perPageNum).offset(offset);

  const enriched = await Promise.all(rows.map((r) => enrichCampaign(r, tenantId)));
  res.json({ data: enriched, meta: { page: pageNum, perPage: perPageNum, total: countRow.total } });
});

router.post("/", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { name, description, type, targetSegmentId, discountId, conditions, startsAt, endsAt } = req.body;
  if (!name || !type) {
    res.status(400).json({ error: "name and type are required" });
    return;
  }

  const [campaign] = await db.insert(campaignsTable).values({
    tenantId,
    name,
    description: description ?? null,
    type,
    status: "draft",
    targetSegmentId: targetSegmentId ?? null,
    discountId: discountId ?? null,
    conditions: conditions ?? null,
    startsAt: startsAt ? new Date(startsAt) : null,
    endsAt: endsAt ? new Date(endsAt) : null,
  }).returning();

  res.status(201).json(await enrichCampaign(campaign, tenantId));
});

router.get("/:id", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const [campaign] = await db.select().from(campaignsTable).where(and(eq(campaignsTable.id, req.params.id), eq(campaignsTable.tenantId, tenantId))).limit(1);
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }
  res.json(await enrichCampaign(campaign, tenantId));
});

router.patch("/:id", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const existing = await db.select({ id: campaignsTable.id }).from(campaignsTable).where(and(eq(campaignsTable.id, req.params.id), eq(campaignsTable.tenantId, tenantId))).limit(1);
  if (!existing.length) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }
  const { name, description, type, status, targetSegmentId, discountId, conditions, startsAt, endsAt } = req.body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (type !== undefined) updates.type = type;
  if (status !== undefined) updates.status = status;
  if (targetSegmentId !== undefined) updates.targetSegmentId = targetSegmentId;
  if (discountId !== undefined) updates.discountId = discountId;
  if (conditions !== undefined) updates.conditions = conditions;
  if (startsAt !== undefined) updates.startsAt = startsAt ? new Date(startsAt) : null;
  if (endsAt !== undefined) updates.endsAt = endsAt ? new Date(endsAt) : null;

  const [updated] = await db.update(campaignsTable).set(updates).where(eq(campaignsTable.id, req.params.id)).returning();
  res.json(await enrichCampaign(updated, tenantId));
});

router.post("/:id/launch", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const [campaign] = await db.select().from(campaignsTable).where(and(eq(campaignsTable.id, req.params.id), eq(campaignsTable.tenantId, tenantId))).limit(1);
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }
  if (campaign.status === "active") {
    res.status(400).json({ error: "Campaign is already active" });
    return;
  }
  const [updated] = await db.update(campaignsTable).set({ status: "active", startsAt: campaign.startsAt ?? new Date() }).where(eq(campaignsTable.id, req.params.id)).returning();
  res.json(await enrichCampaign(updated, tenantId));
});

router.post("/:id/pause", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const [existing] = await db.select().from(campaignsTable).where(and(eq(campaignsTable.id, req.params.id), eq(campaignsTable.tenantId, tenantId))).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }
  const [updated] = await db.update(campaignsTable).set({ status: "paused" }).where(eq(campaignsTable.id, req.params.id)).returning();
  res.json(await enrichCampaign(updated, tenantId));
});

router.delete("/:id", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const existing = await db.select({ id: campaignsTable.id }).from(campaignsTable).where(and(eq(campaignsTable.id, req.params.id), eq(campaignsTable.tenantId, tenantId))).limit(1);
  if (!existing.length) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }
  await db.delete(campaignsTable).where(eq(campaignsTable.id, req.params.id));
  res.status(204).send();
});

export default router;
