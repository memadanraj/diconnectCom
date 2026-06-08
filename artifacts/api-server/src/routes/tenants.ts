import { Router } from "express";
import { db, tenantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { UpdateMyTenantBody } from "@workspace/api-zod";

const router = Router();

router.use(requireAuth);

router.get("/me", async (req, res) => {
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, req.user!.tenantId)).limit(1);
  if (!tenant) {
    res.status(404).json({ error: "Tenant not found" });
    return;
  }
  res.json({ id: tenant.id, name: tenant.name, slug: tenant.slug, plan: tenant.plan, status: tenant.status, email: tenant.email, phone: tenant.phone, address: tenant.address, logoUrl: tenant.logoUrl, createdAt: tenant.createdAt });
});

router.patch("/me", async (req, res) => {
  const parse = UpdateMyTenantBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { name, email, phone, address, logoUrl } = parse.data;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (email !== undefined) updates.email = email;
  if (phone !== undefined) updates.phone = phone;
  if (address !== undefined) updates.address = address;
  if (logoUrl !== undefined) updates.logoUrl = logoUrl;

  const [tenant] = await db.update(tenantsTable).set(updates).where(eq(tenantsTable.id, req.user!.tenantId)).returning();
  res.json({ id: tenant.id, name: tenant.name, slug: tenant.slug, plan: tenant.plan, status: tenant.status, email: tenant.email, phone: tenant.phone, address: tenant.address, logoUrl: tenant.logoUrl, createdAt: tenant.createdAt });
});

export default router;
