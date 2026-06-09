import { Router } from "express";
import { db, themesTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();
router.use(requireAuth);

const DEFAULT_THEME = {
  tokens: {
    primaryColor: "#16a34a",
    secondaryColor: "#0284c7",
    fontHeading: "Inter",
    fontBody: "Inter",
    borderRadius: "8px",
  },
  sections: [
    {
      id: "hero-1",
      type: "hero",
      order: 1,
      props: {
        title: "Welcome to our store",
        subtitle: "Shop the latest collection",
        ctaText: "Shop Now",
        ctaUrl: "/products",
      },
    },
    {
      id: "product-grid-1",
      type: "product_grid",
      order: 2,
      props: {
        columns: 3,
        limit: 12,
        showPrice: true,
      },
    },
  ],
  settings: {
    showAnnouncementBar: false,
    announcementText: "Free shipping on orders over Rs 999",
  },
};

function serialize(t: typeof themesTable.$inferSelect) {
  return {
    id: t.id,
    name: t.name,
    draftJson: t.draftJson,
    publishedJson: t.publishedJson,
    isPublished: t.isPublished,
    publishedAt: t.publishedAt,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

router.get("/", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const rows = await db.select().from(themesTable).where(eq(themesTable.tenantId, tenantId)).orderBy(desc(themesTable.updatedAt));
  res.json(rows.map(serialize));
});

router.post("/", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const { name } = req.body;
  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  const [theme] = await db.insert(themesTable).values({ tenantId, name, draftJson: DEFAULT_THEME }).returning();
  res.status(201).json(serialize(theme));
});

router.get("/:id", async (req, res) => {
  const [theme] = await db.select().from(themesTable).where(and(eq(themesTable.id, req.params.id), eq(themesTable.tenantId, req.user!.tenantId))).limit(1);
  if (!theme) { res.status(404).json({ error: "Theme not found" }); return; }
  res.json(serialize(theme));
});

router.patch("/:id", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const [existing] = await db.select().from(themesTable).where(and(eq(themesTable.id, req.params.id), eq(themesTable.tenantId, tenantId))).limit(1);
  if (!existing) { res.status(404).json({ error: "Theme not found" }); return; }

  const { name, draftJson } = req.body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (draftJson !== undefined) updates.draftJson = draftJson;

  const [updated] = await db.update(themesTable).set(updates).where(eq(themesTable.id, req.params.id)).returning();
  res.json(serialize(updated));
});

router.post("/:id/publish", async (req, res) => {
  const tenantId = req.user!.tenantId;
  const [existing] = await db.select().from(themesTable).where(and(eq(themesTable.id, req.params.id), eq(themesTable.tenantId, tenantId))).limit(1);
  if (!existing) { res.status(404).json({ error: "Theme not found" }); return; }

  // Unpublish all other themes for this tenant
  await db.update(themesTable).set({ isPublished: false }).where(and(eq(themesTable.tenantId, tenantId), eq(themesTable.isPublished, true)));

  const [updated] = await db.update(themesTable).set({
    isPublished: true,
    publishedJson: existing.draftJson,
    publishedAt: new Date(),
  }).where(eq(themesTable.id, req.params.id)).returning();
  res.json(serialize(updated));
});

router.delete("/:id", async (req, res) => {
  const [existing] = await db.select({ id: themesTable.id }).from(themesTable).where(and(eq(themesTable.id, req.params.id), eq(themesTable.tenantId, req.user!.tenantId))).limit(1);
  if (!existing) { res.status(404).json({ error: "Theme not found" }); return; }
  await db.delete(themesTable).where(eq(themesTable.id, req.params.id));
  res.status(204).send();
});

export default router;
