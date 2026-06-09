import { Router } from "express";
import { db, segmentsTable, segmentMembersTable, customersTable } from "@workspace/db";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

function serializeSegment(s: typeof segmentsTable.$inferSelect, memberCount = 0) {
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    type: s.type,
    conditions: s.conditions,
    isActive: s.isActive,
    memberCount,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

router.get("/", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { page = "1", perPage = "50" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page));
  const perPageNum = Math.min(100, Math.max(1, parseInt(perPage)));
  const offset = (pageNum - 1) * perPageNum;

  const [countRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(segmentsTable)
    .where(eq(segmentsTable.tenantId, tenantId));

  const rows = await db
    .select()
    .from(segmentsTable)
    .where(eq(segmentsTable.tenantId, tenantId))
    .orderBy(desc(segmentsTable.createdAt))
    .limit(perPageNum)
    .offset(offset);

  const segmentIds = rows.map((s) => s.id);
  const memberCounts = segmentIds.length
    ? await db
        .select({ segmentId: segmentMembersTable.segmentId, count: sql<number>`count(*)::int` })
        .from(segmentMembersTable)
        .where(inArray(segmentMembersTable.segmentId, segmentIds))
        .groupBy(segmentMembersTable.segmentId)
    : [];
  const countMap = new Map(memberCounts.map((m) => [m.segmentId, m.count]));

  res.json({
    data: rows.map((s) => serializeSegment(s, countMap.get(s.id) ?? 0)),
    meta: { page: pageNum, perPage: perPageNum, total: countRow.total },
  });
});

router.post("/", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { name, description, type, conditions } = req.body;
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const [segment] = await db
    .insert(segmentsTable)
    .values({ tenantId, name, description: description ?? null, type: type ?? "static", conditions: conditions ?? null })
    .returning();
  res.status(201).json(serializeSegment(segment, 0));
});

router.get("/:id", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const [segment] = await db
    .select()
    .from(segmentsTable)
    .where(and(eq(segmentsTable.id, req.params.id), eq(segmentsTable.tenantId, tenantId)))
    .limit(1);
  if (!segment) {
    res.status(404).json({ error: "Segment not found" });
    return;
  }

  const members = await db
    .select({
      member: segmentMembersTable,
      email: customersTable.email,
      firstName: customersTable.firstName,
      lastName: customersTable.lastName,
    })
    .from(segmentMembersTable)
    .leftJoin(customersTable, eq(segmentMembersTable.customerId, customersTable.id))
    .where(eq(segmentMembersTable.segmentId, segment.id))
    .orderBy(desc(segmentMembersTable.addedAt));

  res.json({
    ...serializeSegment(segment, members.length),
    members: members.map((m) => ({
      customerId: m.member.customerId,
      email: m.email,
      name: [m.firstName, m.lastName].filter(Boolean).join(" ") || m.email,
      addedAt: m.member.addedAt,
    })),
  });
});

router.patch("/:id", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const existing = await db
    .select({ id: segmentsTable.id })
    .from(segmentsTable)
    .where(and(eq(segmentsTable.id, req.params.id), eq(segmentsTable.tenantId, tenantId)))
    .limit(1);
  if (!existing.length) {
    res.status(404).json({ error: "Segment not found" });
    return;
  }
  const { name, description, conditions, isActive } = req.body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (conditions !== undefined) updates.conditions = conditions;
  if (isActive !== undefined) updates.isActive = isActive;
  const [updated] = await db.update(segmentsTable).set(updates).where(eq(segmentsTable.id, req.params.id)).returning();
  const [cnt] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(segmentMembersTable)
    .where(eq(segmentMembersTable.segmentId, updated.id));
  res.json(serializeSegment(updated, cnt?.count ?? 0));
});

router.delete("/:id", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const existing = await db
    .select({ id: segmentsTable.id })
    .from(segmentsTable)
    .where(and(eq(segmentsTable.id, req.params.id), eq(segmentsTable.tenantId, tenantId)))
    .limit(1);
  if (!existing.length) {
    res.status(404).json({ error: "Segment not found" });
    return;
  }
  await db.delete(segmentMembersTable).where(eq(segmentMembersTable.segmentId, req.params.id));
  await db.delete(segmentsTable).where(eq(segmentsTable.id, req.params.id));
  res.status(204).send();
});

router.post("/:id/members", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { customerIds } = req.body as { customerIds: string[] };
  if (!Array.isArray(customerIds) || customerIds.length === 0) {
    res.status(400).json({ error: "customerIds array is required" });
    return;
  }
  const [segment] = await db
    .select({ id: segmentsTable.id })
    .from(segmentsTable)
    .where(and(eq(segmentsTable.id, req.params.id), eq(segmentsTable.tenantId, tenantId)))
    .limit(1);
  if (!segment) {
    res.status(404).json({ error: "Segment not found" });
    return;
  }

  const existing = await db
    .select({ customerId: segmentMembersTable.customerId })
    .from(segmentMembersTable)
    .where(and(eq(segmentMembersTable.segmentId, segment.id), inArray(segmentMembersTable.customerId, customerIds)));
  const existingSet = new Set(existing.map((e) => e.customerId));
  const toAdd = customerIds.filter((id) => !existingSet.has(id));

  if (toAdd.length) {
    await db.insert(segmentMembersTable).values(toAdd.map((customerId) => ({ tenantId, segmentId: segment.id, customerId })));
  }

  res.json({ added: toAdd.length, skipped: customerIds.length - toAdd.length });
});

router.delete("/:id/members/:customerId", async (req, res) => {
  await db
    .delete(segmentMembersTable)
    .where(
      and(
        eq(segmentMembersTable.segmentId, req.params.id),
        eq(segmentMembersTable.customerId, req.params.customerId)
      )
    );
  res.status(204).send();
});

export default router;
