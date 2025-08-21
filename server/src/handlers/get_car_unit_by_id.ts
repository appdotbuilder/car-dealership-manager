import { db } from '../db';
import { carUnitsTable } from '../db/schema';
import { type CarUnit } from '../schema';
import { eq } from 'drizzle-orm';

export const getCarUnitById = async (carId: number): Promise<CarUnit | null> => {
  try {
    // Query car unit by ID
    const results = await db.select()
      .from(carUnitsTable)
      .where(eq(carUnitsTable.id, carId))
      .execute();

    // Return null if no car unit found
    if (results.length === 0) {
      return null;
    }

    const carUnit = results[0];

    // Convert numeric fields back to numbers and ensure proper typing
    return {
      ...carUnit,
      sold_price: carUnit.sold_price ? parseFloat(carUnit.sold_price) : null,
      gallery_urls: carUnit.gallery_urls || null,
      documents: carUnit.documents || null
    };
  } catch (error) {
    console.error('Car unit retrieval failed:', error);
    throw error;
  }
};