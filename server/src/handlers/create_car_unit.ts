import { db } from '../db';
import { carUnitsTable, auditLogsTable } from '../db/schema';
import { type CreateCarUnitInput, type CarUnit } from '../schema';
import { eq } from 'drizzle-orm';

export async function createCarUnit(input: CreateCarUnitInput): Promise<CarUnit> {
  try {
    // Check if stock_code already exists
    const existingUnit = await db.select()
      .from(carUnitsTable)
      .where(eq(carUnitsTable.stock_code, input.stock_code))
      .limit(1)
      .execute();

    if (existingUnit.length > 0) {
      throw new Error(`Stock code '${input.stock_code}' already exists`);
    }

    // Insert the car unit
    const result = await db.insert(carUnitsTable)
      .values({
        brand: input.brand,
        model: input.model,
        year: input.year,
        transmission: input.transmission,
        odometer: input.odometer,
        color: input.color,
        vin: input.vin || null,
        stock_code: input.stock_code,
        location: input.location || null,
        notes: input.notes || null,
        primary_photo_url: input.primary_photo_url || null,
        gallery_urls: input.gallery_urls || null,
        documents: input.documents || null,
        status: input.status || 'draft',
        sold_price: input.sold_price ? input.sold_price.toString() : null
      })
      .returning()
      .execute();

    const carUnit = result[0];

    // Create audit log entry
    await db.insert(auditLogsTable)
      .values({
        actor: 'system',
        entity_type: 'car_unit',
        entity_id: carUnit.id,
        action: 'create',
        before_data: null,
        after_data: {
          brand: carUnit.brand,
          model: carUnit.model,
          year: carUnit.year,
          transmission: carUnit.transmission,
          odometer: carUnit.odometer,
          color: carUnit.color,
          vin: carUnit.vin,
          stock_code: carUnit.stock_code,
          location: carUnit.location,
          notes: carUnit.notes,
          primary_photo_url: carUnit.primary_photo_url,
          gallery_urls: carUnit.gallery_urls,
          documents: carUnit.documents,
          status: carUnit.status,
          sold_price: carUnit.sold_price
        }
      })
      .execute();

    // Convert numeric fields back to numbers before returning
    return {
      ...carUnit,
      sold_price: carUnit.sold_price ? parseFloat(carUnit.sold_price) : null
    };
  } catch (error) {
    console.error('Car unit creation failed:', error);
    throw error;
  }
}