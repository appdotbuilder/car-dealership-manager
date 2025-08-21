import { db } from '../db';
import { transactionsTable, carUnitsTable, auditLogsTable } from '../db/schema';
import { eq, and, sum } from 'drizzle-orm';

export async function deleteTransaction(transactionId: number): Promise<{ success: boolean }> {
  try {
    // First, validate that the transaction exists and get its details
    const existingTransaction = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, transactionId))
      .execute();

    if (existingTransaction.length === 0) {
      throw new Error(`Transaction with ID ${transactionId} not found`);
    }

    const transaction = existingTransaction[0];
    const carId = transaction.car_id;

    // Store the transaction data for audit log
    const beforeData = {
      ...transaction,
      amount: parseFloat(transaction.amount),
      percentage: transaction.percentage ? parseFloat(transaction.percentage) : null
    };

    // Delete the transaction
    await db.delete(transactionsTable)
      .where(eq(transactionsTable.id, transactionId))
      .execute();

    // If this was a sale_income transaction, recalculate the car's sold_price
    if (transaction.type === 'sale_income') {
      // Get all remaining sale_income transactions for this car
      const saleIncomeTransactions = await db.select()
        .from(transactionsTable)
        .where(
          and(
            eq(transactionsTable.car_id, carId),
            eq(transactionsTable.type, 'sale_income')
          )
        )
        .execute();

      // Calculate new sold_price from remaining sale_income transactions
      const newSoldPrice = saleIncomeTransactions.reduce(
        (total, t) => total + parseFloat(t.amount), 
        0
      );

      // Update the car's sold_price (null if no sale_income transactions remain)
      await db.update(carUnitsTable)
        .set({ 
          sold_price: newSoldPrice > 0 ? newSoldPrice.toString() : null,
          updated_at: new Date()
        })
        .where(eq(carUnitsTable.id, carId))
        .execute();
    }

    // Create audit log entry
    await db.insert(auditLogsTable)
      .values({
        actor: 'system', // In a real app, this would be the current user
        entity_type: 'transaction',
        entity_id: transactionId,
        action: 'delete',
        before_data: beforeData,
        after_data: null
      })
      .execute();

    return { success: true };
  } catch (error) {
    console.error('Transaction deletion failed:', error);
    throw error;
  }
}