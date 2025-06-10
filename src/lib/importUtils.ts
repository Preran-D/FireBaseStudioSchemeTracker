
'use client';

import { addMockScheme, updateMockSchemePayment, getMockSchemes } from '@/lib/mock-data';
import type { Scheme, PaymentMode } from '@/types/scheme';
import { parse, isValid, formatISO } from 'date-fns';

interface ImportRow {
  customerName: string;
  groupName?: string;
  phone?: string;
  address?: string;
  startDate: string; // YYYY-MM-DD
  monthlyPaymentAmount: number;
  initialPaymentsPaid?: number; // defaults to 0
}

interface ImportResult {
  successCount: number;
  errorCount: number;
  messages: string[];
}

function parseLine(line: string): string[] {
  // Basic CSV/TSV parsing: prioritize comma, then tab.
  // This doesn't handle quoted fields with internal delimiters.
  if (line.includes(',')) {
    return line.split(',').map(field => field.trim());
  }
  return line.split('\t').map(field => field.trim());
}

export function processImportData(pastedData: string): ImportResult {
  const lines = pastedData.trim().split(/\r?\n/);
  const results: ImportResult = { successCount: 0, errorCount: 0, messages: [] };
  const existingCustomerNames = new Set(getMockSchemes().map(s => s.customerName.trim().toLowerCase()));

  lines.forEach((line, index) => {
    const rowNumber = index + 1;
    if (line.trim() === '') {
      results.messages.push(`Row ${rowNumber}: Skipping empty line.`);
      return;
    }

    const fields = parseLine(line);

    if (fields.length < 3) { // Minimum: Customer Name, Start Date, Monthly Amount
      results.messages.push(`Row ${rowNumber}: Insufficient columns (found ${fields.length}, expected at least 3: Name, StartDate, MonthlyAmount). Line: "${line}"`);
      results.errorCount++;
      return;
    }

    const customerName = fields[0];
    const groupName = fields.length > 1 ? fields[1] : undefined;
    const phone = fields.length > 2 ? fields[2] : undefined;
    const address = fields.length > 3 ? fields[3] : undefined;
    const startDateStr = fields.length > 4 ? fields[4] : '';
    const monthlyPaymentAmountStr = fields.length > 5 ? fields[5] : '';
    const initialPaymentsPaidStr = fields.length > 6 ? fields[6] : '0';

    if (!customerName) {
      results.messages.push(`Row ${rowNumber}: Customer Name is required. Line: "${line}"`);
      results.errorCount++;
      return;
    }

    // Simple check for existing customer name if we want to prevent duplicates by pure name
    // For this implementation, we allow multiple schemes per customer, so we only warn.
    if (existingCustomerNames.has(customerName.trim().toLowerCase())) {
      results.messages.push(`Row ${rowNumber}: Info - Customer "${customerName}" may already exist. Creating new scheme.`);
    }


    const startDate = parse(startDateStr, 'yyyy-MM-dd', new Date());
    if (!isValid(startDate)) {
      results.messages.push(`Row ${rowNumber}: Invalid Start Date format for "${customerName}". Expected YYYY-MM-DD, got "${startDateStr}". Line: "${line}"`);
      results.errorCount++;
      return;
    }

    const monthlyPaymentAmount = parseFloat(monthlyPaymentAmountStr);
    if (isNaN(monthlyPaymentAmount) || monthlyPaymentAmount <= 0) {
      results.messages.push(`Row ${rowNumber}: Invalid Monthly Payment Amount for "${customerName}". Expected a positive number, got "${monthlyPaymentAmountStr}". Line: "${line}"`);
      results.errorCount++;
      return;
    }

    const initialPaymentsPaid = parseInt(initialPaymentsPaidStr, 10);
    if (isNaN(initialPaymentsPaid) || initialPaymentsPaid < 0) {
      results.messages.push(`Row ${rowNumber}: Invalid Number of Initial Payments Paid for "${customerName}". Expected a non-negative number, got "${initialPaymentsPaidStr}". Line: "${line}"`);
      results.errorCount++;
      return;
    }
    if (initialPaymentsPaid > 12) {
        results.messages.push(`Row ${rowNumber}: Number of Initial Payments for "${customerName}" cannot exceed 12. Line: "${line}"`);
        results.errorCount++;
        return;
    }

    try {
      const newSchemeData = {
        customerName: customerName.trim(),
        customerGroupName: groupName?.trim() || undefined,
        customerPhone: phone?.trim() || undefined,
        customerAddress: address?.trim() || undefined,
        startDate: formatISO(startDate),
        monthlyPaymentAmount: monthlyPaymentAmount,
      };

      const createdScheme = addMockScheme(newSchemeData);
      if (!createdScheme) {
        results.messages.push(`Row ${rowNumber}: Failed to create scheme for "${customerName}". Unknown error. Line: "${line}"`);
        results.errorCount++;
        return;
      }
      results.messages.push(`Row ${rowNumber}: Successfully created scheme for "${customerName}" (ID: ${createdScheme.id.toUpperCase()}).`);
      existingCustomerNames.add(createdScheme.customerName.trim().toLowerCase()); // Add to known names

      if (initialPaymentsPaid > 0 && createdScheme.payments.length > 0) {
        let paymentsRecordedForThisScheme = 0;
        for (let i = 0; i < initialPaymentsPaid; i++) {
          if (i < createdScheme.payments.length) {
            const paymentToUpdate = createdScheme.payments[i];
            const updatedScheme = updateMockSchemePayment(createdScheme.id, paymentToUpdate.id, {
              paymentDate: createdScheme.startDate, // Pay on start date for imported
              amountPaid: createdScheme.monthlyPaymentAmount,
              modeOfPayment: ['Imported'] as PaymentMode[],
            });
            if (updatedScheme) {
              paymentsRecordedForThisScheme++;
            } else {
              results.messages.push(`Row ${rowNumber}: Error recording initial payment ${i + 1} for scheme ${createdScheme.id.toUpperCase()}.`);
              // Potentially stop recording further payments for this scheme if one fails
              break; 
            }
          }
        }
        if (paymentsRecordedForThisScheme > 0) {
            results.messages.push(`Row ${rowNumber}: Recorded ${paymentsRecordedForThisScheme} initial payment(s) for scheme ${createdScheme.id.toUpperCase()}.`);
        }
      }
      results.successCount++;
    } catch (error: any) {
      results.messages.push(`Row ${rowNumber}: Error processing scheme for "${customerName}": ${error.message || 'Unknown error'}. Line: "${line}"`);
      results.errorCount++;
    }
  });

  return results;
}
