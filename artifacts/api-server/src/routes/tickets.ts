import { Router } from "express";
import { db, supportTicketsTable, ticketMessagesTable, customersTable, ordersTable } from "@workspace/db";
import { eq, and, desc, sql, ilike, inArray } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

const VALID_STATUSES = ["open", "in_progress", "resolved", "closed"];
const VALID_PRIORITIES = ["low", "normal", "high", "urgent"];

function fmtTicket(t: typeof supportTicketsTable.$inferSelect, extras: Record<string, unknown> = {}) {
  return {
    id: t.id,
    subject: t.subject,
    status: t.status,
    priority: t.priority,
    customerId: t.customerId,
    orderId: t.orderId,
    assignedTo: t.assignedTo,
    resolvedAt: t.resolvedAt,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    ...extras,
  };
}

router.get("/", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { search, status, page = "1", perPage = "20" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page));
  const perPageNum = Math.min(100, Math.max(1, parseInt(perPage)));
  const offset = (pageNum - 1) * perPageNum;

  const conditions = [eq(supportTicketsTable.tenantId, tenantId)];
  if (status && VALID_STATUSES.includes(status)) {
    conditions.push(eq(supportTicketsTable.status, status));
  }
  if (search) {
    conditions.push(ilike(supportTicketsTable.subject, `%${search}%`));
  }

  const [countRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(supportTicketsTable)
    .where(and(...conditions));

  const tickets = await db
    .select()
    .from(supportTicketsTable)
    .where(and(...conditions))
    .orderBy(desc(supportTicketsTable.createdAt))
    .limit(perPageNum)
    .offset(offset);

  const customerIds = [...new Set(tickets.map(t => t.customerId).filter(Boolean) as string[])];
  const customerMap = new Map<string, { email: string; firstName: string | null; lastName: string | null }>();
  if (customerIds.length > 0) {
    const customers = await db
      .select({ id: customersTable.id, email: customersTable.email, firstName: customersTable.firstName, lastName: customersTable.lastName })
      .from(customersTable)
      .where(and(eq(customersTable.tenantId, tenantId), inArray(customersTable.id, customerIds)));
    customers.forEach(c => customerMap.set(c.id, c));
  }

  const data = tickets.map(t => {
    const cust = t.customerId ? customerMap.get(t.customerId) : null;
    return fmtTicket(t, {
      customerName: cust ? [cust.firstName, cust.lastName].filter(Boolean).join(" ") || cust.email : null,
      customerEmail: cust?.email ?? null,
    });
  });

  res.json({ data, meta: { page: pageNum, perPage: perPageNum, total: countRow.total } });
});

router.post("/", async (req, res) => {
  const { subject, customerId, orderId, priority } = req.body as {
    subject?: string; customerId?: string; orderId?: string; priority?: string;
  };

  if (!subject || !subject.trim()) {
    res.status(400).json({ error: "subject is required" });
    return;
  }
  if (priority && !VALID_PRIORITIES.includes(priority)) {
    res.status(400).json({ error: "Invalid priority" });
    return;
  }

  const tenantId = req.user!.tenantId;

  if (customerId) {
    const [cust] = await db.select({ id: customersTable.id }).from(customersTable).where(and(eq(customersTable.id, customerId), eq(customersTable.tenantId, tenantId))).limit(1);
    if (!cust) { res.status(400).json({ error: "Customer not found" }); return; }
  }
  if (orderId) {
    const [ord] = await db.select({ id: ordersTable.id }).from(ordersTable).where(and(eq(ordersTable.id, orderId), eq(ordersTable.tenantId, tenantId))).limit(1);
    if (!ord) { res.status(400).json({ error: "Order not found" }); return; }
  }

  const [ticket] = await db.insert(supportTicketsTable).values({
    tenantId,
    subject: subject.trim(),
    customerId: customerId ?? null,
    orderId: orderId ?? null,
    priority: priority ?? "normal",
  }).returning();

  res.status(201).json(fmtTicket(ticket));
});

router.get("/:id", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const [ticket] = await db.select().from(supportTicketsTable).where(and(eq(supportTicketsTable.id, req.params.id), eq(supportTicketsTable.tenantId, tenantId))).limit(1);
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }

  const messages = await db.select().from(ticketMessagesTable).where(eq(ticketMessagesTable.ticketId, ticket.id)).orderBy(ticketMessagesTable.createdAt);

  let customerName: string | null = null;
  let customerEmail: string | null = null;
  if (ticket.customerId) {
    const [cust] = await db.select({ email: customersTable.email, firstName: customersTable.firstName, lastName: customersTable.lastName }).from(customersTable).where(eq(customersTable.id, ticket.customerId)).limit(1);
    if (cust) {
      customerName = [cust.firstName, cust.lastName].filter(Boolean).join(" ") || cust.email;
      customerEmail = cust.email;
    }
  }

  let orderNumber: string | null = null;
  if (ticket.orderId) {
    const [ord] = await db.select({ orderNumber: ordersTable.orderNumber }).from(ordersTable).where(eq(ordersTable.id, ticket.orderId)).limit(1);
    if (ord) orderNumber = ord.orderNumber;
  }

  res.json({ ...fmtTicket(ticket, { customerName, customerEmail, orderNumber }), messages });
});

router.patch("/:id", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const [ticket] = await db.select().from(supportTicketsTable).where(and(eq(supportTicketsTable.id, req.params.id), eq(supportTicketsTable.tenantId, tenantId))).limit(1);
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }

  const { status, priority, subject } = req.body as { status?: string; priority?: string; subject?: string };
  const updates: Record<string, unknown> = {};
  if (status) {
    if (!VALID_STATUSES.includes(status)) { res.status(400).json({ error: "Invalid status" }); return; }
    updates.status = status;
    if (status === "resolved" || status === "closed") updates.resolvedAt = new Date();
  }
  if (priority) {
    if (!VALID_PRIORITIES.includes(priority)) { res.status(400).json({ error: "Invalid priority" }); return; }
    updates.priority = priority;
  }
  if (subject?.trim()) updates.subject = subject.trim();

  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "No updates provided" }); return; }

  const [updated] = await db.update(supportTicketsTable).set(updates).where(eq(supportTicketsTable.id, req.params.id)).returning();
  res.json(fmtTicket(updated));
});

router.delete("/:id", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const [ticket] = await db.select({ id: supportTicketsTable.id }).from(supportTicketsTable).where(and(eq(supportTicketsTable.id, req.params.id), eq(supportTicketsTable.tenantId, tenantId))).limit(1);
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }
  await db.delete(ticketMessagesTable).where(eq(ticketMessagesTable.ticketId, req.params.id));
  await db.delete(supportTicketsTable).where(eq(supportTicketsTable.id, req.params.id));
  res.status(204).send();
});

router.post("/:id/messages", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const [ticket] = await db.select({ id: supportTicketsTable.id }).from(supportTicketsTable).where(and(eq(supportTicketsTable.id, req.params.id), eq(supportTicketsTable.tenantId, tenantId))).limit(1);
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }

  const { body, senderType } = req.body as { body?: string; senderType?: string };
  if (!body?.trim()) { res.status(400).json({ error: "body is required" }); return; }

  const [msg] = await db.insert(ticketMessagesTable).values({
    ticketId: req.params.id,
    senderType: senderType === "customer" ? "customer" : "staff",
    senderId: req.user!.sub,
    body: body.trim(),
  }).returning();

  if (ticket) {
    await db.update(supportTicketsTable).set({ status: "in_progress" }).where(and(eq(supportTicketsTable.id, req.params.id), eq(supportTicketsTable.status, "open")));
  }

  res.status(201).json(msg);
});

export default router;
