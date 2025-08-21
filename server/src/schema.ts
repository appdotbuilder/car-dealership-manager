import { z } from 'zod';

// Enums
export const unitStatusEnum = z.enum(['draft', 'bought', 'recond', 'ready', 'listed', 'sold', 'archived']);
export type UnitStatus = z.infer<typeof unitStatusEnum>;

export const transmissionEnum = z.enum(['manual', 'automatic', 'cvt']);
export type Transmission = z.infer<typeof transmissionEnum>;

export const partnerTypeEnum = z.enum(['broker', 'workshop', 'salon', 'transport', 'other']);
export type PartnerType = z.infer<typeof partnerTypeEnum>;

export const transactionTypeEnum = z.enum([
  'acquisition', 'broker_fee', 'workshop', 'detailing', 'transport', 
  'admin', 'tax', 'other_expense', 'sale_income', 'other_income'
]);
export type TransactionType = z.infer<typeof transactionTypeEnum>;

export const auditActionEnum = z.enum(['create', 'update', 'delete', 'status_change']);
export type AuditAction = z.infer<typeof auditActionEnum>;

// Partner schema
export const partnerSchema = z.object({
  id: z.number(),
  name: z.string(),
  type: partnerTypeEnum,
  contact_info: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Partner = z.infer<typeof partnerSchema>;

export const createPartnerInputSchema = z.object({
  name: z.string().min(1),
  type: partnerTypeEnum,
  contact_info: z.string().nullable().optional(),
  is_active: z.boolean().optional()
});

export type CreatePartnerInput = z.infer<typeof createPartnerInputSchema>;

export const updatePartnerInputSchema = z.object({
  id: z.number(),
  name: z.string().min(1).optional(),
  type: partnerTypeEnum.optional(),
  contact_info: z.string().nullable().optional(),
  is_active: z.boolean().optional()
});

export type UpdatePartnerInput = z.infer<typeof updatePartnerInputSchema>;

// Car unit schema
export const carUnitSchema = z.object({
  id: z.number(),
  brand: z.string(),
  model: z.string(),
  year: z.number().int(),
  transmission: transmissionEnum,
  odometer: z.number().int(),
  color: z.string(),
  vin: z.string().nullable(),
  stock_code: z.string(),
  location: z.string().nullable(),
  notes: z.string().nullable(),
  primary_photo_url: z.string().nullable(),
  gallery_urls: z.array(z.string()).nullable(),
  documents: z.array(z.string()).nullable(),
  status: unitStatusEnum,
  sold_price: z.number().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type CarUnit = z.infer<typeof carUnitSchema>;

export const createCarUnitInputSchema = z.object({
  brand: z.string().min(1),
  model: z.string().min(1),
  year: z.number().int().min(1900).max(new Date().getFullYear() + 1),
  transmission: transmissionEnum,
  odometer: z.number().int().nonnegative(),
  color: z.string().min(1),
  vin: z.string().nullable().optional(),
  stock_code: z.string().min(1),
  location: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  primary_photo_url: z.string().nullable().optional(),
  gallery_urls: z.array(z.string()).nullable().optional(),
  documents: z.array(z.string()).nullable().optional(),
  status: unitStatusEnum.optional(),
  sold_price: z.number().positive().nullable().optional()
});

export type CreateCarUnitInput = z.infer<typeof createCarUnitInputSchema>;

export const updateCarUnitInputSchema = z.object({
  id: z.number(),
  brand: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  year: z.number().int().min(1900).max(new Date().getFullYear() + 1).optional(),
  transmission: transmissionEnum.optional(),
  odometer: z.number().int().nonnegative().optional(),
  color: z.string().min(1).optional(),
  vin: z.string().nullable().optional(),
  stock_code: z.string().min(1).optional(),
  location: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  primary_photo_url: z.string().nullable().optional(),
  gallery_urls: z.array(z.string()).nullable().optional(),
  documents: z.array(z.string()).nullable().optional(),
  status: unitStatusEnum.optional(),
  sold_price: z.number().positive().nullable().optional()
});

export type UpdateCarUnitInput = z.infer<typeof updateCarUnitInputSchema>;

// Transaction schema
export const transactionSchema = z.object({
  id: z.number(),
  car_id: z.number(),
  partner_id: z.number().nullable(),
  type: transactionTypeEnum,
  amount: z.number(),
  percentage: z.number().nullable(),
  description: z.string().nullable(),
  date: z.coerce.date(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Transaction = z.infer<typeof transactionSchema>;

export const createTransactionInputSchema = z.object({
  car_id: z.number(),
  partner_id: z.number().nullable().optional(),
  type: transactionTypeEnum,
  amount: z.number(),
  percentage: z.number().nullable().optional(),
  description: z.string().nullable().optional(),
  date: z.coerce.date().optional()
});

export type CreateTransactionInput = z.infer<typeof createTransactionInputSchema>;

export const updateTransactionInputSchema = z.object({
  id: z.number(),
  car_id: z.number().optional(),
  partner_id: z.number().nullable().optional(),
  type: transactionTypeEnum.optional(),
  amount: z.number().optional(),
  percentage: z.number().nullable().optional(),
  description: z.string().nullable().optional(),
  date: z.coerce.date().optional()
});

export type UpdateTransactionInput = z.infer<typeof updateTransactionInputSchema>;

// Audit log schema
export const auditLogSchema = z.object({
  id: z.number(),
  actor: z.string(),
  entity_type: z.string(),
  entity_id: z.number(),
  action: auditActionEnum,
  before_data: z.record(z.any()).nullable(),
  after_data: z.record(z.any()).nullable(),
  created_at: z.coerce.date()
});

export type AuditLog = z.infer<typeof auditLogSchema>;

export const createAuditLogInputSchema = z.object({
  actor: z.string(),
  entity_type: z.string(),
  entity_id: z.number(),
  action: auditActionEnum,
  before_data: z.record(z.any()).nullable().optional(),
  after_data: z.record(z.any()).nullable().optional()
});

export type CreateAuditLogInput = z.infer<typeof createAuditLogInputSchema>;

// Financial summary schema (computed)
export const financialSummarySchema = z.object({
  car_id: z.number(),
  total_acquisition: z.number(),
  total_expenses: z.number(),
  total_incomes: z.number(),
  profit: z.number(),
  sold_price: z.number().nullable()
});

export type FinancialSummary = z.infer<typeof financialSummarySchema>;

// Report schemas
export const reportFilterSchema = z.object({
  start_date: z.coerce.date().optional(),
  end_date: z.coerce.date().optional(),
  status: unitStatusEnum.optional(),
  partner_id: z.number().optional()
});

export type ReportFilter = z.infer<typeof reportFilterSchema>;

export const profitReportSchema = z.object({
  total_profit: z.number(),
  average_profit_per_unit: z.number(),
  units_sold: z.number(),
  period_start: z.coerce.date(),
  period_end: z.coerce.date()
});

export type ProfitReport = z.infer<typeof profitReportSchema>;

export const expenseReportItemSchema = z.object({
  category: transactionTypeEnum,
  partner_name: z.string().nullable(),
  total_amount: z.number(),
  transaction_count: z.number()
});

export type ExpenseReportItem = z.infer<typeof expenseReportItemSchema>;

// Dashboard KPI schema
export const dashboardKpiSchema = z.object({
  active_stock_count: z.number(),
  average_days_to_sale: z.number().nullable(),
  total_period_profit: z.number(),
  top_profit_unit: z.object({
    id: z.number(),
    brand: z.string(),
    model: z.string(),
    profit: z.number()
  }).nullable(),
  bottom_profit_unit: z.object({
    id: z.number(),
    brand: z.string(),
    model: z.string(),
    profit: z.number()
  }).nullable()
});

export type DashboardKpi = z.infer<typeof dashboardKpiSchema>;

// Inventory filter schema
export const inventoryFilterSchema = z.object({
  status: unitStatusEnum.optional(),
  year_min: z.number().int().optional(),
  year_max: z.number().int().optional(),
  transmission: transmissionEnum.optional(),
  price_min: z.number().optional(),
  price_max: z.number().optional(),
  partner_id: z.number().optional(),
  search: z.string().optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).optional()
});

export type InventoryFilter = z.infer<typeof inventoryFilterSchema>;

// Status change input schema
export const changeStatusInputSchema = z.object({
  car_id: z.number(),
  new_status: unitStatusEnum,
  notes: z.string().optional()
});

export type ChangeStatusInput = z.infer<typeof changeStatusInputSchema>;