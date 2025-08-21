import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';

// Import schemas
import {
  createPartnerInputSchema,
  updatePartnerInputSchema,
  createCarUnitInputSchema,
  updateCarUnitInputSchema,
  changeStatusInputSchema,
  createTransactionInputSchema,
  updateTransactionInputSchema,
  inventoryFilterSchema,
  reportFilterSchema,
  createAuditLogInputSchema
} from './schema';

// Import handlers - Partners
import { createPartner } from './handlers/create_partner';
import { getPartners } from './handlers/get_partners';
import { updatePartner } from './handlers/update_partner';
import { deletePartner } from './handlers/delete_partner';

// Import handlers - Car Units
import { createCarUnit } from './handlers/create_car_unit';
import { getCarUnits } from './handlers/get_car_units';
import { getCarUnitById } from './handlers/get_car_unit_by_id';
import { updateCarUnit } from './handlers/update_car_unit';
import { changeCarStatus } from './handlers/change_car_status';
import { duplicateCarUnit } from './handlers/duplicate_car_unit';
import { archiveCarUnit } from './handlers/archive_car_unit';

// Import handlers - Transactions
import { createTransaction } from './handlers/create_transaction';
import { getTransactionsByCarId, getAllTransactions } from './handlers/get_transactions';
import { updateTransaction } from './handlers/update_transaction';
import { deleteTransaction } from './handlers/delete_transaction';

// Import handlers - Financial
import { getFinancialSummaryByCarId, getAllFinancialSummaries } from './handlers/get_financial_summary';
import { getDashboardKpis } from './handlers/get_dashboard_kpis';

// Import handlers - Reports
import { getProfitReport, getExpenseReport, getStockAgingReport } from './handlers/get_reports';
import { exportInventoryToCsv, exportTransactionsToCsv, exportProfitReportToCsv } from './handlers/export_data';

// Import handlers - Audit
import { createAuditLog, getAuditLogs } from './handlers/audit_logs';

import { z } from 'zod';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Partner management
  createPartner: publicProcedure
    .input(createPartnerInputSchema)
    .mutation(({ input }) => createPartner(input)),

  getPartners: publicProcedure
    .query(() => getPartners()),

  updatePartner: publicProcedure
    .input(updatePartnerInputSchema)
    .mutation(({ input }) => updatePartner(input)),

  deletePartner: publicProcedure
    .input(z.object({ partnerId: z.number() }))
    .mutation(({ input }) => deletePartner(input.partnerId)),

  // Car unit management
  createCarUnit: publicProcedure
    .input(createCarUnitInputSchema)
    .mutation(({ input }) => createCarUnit(input)),

  getCarUnits: publicProcedure
    .input(inventoryFilterSchema.optional())
    .query(({ input }) => getCarUnits(input)),

  getCarUnitById: publicProcedure
    .input(z.object({ carId: z.number() }))
    .query(({ input }) => getCarUnitById(input.carId)),

  updateCarUnit: publicProcedure
    .input(updateCarUnitInputSchema)
    .mutation(({ input }) => updateCarUnit(input)),

  changeCarStatus: publicProcedure
    .input(changeStatusInputSchema)
    .mutation(({ input }) => changeCarStatus(input)),

  duplicateCarUnit: publicProcedure
    .input(z.object({ carId: z.number() }))
    .mutation(({ input }) => duplicateCarUnit(input.carId)),

  archiveCarUnit: publicProcedure
    .input(z.object({ carId: z.number() }))
    .mutation(({ input }) => archiveCarUnit(input.carId)),

  // Transaction management
  createTransaction: publicProcedure
    .input(createTransactionInputSchema)
    .mutation(({ input }) => createTransaction(input)),

  getTransactionsByCarId: publicProcedure
    .input(z.object({ carId: z.number() }))
    .query(({ input }) => getTransactionsByCarId(input.carId)),

  getAllTransactions: publicProcedure
    .query(() => getAllTransactions()),

  updateTransaction: publicProcedure
    .input(updateTransactionInputSchema)
    .mutation(({ input }) => updateTransaction(input)),

  deleteTransaction: publicProcedure
    .input(z.object({ transactionId: z.number() }))
    .mutation(({ input }) => deleteTransaction(input.transactionId)),

  // Financial summaries
  getFinancialSummaryByCarId: publicProcedure
    .input(z.object({ carId: z.number() }))
    .query(({ input }) => getFinancialSummaryByCarId(input.carId)),

  getAllFinancialSummaries: publicProcedure
    .query(() => getAllFinancialSummaries()),

  // Dashboard
  getDashboardKpis: publicProcedure
    .query(() => getDashboardKpis()),

  // Reports
  getProfitReport: publicProcedure
    .input(reportFilterSchema)
    .query(({ input }) => getProfitReport(input)),

  getExpenseReport: publicProcedure
    .input(reportFilterSchema)
    .query(({ input }) => getExpenseReport(input)),

  getStockAgingReport: publicProcedure
    .query(() => getStockAgingReport()),

  // Export functions
  exportInventoryToCsv: publicProcedure
    .input(inventoryFilterSchema.optional())
    .query(({ input }) => exportInventoryToCsv(input)),

  exportTransactionsToCsv: publicProcedure
    .input(reportFilterSchema.optional())
    .query(({ input }) => exportTransactionsToCsv(input)),

  exportProfitReportToCsv: publicProcedure
    .input(reportFilterSchema)
    .query(({ input }) => exportProfitReportToCsv(input)),

  // Audit logs
  createAuditLog: publicProcedure
    .input(createAuditLogInputSchema)
    .mutation(({ input }) => createAuditLog(input)),

  getAuditLogs: publicProcedure
    .input(z.object({
      entityType: z.string().optional(),
      entityId: z.number().optional()
    }).optional())
    .query(({ input }) => getAuditLogs(input?.entityType, input?.entityId))
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`Car Dealership Management System TRPC server listening at port: ${port}`);
}

start();