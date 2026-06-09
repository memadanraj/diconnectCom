import bcrypt from "bcryptjs";
import {
  db,
  tenantsTable,
  usersTable,
  categoriesTable,
  productsTable,
  customersTable,
  discountsTable,
  ordersTable,
  orderItemsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";

async function main() {
  console.log("🌱 Seeding demo data…");

  const DEMO_EMAIL = "demo@commerce.os";
  const DEMO_PASSWORD = "demo1234";

  const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, DEMO_EMAIL)).limit(1);
  if (existing.length > 0) {
    console.log("✅ Demo user already exists — skipping.");
    process.exit(0);
  }

  const [tenant] = await db.insert(tenantsTable).values({
    name: "Demo Store",
    slug: "demo-store",
    plan: "pro",
    status: "active",
    email: DEMO_EMAIL,
  }).returning();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  await db.insert(usersTable).values({
    tenantId: tenant.id,
    email: DEMO_EMAIL,
    passwordHash,
    name: "Demo Merchant",
    role: "TENANT_OWNER",
  });

  const [electronics] = await db.insert(categoriesTable).values({ tenantId: tenant.id, name: "Electronics", slug: "electronics" }).returning();
  const [clothing] = await db.insert(categoriesTable).values({ tenantId: tenant.id, name: "Clothing", slug: "clothing" }).returning();
  await db.insert(categoriesTable).values({ tenantId: tenant.id, name: "Home & Garden", slug: "home-garden" });

  const productData = [
    { tenantId: tenant.id, categoryId: electronics.id, name: "Wireless Earbuds Pro", slug: "wireless-earbuds-pro", price: "4999", sku: "EARB-001", status: "active", stock: 45, imageUrl: "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400" },
    { tenantId: tenant.id, categoryId: electronics.id, name: "Smart Watch Series 5", slug: "smart-watch-series-5", price: "14999", sku: "WTCH-005", status: "active", stock: 23, imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400" },
    { tenantId: tenant.id, categoryId: electronics.id, name: "USB-C Hub 7-in-1", slug: "usb-c-hub-7in1", price: "2499", sku: "HUB-007", status: "active", stock: 88, imageUrl: "https://images.unsplash.com/photo-1625723894011-1a0c2a9f94e5?w=400" },
    { tenantId: tenant.id, categoryId: clothing.id, name: "Premium Cotton T-Shirt", slug: "premium-cotton-tshirt", price: "899", sku: "TSHT-001", status: "active", stock: 150, imageUrl: "https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=400" },
    { tenantId: tenant.id, categoryId: clothing.id, name: "Slim Fit Chinos", slug: "slim-fit-chinos", price: "2499", sku: "CHNO-002", status: "active", stock: 60, imageUrl: "https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=400" },
  ];
  const products = await db.insert(productsTable).values(productData).returning();

  const customerData = [
    { tenantId: tenant.id, email: "alice@example.com", firstName: "Alice", lastName: "Johnson", phone: "+1-555-0101", totalOrders: 5, totalSpent: "24500", tags: ["vip", "loyal"] },
    { tenantId: tenant.id, email: "bob@example.com", firstName: "Bob", lastName: "Smith", phone: "+1-555-0102", totalOrders: 2, totalSpent: "8999", tags: [] },
    { tenantId: tenant.id, email: "carol@example.com", firstName: "Carol", lastName: "Williams", totalOrders: 8, totalSpent: "51200", tags: ["vip", "wholesale"] },
    { tenantId: tenant.id, email: "dave@example.com", firstName: "Dave", lastName: "Brown", totalOrders: 1, totalSpent: "2499", tags: ["new"] },
    { tenantId: tenant.id, email: "eve@example.com", firstName: "Eve", lastName: "Davis", phone: "+1-555-0105", totalOrders: 3, totalSpent: "15600", tags: [] },
  ];
  await db.insert(customersTable).values(customerData);

  await db.insert(discountsTable).values([
    { tenantId: tenant.id, code: "WELCOME10", type: "percentage", value: "10", usageLimit: 100, usageCount: 12, isActive: true, description: "10% off for new customers" },
    { tenantId: tenant.id, code: "FLAT500", type: "fixed", value: "500", usageLimit: 50, usageCount: 5, isActive: true, description: "Rs 500 off on any order" },
    { tenantId: tenant.id, code: "SUMMER25", type: "percentage", value: "25", minOrderAmount: "5000", usageLimit: 200, usageCount: 0, isActive: true, description: "25% off — summer sale" },
  ]);

  const statuses = ["delivered", "delivered", "shipped", "pending", "confirmed"];
  for (let i = 0; i < 5; i++) {
    const p = products[i % products.length];
    const [order] = await db.insert(ordersTable).values({
      tenantId: tenant.id,
      orderNumber: `ORD-${String(1000 + i + 1).padStart(5, "0")}`,
      status: statuses[i],
      customerName: customerData[i].firstName + " " + customerData[i].lastName,
      customerEmail: customerData[i].email,
      subtotal: String(parseFloat(p.price) * (i + 1)),
      discount: "0",
      shippingFee: "150",
      tax: "0",
      total: String(parseFloat(p.price) * (i + 1) + 150),
      currency: "NPR",
    }).returning();
    await db.insert(orderItemsTable).values({
      orderId: order.id,
      tenantId: tenant.id,
      productId: p.id,
      productName: p.name,
      sku: p.sku ?? "",
      unitPrice: p.price,
      quantity: i + 1,
      totalPrice: String(parseFloat(p.price) * (i + 1)),
    });
  }

  console.log(`✅ Seeded successfully!`);
  console.log(`   Login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
