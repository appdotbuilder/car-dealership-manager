import { db } from '../db';
import { partnersTable } from '../db/schema';
import { type Partner, type PartnerType } from '../schema';
import { eq, and, type SQL } from 'drizzle-orm';

export interface GetPartnersFilters {
  type?: PartnerType;
  is_active?: boolean;
}

export async function getPartners(filters?: GetPartnersFilters): Promise<Partner[]> {
  try {
    // Build conditions array for filtering
    const conditions: SQL<unknown>[] = [];

    if (filters?.type) {
      conditions.push(eq(partnersTable.type, filters.type));
    }

    if (filters?.is_active !== undefined) {
      conditions.push(eq(partnersTable.is_active, filters.is_active));
    }

    // Build query with conditional where clause
    const query = conditions.length === 0 
      ? db.select().from(partnersTable)
      : db.select().from(partnersTable).where(
          conditions.length === 1 ? conditions[0] : and(...conditions)
        );

    // Execute query and return results
    const results = await query.execute();
    
    return results;
  } catch (error) {
    console.error('Failed to fetch partners:', error);
    throw error;
  }
}