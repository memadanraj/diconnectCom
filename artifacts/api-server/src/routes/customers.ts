import { Router } from "express";
import { db, customersTable, customerAddressesTable, ordersTable } from "@workspace/db";
import { eq, and, ilike, or, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { CreateCustomerBody, UpdateCustomerBody, CreateCustomerAddressBody } from "@workspace/api-zod";

const router = Router();
router.use(requireAuth);

function formatCustomer(c: typeof customersTable.$inferSelect) {
  return {
    id: c.id, email: c.email, firstName: c.firstName, lastName: c.lastName,
    phone: c.phone, notes: c.notes, totalOrders: c.totalOrders,
    totalSpent: parseFloat(c.totalSpent), createdAt: c.createdAt,
  };
}

router.get("/", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { search, page = "1", perPage = "20" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page));
  const perPageNum = Math.min(100, Math.max(1, parseInt(perPage)));
  const offset = (pageNum - 1) * perPageNum;

  const conditions = [eq(customersTable.tenantId, tenantId)];
  if (search) {
    conditions.push(
      or(
        ilike(customersTable.email, `%${search}%`),
        ilike(customersTable.firstName ?? sql`''`, `%${search}%`),
        ilike(customersTable.lastName ?? sql`''`, `%${search}%`),
        ilike(customersTable.phone ?? sql`''`, `%${search}%`),
      )!
    );
  }

  const [countRow] = await db.select({ total: sql<number>`count(*)::int` }).from(customersTable).where(and(...conditions));
  const rows = await db.select().from(customersTable).where(and(...conditions)).orderBy(sql`${customersTable.createdAt} desc`).limit(perPageNum).offset(offset);

  res.json({ data: rows.map(formatCustomer), meta: { page: pageNum, perPage: perPageNum, total: countRow.total } });
});

router.post("/", async (req, res) => {
  const parse = CreateCustomerBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid input", details: parse.error.issues });
    return;
  }
  const d = parse.data;
  const [c] = await db.insert(customersTable).values({ tenantId: req.user!.tenantId, email: d.email, firstName: d.firstName, lastName: d.lastName, phone: d.phone, notes: d.notes }).returning();
  res.status(201).json(formatCustomer(c));
});

router.get("/:id", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const [c] = await db.select().from(customersTable).where(and(eq(customersTable.id, req.params.id), eq(customersTable.tenantId, tenantId))).limit(1);
  if (!c) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  const addresses = await db.select().from(customerAddressesTable).where(eq(customerAddressesTable.customerId, c.id)).orderBy(sql`${customerAddressesTable.isDefault} desc, ${customerAddressesTable.createdAt} asc`);
  const recentOrders = await db.select().from(ordersTable).where(and(eq(ordersTable.customerEmail, c.email), eq(ordersTable.tenantId, tenantId))).orderBy(sql`${ordersTable.createdAt} desc`).limit(5);

  res.json({
    ...formatCustomer(c),
    addresses: addresses.map(a => ({ id: a.id, customerId: a.customerId, label: a.label, firstName: a.firstName, lastName: a.lastName, line1: a.line1, line2: a.line2, city: a.city, state: a.state, country: a.country, postalCode: a.postalCode, phone: a.phone, isDefault: a.isDefault, createdAt: a.createdAt })),
    recentOrders: recentOrders.map(o => ({ id: o.id, orderNumber: o.orderNumber, status: o.status, customerId: o.customerEmail, customerName: o.customerName, customerEmail: o.customerEmail, subtotal: parseFloat(o.subtotal), discount: parseFloat(o.discount), shippingFee: parseFloat(o.shippingFee), tax: parseFloat(o.tax), total: parseFloat(o.total), currency: o.currency, notes: o.notes, itemCount: 0, createdAt: o.createdAt })),
  });
});

router.patch("/:id", async (req, res) => {
  const parse = UpdateCustomerBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const existing = await db.select({ id: customersTable.id }).from(customersTable).where(and(eq(customersTable.id, req.params.id), eq(customersTable.tenantId, req.user!.tenantId))).limit(1);
  if (!existing.length) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  const d = parse.data;
  const updates: Record<string, unknown> = {};
  if (d.email !== undefined) updates.email = d.email;
  if (d.firstName !== undefined) updates.firstName = d.firstName;
  if (d.lastName !== undefined) updates.lastName = d.lastName;
  if (d.phone !== undefined) updates.phone = d.phone;
  if (d.notes !== undefined) updates.notes = d.notes;
  const [c] = await db.update(customersTable).set(updates).where(eq(customersTable.id, req.params.id)).returning();
  res.json(formatCustomer(c));
});

router.delete("/:id", async (req, res) => {
  const existing = await db.select({ id: customersTable.id }).from(customersTable).where(and(eq(customersTable.id, req.params.id), eq(customersTable.tenantId, req.user!.tenantId))).limit(1);
  if (!existing.length) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  await db.delete(customerAddressesTable).where(eq(customerAddressesTable.customerId, req.params.id));
  await db.delete(customersTable).where(eq(customersTable.id, req.params.id));
  res.status(204).send();
});

router.get("/:id/addresses", async (req, res) => {
  const [c] = await db.select({ id: customersTable.id }).from(customersTable).where(and(eq(customersTable.id, req.params.id), eq(customersTable.tenantId, req.user!.tenantId))).limit(1);
  if (!c) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  const addresses = await db.select().from(customerAddressesTable).where(eq(customerAddressesTable.customerId, req.params.id)).orderBy(sql`${customerAddressesTable.isDefault} desc, ${customerAddressesTable.createdAt} asc`);
  res.json(addresses.map(a => ({ id: a.id, customerId: a.customerId, label: a.label, firstName: a.firstName, lastName: a.lastName, line1: a.line1, line2: a.line2, city: a.city, state: a.state, country: a.country, postalCode: a.postalCode, phone: a.phone, isDefault: a.isDefault, createdAt: a.createdAt })));
});

router.post("/:id/addresses", async (req, res) => {
  const parse = CreateCustomerAddressBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid input", details: parse.error.issues });
    return;
  }
  const tenantId = req.user!.tenantId;
  const [c] = await db.select({ id: customersTable.id }).from(customersTable).where(and(eq(customersTable.id, req.params.id), eq(customersTable.tenantId, tenantId))).limit(1);
  if (!c) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  const d = parse.data;
  if (d.isDefault) {
    await db.update(customerAddressesTable).set({ isDefault: false }).where(eq(customerAddressesTable.customerId, req.params.id));
  }
  const [a] = await db.insert(customerAddressesTable).values({ customerId: req.params.id, tenantId, label: d.label, firstName: d.firstName, lastName: d.lastName, line1: d.line1, line2: d.line2, city: d.city, state: d.state, country: d.country, postalCode: d.postalCode, phone: d.phone, isDefault: d.isDefault ?? false }).returning();
  res.status(201).json({ id: a.id, customerId: a.customerId, label: a.label, firstName: a.firstName, lastName: a.lastName, line1: a.line1, line2: a.line2, city: a.city, state: a.state, country: a.country, postalCode: a.postalCode, phone: a.phone, isDefault: a.isDefault, createdAt: a.createdAt });
});

export default router;
