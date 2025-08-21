import { db } from '../db';
import { transactionsTable, partnersTable, carUnitsTable } from '../db/schema';
import { type Transaction } from '../schema';
import { eq, desc } from 'drizzle-orm';

export async function getTransactionsByCarId(carId: number): Promise<Transaction[]> {
  try {
    // Query transactions for a specific car, ordered by date (newest first)
    const results = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.car_id, carId))
      .orderBy(desc(transactionsTable.date))
      .execute();

    // Convert numeric fields back to numbers
    return results.map(transaction => ({
      ...transaction,
      amount: parseFloat(transaction.amount),
      percentage: transaction.percentage ? parseFloat(transaction.percentage) : null
    }));
  } catch (error) {
    console.error('Failed to get transactions by car ID:', error);
    throw error;
  }
}

export async function getAllTransactions(): Promise<Transaction[]> {
  try {
    // Query all transactions ordered by date (newest first)
    const results = await db.select()
      .from(transactionsTable)
      .orderBy(desc(transactionsTable.date))
      .execute();

    // Convert numeric fields back to numbers
    return results.map(transaction => ({
      ...transaction,
      amount: parseFloat(transaction.amount),
      percentage: transaction.percentage ? parseFloat(transaction.percentage) : null
    }));
  } catch (error) {
    console.error('Failed to get all transactions:', error);
    throw error;
  }
}