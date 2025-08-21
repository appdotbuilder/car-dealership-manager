import { db } from '../db';
import { transactionsTable, carUnitsTable, auditLogsTable } from '../db/schema';
import { type UpdateTransactionInput, type Transaction } from '../schema';
import { eq, and } from 'drizzle-orm';

export const updateTransaction = async (input: UpdateTransactionInput): Promise<Transaction> => {
  try {
    // First, get the current transaction data for audit logging and validation
    const existingTransaction = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, input.id))
      .execute();

    if (existingTransaction.length === 0) {
      throw new Error(`Transaction with id ${input.id} not found`);
    }

    const currentTransaction = existingTransaction[0];
    
    // Validate that car_id exists if being updated
    if (input.car_id && input.car_id !== currentTransaction.car_id) {
      const carExists = await db.select()
        .from(carUnitsTable)
        .where(eq(carUnitsTable.id, input.car_id))
        .execute();

      if (carExists.length === 0) {
        throw new Error(`Car with id ${input.car_id} not found`);
      }
    }

    // Build update data, only including provided fields
    const updateData: any = {
      updated_at: new Date()
    };

    if (input.car_id !== undefined) updateData.car_id = input.car_id;
    if (input.partner_id !== undefined) updateData.partner_id = input.partner_id;
    if (input.type !== undefined) updateData.type = input.type;
    if (input.amount !== undefined) updateData.amount = input.amount.toString();
    if (input.percentage !== undefined) updateData.percentage = input.percentage !== null ? input.percentage.toString() : null;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.date !== undefined) updateData.date = input.date;

    // Update the transaction
    const result = await db.update(transactionsTable)
      .set(updateData)
      .where(eq(transactionsTable.id, input.id))
      .returning()
      .execute();

    const updatedTransaction = result[0];

    // Handle sold_price recalculation for sale_income transactions
    const oldType = currentTransaction.type;
    const newType = input.type || oldType;
    const carId = input.car_id || currentTransaction.car_id;

    if (oldType === 'sale_income' || newType === 'sale_income') {
      await recalculateSoldPrice(carId);
    }

    // Create audit log entry
    await db.insert(auditLogsTable)
      .values({
        actor: 'system', // In a real app, this would come from the authenticated user
        entity_type: 'transaction',
        entity_id: input.id,
        action: 'update',
        before_data: {
          car_id: currentTransaction.car_id,
          partner_id: currentTransaction.partner_id,
          type: currentTransaction.type,
          amount: parseFloat(currentTransaction.amount),
          percentage: currentTransaction.percentage ? parseFloat(currentTransaction.percentage) : null,
          description: currentTransaction.description,
          date: currentTransaction.date
        },
        after_data: {
          car_id: updatedTransaction.car_id,
          partner_id: updatedTransaction.partner_id,
          type: updatedTransaction.type,
          amount: parseFloat(updatedTransaction.amount),
          percentage: updatedTransaction.percentage ? parseFloat(updatedTransaction.percentage) : null,
          description: updatedTransaction.description,
          date: updatedTransaction.date
        }
      })
      .execute();

    // Convert numeric fields back to numbers
    return {
      ...updatedTransaction,
      amount: parseFloat(updatedTransaction.amount),
      percentage: updatedTransaction.percentage ? parseFloat(updatedTransaction.percentage) : null
    };
  } catch (error) {
    console.error('Transaction update failed:', error);
    throw error;
  }
};

async function recalculateSoldPrice(carId: number): Promise<void> {
  // Get all sale_income transactions for this car
  const saleTransactions = await db.select()
    .from(transactionsTable)
    .where(and(
      eq(transactionsTable.car_id, carId),
      eq(transactionsTable.type, 'sale_income')
    ))
    .execute();

  // Calculate total sale income
  const totalSaleIncome = saleTransactions.reduce((sum, transaction) => {
    return sum + parseFloat(transaction.amount);
  }, 0);

  // Update car's sold_price (null if no sale income)
  const soldPrice = totalSaleIncome > 0 ? totalSaleIncome : null;

  await db.update(carUnitsTable)
    .set({
      sold_price: soldPrice?.toString(),
      updated_at: new Date()
    })
    .where(eq(carUnitsTable.id, carId))
    .execute();
}