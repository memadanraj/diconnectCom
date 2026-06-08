import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, tenantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { signToken, requireAuth } from "../middlewares/auth";
import { LoginBody, RegisterBody } from "@workspace/api-zod";

const router = Router();

router.post("/login", async (req, res) => {
  const parse = LoginBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { email, password } = parse.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, user.tenantId)).limit(1);
  if (!tenant) {
    res.status(401).json({ error: "Tenant not found" });
    return;
  }

  const token = signToken({ sub: user.id, tenantId: user.tenantId, role: user.role, email: user.email, name: user.name });

  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenantId, createdAt: user.createdAt },
    tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, plan: tenant.plan, status: tenant.status, email: tenant.email, phone: tenant.phone, address: tenant.address, logoUrl: tenant.logoUrl, createdAt: tenant.createdAt },
  });
});

router.post("/register", async (req, res) => {
  const parse = RegisterBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid input", details: parse.error.issues });
    return;
  }
  const { email, password, name, storeName } = parse.data;

  const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
  if (existing) {
    res.status(409).json({ error: "Email already in use" });
    return;
  }

  const slug = storeName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Math.random().toString(36).slice(2, 7);
  const [tenant] = await db.insert(tenantsTable).values({ name: storeName, slug, plan: "starter", status: "active" }).returning();

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.insert(usersTable).values({ tenantId: tenant.id, email: email.toLowerCase(), passwordHash, name, role: "TENANT_OWNER" }).returning();

  const token = signToken({ sub: user.id, tenantId: user.tenantId, role: user.role, email: user.email, name: user.name });

  res.status(201).json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenantId, createdAt: user.createdAt },
    tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, plan: tenant.plan, status: tenant.status, email: tenant.email, phone: tenant.phone, address: tenant.address, logoUrl: tenant.logoUrl, createdAt: tenant.createdAt },
  });
});

router.get("/me", requireAuth, async (req, res) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.sub)).limit(1);
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenantId, createdAt: user.createdAt });
});

export default router;
