
'use client';

import * as XLSX from 'xlsx';

interface SheetData {
  name: string;
  data: any[][]; // Array of arrays, where the first inner array is headers
}

export function exportToExcel(sheets: SheetData[], fileName: string): void {
  try {
    const workbook = XLSX.utils.book_new();

    sheets.forEach(sheetInfo => {
      if (sheetInfo.data && sheetInfo.data.length > 0) {
        const worksheet = XLSX.utils.aoa_to_sheet(sheetInfo.data);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetInfo.name);
      } else {
        // Create an empty sheet if there's no data, perhaps with a note
        const emptySheetData = [[`No data available for ${sheetInfo.name}`]];
        const worksheet = XLSX.utils.aoa_to_sheet(emptySheetData);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetInfo.name);
      }
    });

    XLSX.writeFile(workbook, `${fileName}.xlsx`);
  } catch (error) {
    console.error("Error generating Excel file:", error);
    // Potentially show a toast message to the user here
    throw new Error("Failed to generate Excel file.");
  }
}
