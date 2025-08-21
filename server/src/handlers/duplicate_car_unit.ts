import { db } from '../db';
import { carUnitsTable, auditLogsTable } from '../db/schema';
import { type CarUnit } from '../schema';
import { eq } from 'drizzle-orm';

export const duplicateCarUnit = async (carId: number): Promise<CarUnit> => {
  try {
    // First, fetch the existing car unit
    const existingCars = await db.select()
      .from(carUnitsTable)
      .where(eq(carUnitsTable.id, carId))
      .execute();

    if (existingCars.length === 0) {
      throw new Error(`Car unit with id ${carId} not found`);
    }

    const originalCar = existingCars[0];

    // Generate a unique stock code
    const timestamp = Date.now();
    const newStockCode = `${originalCar.stock_code}-DUP-${timestamp}`;

    // Create the duplicated car unit (excluding ID, stock_code, status, sold_price)
    const result = await db.insert(carUnitsTable)
      .values({
        brand: originalCar.brand,
        model: originalCar.model,
        year: originalCar.year,
        transmission: originalCar.transmission,
        odometer: originalCar.odometer,
        color: originalCar.color,
        vin: originalCar.vin,
        stock_code: newStockCode,
        location: originalCar.location,
        notes: originalCar.notes,
        primary_photo_url: originalCar.primary_photo_url,
        gallery_urls: originalCar.gallery_urls,
        documents: originalCar.documents,
        status: 'draft', // Always set to draft
        sold_price: null // Don't copy sold_price
      })
      .returning()
      .execute();

    const duplicatedCar = result[0];

    // Create audit log entry for duplication
    await db.insert(auditLogsTable)
      .values({
        actor: 'system',
        entity_type: 'car_unit',
        entity_id: duplicatedCar.id,
        action: 'create',
        before_data: null,
        after_data: {
          action: 'duplicate',
          original_car_id: carId,
          duplicated_car_id: duplicatedCar.id,
          new_stock_code: newStockCode
        }
      })
      .execute();

    // Convert numeric fields back to numbers before returning
    return {
      ...duplicatedCar,
      sold_price: duplicatedCar.sold_price ? parseFloat(duplicatedCar.sold_price) : null
    };
  } catch (error) {
    console.error('Car unit duplication failed:', error);
    throw error;
  }
};