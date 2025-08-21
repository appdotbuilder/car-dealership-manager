import { 
  serial, 
  text, 
  pgTable, 
  timestamp, 
  numeric, 
  integer, 
  boolean,
  json,
  pgEnum
} from 'drizzle-orm/pg-core';
import { relations as defineRelations } from 'drizzle-orm';

// Enums
export const unitStatusEnum = pgEnum('unit_status', [
  'draft', 'bought', 'recond', 'ready', 'listed', 'sold', 'archived'
]);

export const transmissionEnum = pgEnum('transmission', [
  'manual', 'automatic', 'cvt'
]);

export const partnerTypeEnum = pgEnum('partner_type', [
  'broker', 'workshop', 'salon', 'transport', 'other'
]);

export const transactionTypeEnum = pgEnum('transaction_type', [
  'acquisition', 'broker_fee', 'workshop', 'detailing', 'transport',
  'admin', 'tax', 'other_expense', 'sale_income', 'other_income'
]);

export const auditActionEnum = pgEnum('audit_action', [
  'create', 'update', 'delete', 'status_change'
]);

// Partners table
export const partnersTable = pgTable('partners', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  type: partnerTypeEnum('type').notNull(),
  contact_info: text('contact_info'),
  is_active: boolean('is_active').default(true).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Car units table
export const carUnitsTable = pgTable('car_units', {
  id: serial('id').primaryKey(),
  brand: text('brand').notNull(),
  model: text('model').notNull(),
  year: integer('year').notNull(),
  transmission: transmissionEnum('transmission').notNull(),
  odometer: integer('odometer').notNull(),
  color: text('color').notNull(),
  vin: text('vin'),
  stock_code: text('stock_code').notNull().unique(),
  location: text('location'),
  notes: text('notes'),
  primary_photo_url: text('primary_photo_url'),
  gallery_urls: json('gallery_urls').$type<string[]>(),
  documents: json('documents').$type<string[]>(),
  status: unitStatusEnum('status').default('draft').notNull(),
  sold_price: numeric('sold_price', { precision: 12, scale: 2 }),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Transactions table
export const transactionsTable = pgTable('transactions', {
  id: serial('id').primaryKey(),
  car_id: integer('car_id').references(() => carUnitsTable.id).notNull(),
  partner_id: integer('partner_id').references(() => partnersTable.id),
  type: transactionTypeEnum('type').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  percentage: numeric('percentage', { precision: 5, scale: 2 }),
  description: text('description'),
  date: timestamp('date').defaultNow().notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Audit logs table
export const auditLogsTable = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  actor: text('actor').notNull(),
  entity_type: text('entity_type').notNull(),
  entity_id: integer('entity_id').notNull(),
  action: auditActionEnum('action').notNull(),
  before_data: json('before_data'),
  after_data: json('after_data'),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Relations
export const partnersRelations = defineRelations(partnersTable, ({ many }) => ({
  transactions: many(transactionsTable)
}));

export const carUnitsRelations = defineRelations(carUnitsTable, ({ many }) => ({
  transactions: many(transactionsTable)
}));

export const transactionsRelations = defineRelations(transactionsTable, ({ one }) => ({
  car: one(carUnitsTable, {
    fields: [transactionsTable.car_id],
    references: [carUnitsTable.id]
  }),
  partner: one(partnersTable, {
    fields: [transactionsTable.partner_id],
    references: [partnersTable.id]
  })
}));

// TypeScript types for the table schemas
export type Partner = typeof partnersTable.$inferSelect;
export type NewPartner = typeof partnersTable.$inferInsert;

export type CarUnit = typeof carUnitsTable.$inferSelect;
export type NewCarUnit = typeof carUnitsTable.$inferInsert;

export type Transaction = typeof transactionsTable.$inferSelect;
export type NewTransaction = typeof transactionsTable.$inferInsert;

export type AuditLog = typeof auditLogsTable.$inferSelect;
export type NewAuditLog = typeof auditLogsTable.$inferInsert;

// Export all tables and relations for proper query building
export const tables = {
  partners: partnersTable,
  carUnits: carUnitsTable,
  transactions: transactionsTable,
  auditLogs: auditLogsTable
};

export const schemaRelations = {
  partnersRelations,
  carUnitsRelations,
  transactionsRelations
};