import { Router } from "express";
import { db, shipmentsTable, shipmentEventsTable, ordersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { CreateShipmentBody, UpdateShipmentBody, AddShipmentEventBody } from "@workspace/api-zod";

const router = Router();
router.use(requireAuth);

function formatShipment(s: typeof shipmentsTable.$inferSelect, orderNumber?: string | null, customerName?: string | null) {
  return {
    id: s.id, orderId: s.orderId, orderNumber: orderNumber ?? null, customerName: customerName ?? null,
    trackingNumber: s.trackingNumber, carrier: s.carrier, status: s.status,
    estimatedDelivery: s.estimatedDelivery ?? null, deliveredAt: s.deliveredAt ?? null,
    notes: s.notes, createdAt: s.createdAt,
  };
}

router.get("/", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { status, orderId, page = "1", perPage = "20" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page));
  const perPageNum = Math.min(100, Math.max(1, parseInt(perPage)));
  const offset = (pageNum - 1) * perPageNum;

  const conditions = [eq(shipmentsTable.tenantId, tenantId)];
  if (status) conditions.push(eq(shipmentsTable.status, status));
  if (orderId) conditions.push(eq(shipmentsTable.orderId, orderId));

  const [countRow] = await db.select({ total: sql<number>`count(*)::int` }).from(shipmentsTable).where(and(...conditions));
  const rows = await db
    .select({ shipment: shipmentsTable, orderNumber: ordersTable.orderNumber, customerName: ordersTable.customerName })
    .from(shipmentsTable)
    .leftJoin(ordersTable, eq(shipmentsTable.orderId, ordersTable.id))
    .where(and(...conditions))
    .orderBy(sql`${shipmentsTable.createdAt} desc`)
    .limit(perPageNum).offset(offset);

  res.json({ data: rows.map(r => formatShipment(r.shipment, r.orderNumber, r.customerName)), meta: { page: pageNum, perPage: perPageNum, total: countRow.total } });
});

router.post("/", async (req, res) => {
  const parse = CreateShipmentBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid input", details: parse.error.issues });
    return;
  }
  const tenantId = req.user!.tenantId;
  const d = parse.data;

  const [order] = await db.select({ id: ordersTable.id, orderNumber: ordersTable.orderNumber, customerName: ordersTable.customerName }).from(ordersTable).where(and(eq(ordersTable.id, d.orderId), eq(ordersTable.tenantId, tenantId))).limit(1);
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  const [s] = await db.insert(shipmentsTable).values({
    tenantId, orderId: d.orderId, trackingNumber: d.trackingNumber, carrier: d.carrier,
    status: d.status ?? "pending",
    estimatedDelivery: d.estimatedDelivery ? new Date(d.estimatedDelivery) : null,
    notes: d.notes,
  }).returning();

  await db.insert(shipmentEventsTable).values({ shipmentId: s.id, status: s.status, description: "Shipment created", location: null });

  res.status(201).json(formatShipment(s, order.orderNumber, order.customerName));
});

router.get("/:id", async (req, res) => {
  const [row] = await db
    .select({ shipment: shipmentsTable, orderNumber: ordersTable.orderNumber, customerName: ordersTable.customerName })
    .from(shipmentsTable)
    .leftJoin(ordersTable, eq(shipmentsTable.orderId, ordersTable.id))
    .where(and(eq(shipmentsTable.id, req.params.id), eq(shipmentsTable.tenantId, req.user!.tenantId)))
    .limit(1);

  if (!row) {
    res.status(404).json({ error: "Shipment not found" });
    return;
  }

  const events = await db.select().from(shipmentEventsTable).where(eq(shipmentEventsTable.shipmentId, req.params.id)).orderBy(sql`${shipmentEventsTable.occurredAt} desc`);

  res.json({
    ...formatShipment(row.shipment, row.orderNumber, row.customerName),
    events: events.map(e => ({ id: e.id, shipmentId: e.shipmentId, status: e.status, description: e.description, location: e.location, occurredAt: e.occurredAt })),
  });
});

router.patch("/:id", async (req, res) => {
  const parse = UpdateShipmentBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const existing = await db.select().from(shipmentsTable).where(and(eq(shipmentsTable.id, req.params.id), eq(shipmentsTable.tenantId, req.user!.tenantId))).limit(1);
  if (!existing.length) {
    res.status(404).json({ error: "Shipment not found" });
    return;
  }
  const d = parse.data;
  const updates: Record<string, unknown> = {};
  if (d.trackingNumber !== undefined) updates.trackingNumber = d.trackingNumber;
  if (d.carrier !== undefined) updates.carrier = d.carrier;
  if (d.status !== undefined) updates.status = d.status;
  if (d.estimatedDelivery !== undefined) updates.estimatedDelivery = new Date(d.estimatedDelivery);
  if (d.notes !== undefined) updates.notes = d.notes;
  if (d.status === "delivered") updates.deliveredAt = new Date();

  const [s] = await db.update(shipmentsTable).set(updates).where(eq(shipmentsTable.id, req.params.id)).returning();

  if (d.status && d.status !== existing[0].status) {
    await db.insert(shipmentEventsTable).values({ shipmentId: s.id, status: d.status, description: `Status updated to ${d.status}`, location: null });
  }

  const [order] = await db.select({ orderNumber: ordersTable.orderNumber, customerName: ordersTable.customerName }).from(ordersTable).where(eq(ordersTable.id, s.orderId)).limit(1);
  res.json(formatShipment(s, order?.orderNumber, order?.customerName));
});

router.post("/:id/events", async (req, res) => {
  const parse = AddShipmentEventBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid input", details: parse.error.issues });
    return;
  }
  const [s] = await db.select({ id: shipmentsTable.id }).from(shipmentsTable).where(and(eq(shipmentsTable.id, req.params.id), eq(shipmentsTable.tenantId, req.user!.tenantId))).limit(1);
  if (!s) {
    res.status(404).json({ error: "Shipment not found" });
    return;
  }
  const d = parse.data;
  const [e] = await db.insert(shipmentEventsTable).values({ shipmentId: req.params.id, status: d.status, description: d.description, location: d.location, occurredAt: d.occurredAt ? new Date(d.occurredAt) : new Date() }).returning();
  res.status(201).json({ id: e.id, shipmentId: e.shipmentId, status: e.status, description: e.description, location: e.location, occurredAt: e.occurredAt });
});

export default router;
