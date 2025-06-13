import { supabase } from './supabaseClient';
import type { Scheme, Payment, PaymentMode, SchemeStatus, PaymentStatus as PaymentStatusType } from '@/types/scheme';
import {
  getSchemeStatus,
  calculateSchemeTotals,
  getPaymentStatus,
  generatePaymentsForScheme // Assuming this generates payment objects based on scheme props
} from '@/lib/utils';

// Helper to convert DB snake_case object to camelCase TypeScript object
const toCamelCase = (obj: any): any => {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(toCamelCase);
  }
  return Object.keys(obj).reduce((acc: any, key: string) => {
    const camelKey = key.replace(/([-_][a-z])/gi, ($1) =>
      $1.toUpperCase().replace('-', '').replace('_', '')
    );
    acc[camelKey] = toCamelCase(obj[key]);
    return acc;
  }, {});
};

// Helper to convert camelCase TS object to snake_case for DB
const toSnakeCase = (obj: any): any => {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(toSnakeCase);
  }
  return Object.keys(obj).reduce((acc: any, key: string) => {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    acc[snakeKey] = toSnakeCase(obj[key]);
    return acc;
  }, {});
};


export const getSupabasePaymentsForScheme = async (schemeId: string): Promise<Payment[]> => {
  try {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('scheme_id', schemeId)
      .order('month_number', { ascending: true });

    if (error) {
      console.error(`Error fetching payments for scheme ${schemeId}:`, error);
      throw error;
    }
    if (!data) return [];
    return data.map((dbPayment: any) => {
      const camelPayment = toCamelCase(dbPayment) as any;
      return {
        ...camelPayment,
        id: dbPayment.id,
        schemeId: dbPayment.scheme_id,
        modeOfPayment: Array.isArray(camelPayment.modeOfPayment) ? camelPayment.modeOfPayment : (camelPayment.modeOfPayment ? [camelPayment.modeOfPayment] : []),
        isArchived: camelPayment.isArchived ?? false,
      } as Payment;
    });
  } catch (error) {
    console.error(`An unexpected error occurred in getSupabasePaymentsForScheme for scheme ${schemeId}:`, error);
    return [];
  }
};

export const getSupabaseSchemesByGroup = async (groupName: string): Promise<Scheme[]> => {
  try {
    let query = supabase.from('schemes').select(`
      id, customer_name, customer_phone, customer_address, customer_group_name,
      start_date, monthly_payment_amount, duration_months, status,
      closure_date, archived_date
    `)
    .eq('customer_group_name', groupName)
    .not('status', 'in', '("Archived", "Closed")'); // Filter out Archived and Closed

    query = query.order('start_date', { ascending: false });

    const { data: schemesData, error: schemesError } = await query;

    if (schemesError) throw schemesError;
    if (!schemesData) return [];

    // Reuse the same detailing logic as getSupabaseSchemes
    const detailedSchemes = await Promise.all(
      schemesData.map(async (dbSchemeRow: any) => {
        const dbScheme = toCamelCase(dbSchemeRow) as any;
        const payments = await getSupabasePaymentsForScheme(dbScheme.id);
        const processedPayments = payments.map(p => ({
          ...p,
          status: getPaymentStatus(p, dbScheme.startDate)
        }));
        const tempScheme: Scheme = {
          ...dbScheme,
          payments: processedPayments,
          totalAmountExpected: 0, totalAmountPaid: 0, totalBalance: 0,
          paymentsMadeCount: 0, paymentsPendingCount: 0, nextDueDate: undefined,
          isOverdue: false, daysOverdue: 0,
        };
        const totals = calculateSchemeTotals(tempScheme);
        const currentStatus = getSchemeStatus(tempScheme);
        return { ...tempScheme, ...totals, status: currentStatus };
      })
    );
    return detailedSchemes;
  } catch (error) {
    console.error(`Error fetching schemes for group ${groupName}:`, error);
    return [];
  }
};

export const recordSupabaseBatchPaymentsForGroup = async (
  groupName: string,
  paymentDate: string, // ISO String
  modeOfPayment: PaymentMode[]
): Promise<{ successCount: number; errorCount: number; details: Array<{schemeId: string, paymentId?: string, customerName: string, status: string, error?: string}> }> => {
  let successCount = 0;
  let errorCount = 0;
  const details: Array<{schemeId: string, paymentId?: string, customerName: string, status: string, error?: string}> = [];

  try {
    const schemesInGroup = await getSupabaseSchemesByGroup(groupName);

    for (const scheme of schemesInGroup) {
      if (scheme.status === 'Closed' || scheme.status === 'Fully Paid' || scheme.status === 'Completed' || scheme.status === 'Archived' || scheme.status === 'Upcoming') {
        details.push({schemeId: scheme.id, customerName: scheme.customerName, status: 'Skipped - Scheme not active/overdue'});
        continue; // Skip non-active/overdue schemes
      }

      // Find the first non-paid payment installment
      const nextDuePayment = scheme.payments
        .filter(p => !p.isArchived)
        .sort((a,b) => a.monthNumber - b.monthNumber)
        .find(p => getPaymentStatus(p, scheme.startDate) !== 'Paid');

      if (nextDuePayment) {
        try {
          const updatedPayment = await updateSupabasePayment(nextDuePayment.id, {
            amountPaid: nextDuePayment.amountExpected,
            paymentDate: paymentDate, // Ensure ISO string
            modeOfPayment: modeOfPayment,
            // Status will be updated by getSupabaseSchemeById or similar when data is refetched
          });
          if (updatedPayment) {
            successCount++;
            details.push({schemeId: scheme.id, paymentId: nextDuePayment.id, customerName: scheme.customerName, status: 'Paid'});
          } else {
            errorCount++;
            details.push({schemeId: scheme.id, paymentId: nextDuePayment.id, customerName: scheme.customerName, status: 'Error', error: 'Update failed'});
          }
        } catch (err: any) {
          errorCount++;
          details.push({schemeId: scheme.id, paymentId: nextDuePayment.id, customerName: scheme.customerName, status: 'Error', error: err.message || 'Unknown error'});
          console.error(`Error updating payment ${nextDuePayment.id} for scheme ${scheme.id}:`, err);
        }
      } else {
         details.push({schemeId: scheme.id, customerName: scheme.customerName, status: 'Skipped - No due payment found'});
      }
    }
    return { successCount, errorCount, details };
  } catch (error) {
    console.error(`Error in recordSupabaseBatchPaymentsForGroup for group ${groupName}:`, error);
    return { successCount, errorCount, details }; // Return current counts on outer error
  }
};

export interface SupabaseArchivedPayment extends Payment {
  customerName?: string;
  schemeCustomerGroupName?: string;
  schemeStartDate?: string;
}

export const getSupabaseArchivedPayments = async (): Promise<SupabaseArchivedPayment[]> => {
  try {
    const { data, error } = await supabase
      .from('payments')
      .select(`
        *,
        schemes (
          customer_name,
          customer_group_name,
          start_date
        )
      `)
      .eq('is_archived', true)
      .order('archived_date', { ascending: false });

    if (error) {
      console.error('Error fetching archived payments:', error);
      throw error;
    }
    if (!data) return [];

    return data.map((p: any) => {
      const schemeData = p.schemes ? toCamelCase(p.schemes) : {};
      return {
        ...toCamelCase(p), // Converts all payment fields
        id: p.id, // ensure id is preserved if toCamelCase messes it up
        schemeId: p.scheme_id,
        customerName: schemeData.customerName,
        schemeCustomerGroupName: schemeData.customerGroupName,
        schemeStartDate: schemeData.startDate,
        // Remove the nested schemes object from the final flat structure
        schemes: undefined,
      } as SupabaseArchivedPayment;
    });
  } catch (error) {
    console.error('Unexpected error in getSupabaseArchivedPayments:', error);
    return [];
  }
};

export const unarchiveSupabasePayment = async (paymentId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('payments')
      .update({ is_archived: false, archived_date: null })
      .eq('id', paymentId);

    if (error) {
      console.error(`Error unarchiving payment ${paymentId}:`, error);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`Unexpected error in unarchiveSupabasePayment for ${paymentId}:`, error);
    return false;
  }
};

export const deleteSupabaseArchivedPayment = async (paymentId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('payments')
      .delete()
      .eq('id', paymentId)
      .eq('is_archived', true); // Extra safety: only delete if it's indeed archived

    if (error) {
      console.error(`Error deleting archived payment ${paymentId}:`, error);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`Unexpected error in deleteSupabaseArchivedPayment for ${paymentId}:`, error);
    return false;
  }
};

// Define a type for ArchivedGroupInfo based on your table and needs
// This should ideally match or be similar to what src/types/scheme.ts might have/need
export interface SupabaseArchivedGroup {
  id: string; // UUID from archived_groups table
  name: string;
  archivedDate: string; // TIMESTAMPTZ from DB
  originalSchemeCount: number;
  // Add other fields if you select more from archived_group_schemes later
}

export const getSupabaseArchivedGroups = async (): Promise<SupabaseArchivedGroup[]> => {
  try {
    const { data, error } = await supabase
      .from('archived_groups') // Your table name
      .select('id, name, archived_date, original_scheme_count')
      .order('archived_date', { ascending: false });

    if (error) {
      console.error('Error fetching archived groups:', error);
      throw error;
    }
    if (!data) return [];

    return data.map(g => ({
      id: g.id,
      name: g.name,
      archivedDate: g.archived_date,
      originalSchemeCount: g.original_scheme_count,
    }));
  } catch (error) {
    console.error('Unexpected error in getSupabaseArchivedGroups:', error);
    return [];
  }
};

export const unarchiveSupabaseGroup = async (archivedGroupId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('archived_groups')
      .delete()
      .eq('id', archivedGroupId);

    if (error) {
      console.error(`Error unarchiving group ${archivedGroupId}:`, error);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`Unexpected error in unarchiveSupabaseGroup for ${archivedGroupId}:`, error);
    return false;
  }
};

export const deleteSupabaseArchivedGroup = async (archivedGroupId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('archived_groups')
      .delete()
      .eq('id', archivedGroupId);
    // Note: Supabase ON DELETE CASCADE should handle related archived_group_schemes entries.

    if (error) {
      console.error(`Error deleting archived group ${archivedGroupId}:`, error);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`Unexpected error in deleteSupabaseArchivedGroup for ${archivedGroupId}:`, error);
    return false;
  }
};

export const getArchivedSupabaseSchemes = async (): Promise<Scheme[]> => {
  try {
    // Fetch schemes explicitly marked as 'Archived' OR having an archived_date
    // This ensures schemes moved to trash via various UI paths are caught.
    let query = supabase.from('schemes').select(`
      id, customer_name, customer_phone, customer_address, customer_group_name,
      start_date, monthly_payment_amount, duration_months, status,
      closure_date, archived_date
    `).or('status.eq.Archived,archived_date.is.not.null'); // Filter for archived

    query = query.order('archived_date', { ascending: false }); // Show recently archived first

    const { data: schemesData, error: schemesError } = await query;

    if (schemesError) {
      console.error('Error fetching archived schemes from Supabase:', schemesError);
      throw schemesError;
    }
    if (!schemesData) return [];

    // Reuse the same detailing logic as getSupabaseSchemes
    const detailedSchemes = await Promise.all(
      schemesData.map(async (dbSchemeRow: any) => {
        const dbScheme = toCamelCase(dbSchemeRow) as any;
        const payments = await getSupabasePaymentsForScheme(dbScheme.id);
        const processedPayments = payments.map(p => ({
          ...p,
          status: getPaymentStatus(p, dbScheme.startDate)
        }));
        const tempScheme: Scheme = {
          ...dbScheme,
          payments: processedPayments,
          totalAmountExpected: 0, totalAmountPaid: 0, totalBalance: 0,
          paymentsMadeCount: 0, paymentsPendingCount: 0, nextDueDate: undefined,
          isOverdue: false, daysOverdue: 0,
        };
        const totals = calculateSchemeTotals(tempScheme);
        // The status from DB ('Archived') should ideally be preserved here.
        // getSchemeStatus might try to recalculate it based on payments.
        // For archived view, we trust the 'Archived' status.
        let finalStatus = getSchemeStatus(tempScheme);
        if (dbScheme.status === 'Archived') {
            finalStatus = 'Archived';
        }

        return { ...tempScheme, ...totals, status: finalStatus, archivedDate: dbScheme.archivedDate };
      })
    );
    return detailedSchemes;
  } catch (error) {
    console.error('An unexpected error occurred in getArchivedSupabaseSchemes:', error);
    return [];
  }
};

export const getSupabaseSchemes = async (options?: { includeArchived?: boolean }): Promise<Scheme[]> => {
  try {
    let query = supabase.from('schemes').select(`
      id, customer_name, customer_phone, customer_address, customer_group_name,
      start_date, monthly_payment_amount, duration_months, status,
      closure_date, archived_date
    `);
    if (options && !options.includeArchived) {
      query = query.neq('status', 'Archived');
    }
    query = query.order('start_date', { ascending: false });
    const { data: schemesData, error: schemesError } = await query;
    if (schemesError) throw schemesError;
    if (!schemesData) return [];

    const detailedSchemes = await Promise.all(
      schemesData.map(async (dbSchemeRow: any) => {
        const dbScheme = toCamelCase(dbSchemeRow) as any;
        const payments = await getSupabasePaymentsForScheme(dbScheme.id);
        const processedPayments = payments.map(p => ({
          ...p,
          status: getPaymentStatus(p, dbScheme.startDate)
        }));
        const tempScheme: Scheme = {
          ...dbScheme,
          payments: processedPayments,
          totalAmountExpected: 0, totalAmountPaid: 0, totalBalance: 0,
          paymentsMadeCount: 0, paymentsPendingCount: 0, nextDueDate: undefined,
          isOverdue: false, daysOverdue: 0,
        };
        const totals = calculateSchemeTotals(tempScheme);
        const currentStatus = getSchemeStatus(tempScheme);
        return { ...tempScheme, ...totals, status: currentStatus };
      })
    );
    return detailedSchemes;
  } catch (error) {
    console.error('An unexpected error occurred in getSupabaseSchemes:', error);
    return [];
  }
};

export const getSupabaseSchemeById = async (id: string): Promise<Scheme | null> => {
  try {
    const { data: schemeData, error: schemeError } = await supabase
      .from('schemes')
      .select(`
        id, customer_name, customer_phone, customer_address, customer_group_name,
        start_date, monthly_payment_amount, duration_months, status,
        closure_date, archived_date
      `)
      .eq('id', id)
      .single();

    if (schemeError) {
      if (schemeError.code === 'PGRST116') return null; // PostgREST code for "Not a single row was found"
      console.error(`Error fetching scheme ${id}:`, schemeError);
      throw schemeError;
    }
    if (!schemeData) return null;

    const dbScheme = toCamelCase(schemeData) as any;
    const payments = await getSupabasePaymentsForScheme(dbScheme.id);
    const processedPayments = payments.map(p => ({
      ...p,
      status: getPaymentStatus(p, dbScheme.startDate)
    }));
    const tempScheme: Scheme = {
      ...dbScheme,
      payments: processedPayments,
      totalAmountExpected: 0, totalAmountPaid: 0, totalBalance: 0,
      paymentsMadeCount: 0, paymentsPendingCount: 0, nextDueDate: undefined,
      isOverdue: false, daysOverdue: 0,
    };
    const totals = calculateSchemeTotals(tempScheme);
    const currentStatus = getSchemeStatus(tempScheme);
    return { ...tempScheme, ...totals, status: currentStatus };
  } catch (error) {
    console.error(`An unexpected error occurred in getSupabaseSchemeById for id ${id}:`, error);
    return null;
  }
};

// Function to generate and save payments for a new scheme
const generateAndSaveSupabasePayments = async (schemeId: string, schemeStartDate: string, monthlyPaymentAmount: number, durationMonths: number): Promise<Payment[]> => {
  // Create a minimal scheme-like object for generatePaymentsForScheme
  const minimalScheme = {
    id: schemeId,
    startDate: schemeStartDate,
    monthlyPaymentAmount,
    durationMonths,
    payments: [] // Required by generatePaymentsForScheme
  };
  const paymentDrafts = generatePaymentsForScheme(minimalScheme as Scheme);

  const paymentsToInsert = paymentDrafts.map(p => ({
    scheme_id: schemeId,
    month_number: p.monthNumber,
    due_date: p.dueDate, // Ensure this is ISO string
    amount_expected: p.amountExpected,
    status: p.status, // Initial status from generation
    // other fields like amount_paid, payment_date, mode_of_payment will be null/default
  }));

  const { data: insertedPayments, error } = await supabase
    .from('payments')
    .insert(paymentsToInsert)
    .select();

  if (error) {
    console.error('Error inserting generated payments:', error);
    // Consider cleanup: if payments fail, should the scheme be deleted? Or marked as incomplete?
    throw error;
  }
  if (!insertedPayments) return [];

  return insertedPayments.map(p => toCamelCase(p) as Payment);
};

// Refined addSupabaseScheme
export const addSupabaseScheme = async (
  schemeData: Omit<Scheme, 'id' | 'payments' | 'status' | 'totalAmountExpected' | 'totalAmountPaid' | 'totalBalance' | 'paymentsMadeCount' | 'paymentsPendingCount' | 'nextDueDate' | 'isOverdue' | 'daysOverdue'>
): Promise<Scheme | null> => {
  try {
    const dbSchemePayload = {
      customer_name: schemeData.customerName,
      customer_phone: schemeData.customerPhone,
      customer_address: schemeData.customerAddress,
      customer_group_name: schemeData.customerGroupName,
      start_date: schemeData.startDate, // Ensure ISO format string
      monthly_payment_amount: schemeData.monthlyPaymentAmount,
      duration_months: schemeData.durationMonths,
      status: 'Upcoming', // Initial status
      closure_date: schemeData.closureDate,
      archived_date: schemeData.archivedDate,
    };

    const { data: newSchemeRow, error: insertError } = await supabase
      .from('schemes')
      .insert(dbSchemePayload)
      .select()
      .single();

    if (insertError) throw insertError;
    if (!newSchemeRow) return null;

    const newSchemeBase = toCamelCase(newSchemeRow) as any;

    // Generate and save payments
    await generateAndSaveSupabasePayments(
      newSchemeBase.id,
      newSchemeBase.startDate,
      newSchemeBase.monthlyPaymentAmount,
      newSchemeBase.durationMonths
    );

    // Refetch the scheme with all details (including payments and calculated fields)
    return getSupabaseSchemeById(newSchemeBase.id);

  } catch (error) {
    console.error('Error in addSupabaseScheme:', error);
    return null;
  }
};

// Update a single payment
export const updateSupabasePayment = async (
  paymentId: string,
  paymentUpdates: Partial<Omit<Payment, 'id' | 'schemeId'>> // id and schemeId typically don't change
): Promise<Payment | null> => {
  try {
    // Convert camelCase keys in paymentUpdates to snake_case for DB
    const dbPaymentUpdates: any = {};
    for (const key in paymentUpdates) {
      const dbKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      dbPaymentUpdates[dbKey] = (paymentUpdates as any)[key];
    }

    // Ensure status is part of the update if it's provided, otherwise it might be recalculated by UI/getters
    // If status is directly updatable, ensure it's part of dbPaymentUpdates.
    // If not, it will be derived when the scheme is re-fetched.

    const { data: updatedPaymentRow, error } = await supabase
      .from('payments')
      .update(dbPaymentUpdates)
      .eq('id', paymentId)
      .select()
      .single();

    if (error) {
      console.error(`Error updating payment ${paymentId}:`, error);
      throw error;
    }
    if (!updatedPaymentRow) return null;

    return toCamelCase(updatedPaymentRow) as Payment;

  } catch (error) {
    console.error(`Unexpected error in updateSupabasePayment for payment ${paymentId}:`, error);
    return null;
  }
};


// Update a scheme's top-level details
export const updateSupabaseScheme = async (
  schemeId: string,
  updates: Partial<Omit<Scheme, 'id' | 'payments' | 'totalAmountExpected' | 'totalAmountPaid' | 'totalBalance' | 'paymentsMadeCount' | 'paymentsPendingCount' | 'nextDueDate' | 'isOverdue' | 'daysOverdue'>>
): Promise<Scheme | null> => {
  try {
    const dbUpdates: any = {};
    // Define which Scheme properties are direct columns in the 'schemes' table and can be updated.
    const validDirectUpdateFields: (keyof typeof updates)[] = [
      'customerName', 'customerPhone', 'customerAddress', 'customerGroupName',
      'startDate', 'monthlyPaymentAmount', 'durationMonths', 'status',
      'closureDate', 'archivedDate'
      // Note: 'payments' array itself is not updated here. Individual payments are updated via updateSupabasePayment.
      // Calculated fields (totals, counts, etc.) are not updated directly.
    ];

    for (const key of validDirectUpdateFields) {
      if (updates[key] !== undefined) {
        const snakeKey = toSnakeCase(key); // Use the toSnakeCase helper
        dbUpdates[snakeKey] = (updates as any)[key];
      }
    }

    if (Object.keys(dbUpdates).length === 0) {
      // No valid fields to update, return current scheme data
      // This check might be too simplistic if only non-direct fields were passed.
      // However, the type Omit<> should help prevent that.
      console.warn("updateSupabaseScheme called with no updatable fields for scheme:", schemeId);
      return getSupabaseSchemeById(schemeId);
    }

    const { data: updatedSchemeRow, error } = await supabase
      .from('schemes')
      .update(dbUpdates)
      .eq('id', schemeId)
      .select('id') // Only select 'id' to confirm update, then refetch all details
      .single();

    if (error) {
      console.error(`Error updating scheme ${schemeId}:`, error);
      throw error;
    }
    if (!updatedSchemeRow) return null;

    // Return the full scheme details after update to reflect any calculated changes
    return getSupabaseSchemeById(schemeId);

  } catch (error) {
    console.error(`Unexpected error in updateSupabaseScheme for scheme ${schemeId}:`, error);
    return null;
  }
};

// Delete a scheme (payments are deleted via CASCADE constraint in DB)
export const deleteSupabaseScheme = async (schemeId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('schemes')
      .delete()
      .eq('id', schemeId);

    if (error) {
      console.error(`Error deleting scheme ${schemeId}:`, error);
      // If RLS prevents deletion or scheme doesn't exist, it might result in an error or error.count === 0
      // Depending on Supabase client version and RLS, error might not always be thrown for "not found"
      return false;
    }
    return true; // Indicates the operation was attempted. Actual deletion depends on DB state and RLS.
  } catch (error) {
    console.error(`Unexpected error in deleteSupabaseScheme for scheme ${schemeId}:`, error);
    return false;
  }
};

// Get unique, non-archived group names from schemes
export const getUniqueSupabaseGroupNames = async (): Promise<string[]> => {
  try {
    const { data, error } = await supabase
      .from('schemes')
      .select('customer_group_name', { distinct: true }) // Use distinct on server
      .not('customer_group_name', 'is', null)
      .neq('customer_group_name', '')
      .neq('status', 'Archived'); // Assuming 'Archived' is the status string for archived schemes

    if (error) {
      console.error('Error fetching unique group names:', error);
      throw error;
    }

    if (!data) return [];

    // Data should already be distinct records like [{customer_group_name: 'Group A'}, {customer_group_name: 'Group B'}]
    return data
      .map(item => item.customer_group_name)
      .filter(name => name) // Ensure no null/empty strings post-map (though query should prevent)
      .sort((a, b) => a.localeCompare(b));

  } catch (error) {
    console.error('An unexpected error occurred in getUniqueSupabaseGroupNames:', error);
    return [];
  }
};


// Update a scheme's group name
export const updateSupabaseSchemeGroup = async (schemeId: string, newGroupName?: string): Promise<Scheme | null> => {
  try {
    const { data, error } = await supabase
      .from('schemes')
      .update({ customer_group_name: newGroupName === '' ? null : newGroupName }) // Set to null if empty string, else the name
      .eq('id', schemeId)
      .select('id')
      .single();

    if (error) {
      console.error(`Error updating group for scheme ${schemeId}:`, error);
      throw error;
    }
    if (!data) return null;

    return getSupabaseSchemeById(schemeId); // Refetch to get updated scheme details
  } catch (error) {
    console.error(`Unexpected error in updateSupabaseSchemeGroup for scheme ${schemeId}:`, error);
    return null;
  }
};

// Close a scheme
export const closeSupabaseScheme = async (
  schemeId: string,
  closureDate: string, // ISO date string
  // For simplicity, we'll assume 'full_reconciliation' for now, as in mock.
  // type: 'full_reconciliation' | 'partial_closure',
  modeOfPaymentOverride: PaymentMode[] = ['System Closure']
): Promise<Scheme | null> => {
  try {
    const scheme = await getSupabaseSchemeById(schemeId);
    if (!scheme) {
      console.error(`Scheme ${schemeId} not found for closing.`);
      return null;
    }

    // If already closed, maybe just return it or update closure date? For now, proceed.
    // if (scheme.status === 'Closed') return scheme;

    // Update payments for full reconciliation:
    // Mark all non-archived, unpaid/pending payments as 'Paid' on the closureDate.
    const paymentUpdates: Promise<any>[] = [];
    for (const payment of scheme.payments) {
      if (!payment.isArchived && payment.status !== 'Paid') {
        paymentUpdates.push(
          supabase.from('payments').update({
            amount_paid: payment.amountExpected,
            payment_date: closureDate,
            mode_of_payment: modeOfPaymentOverride,
            status: 'Paid' // Explicitly set to 'Paid'
          }).eq('id', payment.id)
        );
      }
    }
    await Promise.all(paymentUpdates);

    // Update the scheme itself to 'Closed'
    const { data: updatedSchemeRow, error: updateSchemeError } = await supabase
      .from('schemes')
      .update({
        status: 'Closed',
        closure_date: closureDate
      })
      .eq('id', schemeId)
      .select('id')
      .single();

    if (updateSchemeError) {
      console.error(`Error setting scheme ${schemeId} to Closed:`, updateSchemeError);
      throw updateSchemeError;
    }
    if (!updatedSchemeRow) return null; // Should not happen if previous check passed

    return getSupabaseSchemeById(schemeId); // Refetch the fully updated scheme

  } catch (error) {
    console.error(`Unexpected error in closeSupabaseScheme for scheme ${schemeId}:`, error);
    return null;
  }
};

// Reopen a closed scheme
export const reopenSupabaseScheme = async (schemeId: string): Promise<Scheme | null> => {
  try {
    const scheme = await getSupabaseSchemeById(schemeId);
    if (!scheme || scheme.status !== 'Closed') {
      console.error(`Scheme ${schemeId} not found or not closed, cannot reopen.`);
      return scheme; // Return current state
    }

    // Clear out system closure payment details for payments that were forced closed.
    // This means payments that were paid on the closureDate with 'System Closure' mode.
    const paymentUpdates: Promise<any>[] = [];
    const closureDateToMatch = scheme.closureDate; // Original closure date

    if (closureDateToMatch) {
      for (const payment of scheme.payments) {
        if (
          payment.paymentDate === closureDateToMatch &&
          payment.modeOfPayment?.includes('System Closure')
        ) {
          paymentUpdates.push(
            supabase.from('payments').update({
              amount_paid: null, // Or 0 depending on desired state
              payment_date: null,
              mode_of_payment: null,
              // Status will be recalculated by getPaymentStatus when scheme is fetched
            }).eq('id', payment.id)
          );
        }
      }
      await Promise.all(paymentUpdates);
    }

    // Update scheme status and remove closure date
    // The actual status (Active, Overdue, etc.) will be recalculated by getSupabaseSchemeById via getSchemeStatus.
    const { data: updatedSchemeRow, error: updateSchemeError } = await supabase
      .from('schemes')
      .update({
        status: 'Active', // Tentative status, will be properly recalculated
        closure_date: null
      })
      .eq('id', schemeId)
      .select('id')
      .single();

    if (updateSchemeError) {
      console.error(`Error reopening scheme ${schemeId}:`, updateSchemeError);
      throw updateSchemeError;
    }
    if(!updatedSchemeRow) return null;

    return getSupabaseSchemeById(schemeId); // Refetch to get recalculated status and payments

  } catch (error) {
    console.error(`Unexpected error in reopenSupabaseScheme for scheme ${schemeId}:`, error);
    return null;
  }
};


// TODO: Implement functions for:
// - Archival functions for schemes and payments (archiveSupabaseScheme, unarchiveSupabaseScheme, etc.)
// - Functions for managing 'archived_groups' and 'archived_group_schemes' if that functionality is to be ported.
// - Record next due payments (for customer, for group)
// - etc. (mirroring mock-data.ts functionality)

export const archiveSupabaseScheme = async (schemeId: string): Promise<Scheme | null> => {
  try {
    const { data, error } = await supabase
      .from('schemes')
      .update({
        status: 'Archived',
        archived_date: new Date().toISOString()
      })
      .eq('id', schemeId)
      .select('id') // select minimal to confirm update
      .single();

    if (error) {
      console.error(`Error archiving scheme ${schemeId}:`, error);
      throw error;
    }
    if (!data) return null;

    return getSupabaseSchemeById(schemeId); // Refetch to get the full updated scheme
  } catch (error) {
    console.error(`Unexpected error in archiveSupabaseScheme for ${schemeId}:`, error);
    return null;
  }
};

export const unarchiveSupabaseScheme = async (schemeId: string): Promise<Scheme | null> => {
  try {
    // When unarchiving, the status will be recalculated by getSupabaseSchemeById.
    // We set it to a generic non-archived status like 'Active' temporarily.
    // The crucial part is clearing the archived_date.
    const { data, error } = await supabase
      .from('schemes')
      .update({
        status: 'Active', // Placeholder, will be properly set by getSchemeStatus on refetch
        archived_date: null
      })
      .eq('id', schemeId)
      .select('id')
      .single();

    if (error) {
      console.error(`Error unarchiving scheme ${schemeId}:`, error);
      throw error;
    }
    if (!data) return null;

    return getSupabaseSchemeById(schemeId); // Refetch to get the full updated scheme
  } catch (error) {
    console.error(`Unexpected error in unarchiveSupabaseScheme for ${schemeId}:`, error);
    return null;
  }
};
