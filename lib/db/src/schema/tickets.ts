import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { customersTable } from "./customers";
import { ordersTable } from "./orders";
import { usersTable } from "./users";

export const supportTicketsTable = pgTable("support_tickets", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  tenantId: text("tenant_id").notNull().references(() => tenantsTable.id),
  customerId: text("customer_id").references(() => customersTable.id),
  orderId: text("order_id").references(() => ordersTable.id),
  assignedTo: text("assigned_to").references(() => usersTable.id),
  subject: text("subject").notNull(),
  status: text("status").notNull().default("open"),
  priority: text("priority").notNull().default("normal"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const ticketMessagesTable = pgTable("ticket_messages", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  ticketId: text("ticket_id").notNull().references(() => supportTicketsTable.id),
  senderType: text("sender_type").notNull().default("staff"),
  senderId: text("sender_id").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SupportTicket = typeof supportTicketsTable.$inferSelect;
export type TicketMessage = typeof ticketMessagesTable.$inferSelect;
