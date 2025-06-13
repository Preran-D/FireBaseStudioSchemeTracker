import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Scheme, Payment } from '@/types/scheme'; // Assuming Scheme type is available
import { calculateSchemeTotals, getSchemeStatus, formatDate} from '@/lib/utils'; // Assuming these utils are available

export const exportGroupSchemesToPdf = (
  groupName: string,
  schemes: Scheme[],
  groupSummaryStats: {
    totalCustomers: number;
    totalSchemes: number;
    totalPaid: number;
    totalPending: number;
    totalOverdueAmount: number;
    activeSchemesCount: number;
  },
  exportType: 'condensed' | 'detailed'
) => {
  const doc = new jsPDF();
  let currentY = 22; // Adjust initial Y position

  // Add Group Title
  doc.setFontSize(18);
  doc.text(`Group Details: ${groupName}`, 14, currentY);
  currentY += 10;

  // Add Group Summary Statistics
  doc.setFontSize(11);
  doc.text(`Total Customers: ${groupSummaryStats.totalCustomers}`, 14, currentY);
  doc.text(`Total Paid: ${"Rs." + (groupSummaryStats.totalPaid)}`, 100, currentY);
  currentY += 6;
  doc.text(`Total Schemes: ${groupSummaryStats.totalSchemes}`, 14, currentY);
  // doc.text(`Total Pending: ${"Rs." + (groupSummaryStats.totalPending)}`, 100, currentY);
  currentY += 6;
  // doc.text(`Active Schemes: ${groupSummaryStats.activeSchemesCount}`, 14, currentY);
  // doc.text(`Total Overdue: ${"Rs." + (groupSummaryStats.totalOverdueAmount)}`, 100, currentY);
  currentY += 8;

  doc.line(14, currentY, doc.internal.pageSize.width - 14, currentY); // Horizontal line separator
  currentY += 8;


  if (exportType === 'condensed') {
    const tableColumnsCondensed = [
      'Customer Name',
      'Scheme ID',
      'Start Date',
      'Status',
      'Total Paid',
    ];
    const tableRowsCondensed: any[][] = schemes.map(scheme => {
      const schemeTotals = calculateSchemeTotals(scheme);
      const status = getSchemeStatus(scheme);
      return [
        scheme.customerName,
        scheme.id.toUpperCase(),
        formatDate(scheme.startDate),
        status,
        "Rs." + (schemeTotals.totalCollected),
      ];
    });
    autoTable(doc, {
      head: [tableColumnsCondensed],
      body: tableRowsCondensed,
      startY: currentY,
      theme: 'striped',
      headStyles: { fillColor: [22, 160, 133] },
      margin: { top: 10 },
    });
    currentY = (doc as any).lastAutoTable.finalY + 10;
  } else { // Detailed export
    schemes.forEach((scheme, index) => {
      const schemeTotals = calculateSchemeTotals(scheme);
      const status = getSchemeStatus(scheme);

      // Main scheme details
      const mainSchemeTableColumns = [
        'Customer Name', 'Scheme ID', 'Start Date', 'Monthly Amt.', 'Total Paid', 'Payments (Made/Total)', 'Status'
      ];
      const mainSchemeRow = [
        scheme.customerName,
        scheme.id.toUpperCase(),
        formatDate(scheme.startDate),
        "Rs." + (scheme.monthlyPaymentAmount),
        "Rs." + (schemeTotals.totalCollected),
        `${schemeTotals.paymentsMadeCount || 0} / ${scheme.durationMonths}`,
        status,
      ];

      autoTable(doc, {
        head: index === 0 ? [mainSchemeTableColumns] : undefined, // Show header only for the first scheme's main table
        body: [mainSchemeRow],
        startY: currentY,
        theme: 'striped',
        headStyles: { fillColor: [22, 160, 133] },
        margin: { top: 10, bottom: 2 }, // Reduced bottom margin
        pageBreak: 'auto',
        didDrawPage: (data) => {
          if (index === 0) currentY = data.cursor?.y || currentY; // Initialize Y for the first table
        },
        didDrawCell: (data) => {
          // This ensures currentY is updated after each main scheme row for subsequent tables
          if (data.row.index === 0 && data.cell.section === 'body') {
            // Type assertion to access internal autoTable properties
            currentY = (data.cursor as any)?.y + data.row.height + 2 || currentY;
          }
        }
      });
      // currentY must be updated by autoTable, use its returned cursor.y or pass a didDrawPage/Cell hook

      // Payment History Sub-table
      if (scheme.payments && scheme.payments.length > 0) {
        const paymentHistoryColumns = ['Month #', 'Due Date', 'Payment Date', 'Amount Paid', 'Mode(s)', 'Status'];
        const paymentHistoryRows = scheme.payments.map((p: Payment) => [
          p.monthNumber,
          formatDate(p.dueDate),
          p.paymentDate ? formatDate(p.paymentDate) : 'N/A',
          p.amountPaid ? "Rs." + (p.amountPaid) : 'N/A',
          p.modeOfPayment && p.modeOfPayment.length > 0 ? p.modeOfPayment.join(', ') : 'N/A',
          p.status,
        ]);

        autoTable(doc, {
          head: [paymentHistoryColumns],
          body: paymentHistoryRows,
          startY: currentY, // Start immediately after the main scheme row
          theme: 'grid', // Different theme for distinction
          headStyles: { fillColor: [100, 100, 100] }, // Darker grey for sub-header
          styles: { fontSize: 8 },
          columnStyles: {
            0: { cellWidth: 15 }, // Month #
            1: { cellWidth: 25 }, // Due Date
            2: { cellWidth: 25 }, // Payment Date
            // Amount Paid, Mode(s), Status will take remaining width
          },
          margin: { left: 20, right: 14, top: 0, bottom: 5 }, // Indent sub-table
          pageBreak: 'auto',
          didDrawPage: (data) => {
            currentY = data.cursor?.y || currentY;
          },
          didParseCell: function (data) {
            // Check if it's the "No payment history" row
            if (data.cell.raw === "No payment history available.") {
              if (data.cell.styles) data.cell.styles.halign = 'center';
            }
          },
        });
        currentY = (doc as any).lastAutoTable.finalY + 5; // Update Y after sub-table
      } else {
        // Display "No payment history available."
        // This needs to be drawn carefully to fit within the table structure or as text
        autoTable(doc, {
          body: [[{ content: "No payment history available.", colSpan: 6, styles: { halign: 'center', fontStyle: 'italic', textColor: [100, 100, 100] } }]],
          startY: currentY,
          theme: 'plain',
          margin: { left: 20, right: 14, top: 0, bottom: 5 },
          pageBreak: 'auto',
          didDrawPage: (data) => {
            currentY = data.cursor?.y || currentY;
          }
        });
        currentY = (doc as any).lastAutoTable.finalY + 5;
      }
      currentY += 2; // Add a small gap before the next scheme entry
      // Check for page overflow before drawing the next scheme
      if (currentY > doc.internal.pageSize.height - 30) { // 30 as a buffer for footer/margin
        doc.addPage();
        currentY = 20; // Reset Y for new page
      }
    });
  }
  doc.save(`Group_${groupName}_Schemes_${exportType}.pdf`);
};

// Define types for customer report data (can be imported from reports/page.tsx if structured better)
interface CustomerReportSchemeSummary {
  totalSchemes: number;
  activeSchemes: number;
  completedSchemes: number;
  closedSchemes: number;
  overdueSchemes: number;
  totalCollected: number;
}

interface CustomerReportDataForPdf {
  customerId: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  groups: string[];
  schemesSummary: CustomerReportSchemeSummary;
  detailedSchemes: Scheme[];
}

export const exportCustomerReportsToPdf = (
  customers: CustomerReportDataForPdf[],
  exportType: 'condensed' | 'detailed'
) => {
  const doc = new jsPDF();
  const pageHeight = doc.internal.pageSize.height;
  let currentY = 20; // Initial Y position

  // Helper to add text and update currentY, also checks for page overflow
  const addTextWithOverflowCheck = (text: string, x: number, y: number, size = 10, style = 'normal', lineHeight?: number) => {
    const textLineHeight = lineHeight || (size / 2) + 2; // Approximate line height
    if (y + textLineHeight > pageHeight - 15) { // 15 for bottom margin
      doc.addPage();
      currentY = 20;
      y = currentY; // Reset y to new currentY
    }
    doc.setFontSize(size);
    doc.setFont('helvetica', style);
    doc.text(text, x, y);
    currentY = y + textLineHeight;
  };

  // Helper to add a line and update currentY
  const addLineWithOverflowCheck = (x1: number, y1: number, x2: number, y2: number, heightAfterLine: number = 5) => {
    if (y1 + heightAfterLine > pageHeight - 15) {
      doc.addPage();
      currentY = 20;
      y1 = currentY; // Reset y1 to new currentY
      y2 = currentY; // Reset y2 to new currentY
    }
    doc.line(x1, y1, x2, y2);
    currentY = y1 + heightAfterLine;
  };


  customers.forEach((customer, customerIndex) => {
    if (customerIndex > 0) { // Add new page for each customer after the first
      doc.addPage();
      currentY = 20;
    }

    // Customer Title
    addTextWithOverflowCheck(customer.customerName, 14, currentY, 16, 'bold', 8);

    // Customer Contact Info
    if (customer.customerPhone) {
      addTextWithOverflowCheck(`Phone: ${customer.customerPhone}`, 14, currentY, 10, 'normal', 5);
    }
    if (customer.customerAddress) {
      addTextWithOverflowCheck(`Address: ${customer.customerAddress}`, 14, currentY, 10, 'normal', 5);
    }
    if (customer.groups.length > 0) {
      addTextWithOverflowCheck(`Groups: ${customer.groups.join(', ')}`, 14, currentY, 10, 'normal', 5);
    }
    currentY += 3; // Extra space

    // Schemes Summary
    addTextWithOverflowCheck('Schemes Summary:', 14, currentY, 12, 'bold', 7);

    let summaryX = 14;
    let summaryY = currentY;
    addTextWithOverflowCheck(`Total Schemes: ${customer.schemesSummary.totalSchemes}`, summaryX, summaryY, 10, 'normal', 5);
    summaryX += 55;
    addTextWithOverflowCheck(`Active: ${customer.schemesSummary.activeSchemes}`, summaryX, summaryY, 10, 'normal', 5);
    summaryX += 35;
    addTextWithOverflowCheck(`Completed: ${customer.schemesSummary.completedSchemes}`, summaryX, summaryY, 10, 'normal', 5);

    currentY = summaryY + 5; // Move to next line of summary
    summaryX = 14;
    summaryY = currentY;
    addTextWithOverflowCheck(`Closed: ${customer.schemesSummary.closedSchemes}`, summaryX, summaryY, 10, 'normal', 5);
    summaryX += 55;
    addTextWithOverflowCheck(`Overdue: ${customer.schemesSummary.overdueSchemes}`, summaryX, summaryY, 10, 'normal', 5);

    currentY = summaryY + 5; // Move to next line for total collected
    summaryX = 14;
    summaryY = currentY;
    addTextWithOverflowCheck(`Total Collected: ${"Rs." + (customer.schemesSummary.totalCollected)}`, summaryX, summaryY, 10, 'normal', 10); // Add more space after this

    if (exportType === 'detailed') {
      if (customer.detailedSchemes.length > 0) {
        customer.detailedSchemes.forEach((scheme, schemeIndex) => {
          // Check for page overflow before drawing scheme table
          if (currentY + 30 > pageHeight - 20) { // Min height for a scheme block
            doc.addPage(); currentY = 20;
          }

          const schemeTableColumns = ['Scheme ID', 'Start Date', 'Monthly Amt.', 'Status', 'Payments (Made/Total)', 'Total Paid'];
          const schemeTotals = calculateSchemeTotals(scheme);
          const status = getSchemeStatus(scheme);
          const schemeTableRow = [
            scheme.id.toUpperCase(),
            formatDate(scheme.startDate),
            "Rs." + (scheme.monthlyPaymentAmount),
            status,
            `${schemeTotals.paymentsMadeCount || 0}/${scheme.durationMonths}`,
            "Rs." + (schemeTotals.totalCollected),
          ];

          autoTable(doc, {
            head: [schemeTableColumns],
            body: [schemeTableRow],
            startY: currentY,
            theme: 'grid',
            headStyles: { fillColor: [74, 85, 104] }, // Slate color
            margin: { top: 5, bottom: 2 },
            didDrawPage: (data) => { currentY = data.cursor?.y || currentY; },
            didDrawCell: (data) => {
              if (data.row.index === 0 && data.cell.section === 'body') {
                currentY = (data.cursor as any)?.y + data.row.height + 2 || currentY;
              }
            }
          });
          // currentY is now updated by didDrawCell or didDrawPage

          // Payment History Sub-table for this scheme
          if (scheme.payments && scheme.payments.length > 0) {
            if (currentY + 25 > pageHeight - 20) { // Min height for payment history header + one row
              doc.addPage(); currentY = 20;
            }
            const paymentHistoryColumns = ['Month #', 'Due Date', 'Payment Date', 'Amount Paid', 'Mode(s)', 'Status'];
            const paymentHistoryRows = scheme.payments.map((p: Payment) => [
              p.monthNumber,
              formatDate(p.dueDate),
              p.paymentDate ? formatDate(p.paymentDate) : 'N/A',
              p.amountPaid ? "Rs." + (p.amountPaid) : 'N/A',
              p.modeOfPayment && p.modeOfPayment.length > 0 ? p.modeOfPayment.join(', ') : 'N/A',
              p.status,
            ]);

            autoTable(doc, {
              head: [paymentHistoryColumns],
              body: paymentHistoryRows,
              startY: currentY,
              theme: 'grid',
              headStyles: { fillColor: [128, 128, 128], fontSize: 9 }, // Grey for sub-header
              styles: { fontSize: 8, cellPadding: 1.5 },
              columnStyles: {
                0: { cellWidth: 15 }, 1: { cellWidth: 25 }, 2: { cellWidth: 25 },
              },
              margin: { left: 18, right: 14, top: 0, bottom: 3 }, // Indent sub-table
              didDrawPage: (data) => { currentY = data.cursor?.y || currentY; }
            });
            currentY = (doc as any).lastAutoTable.finalY + 3;
          } else {
            if (currentY + 10 > pageHeight - 20) { doc.addPage(); currentY = 20; }
            autoTable(doc, {
              body: [[{ content: "No payment history available.", colSpan: 6, styles: { halign: 'center', fontStyle: 'italic', textColor: [100, 100, 100] } }]],
              startY: currentY,
              theme: 'plain',
              margin: { left: 18, right: 14, top: 0, bottom: 3 },
              didDrawPage: (data) => { currentY = data.cursor?.y || currentY; }
            });
            currentY = (doc as any).lastAutoTable.finalY + 3;
          }
          currentY += 2; // Small gap before next scheme or end of customer
        });
      } else {
        if (currentY + 10 > pageHeight - 20) { doc.addPage(); currentY = 20; }
        addTextWithOverflowCheck('No detailed schemes to display for this customer.', 14, currentY, 10, 'italic', 7);
      }
    } else if (exportType === 'condensed') {
      addTextWithOverflowCheck('Schemes List (Condensed):', 14, currentY, 12, 'bold', 7);
      if (customer.detailedSchemes && customer.detailedSchemes.length > 0) {
        const tableColumnsCondensed = ['Scheme ID', 'Start Date', 'Monthly Amt.', 'Status', 'Payments (Made/Total)', 'Total Paid'];
        const tableRowsCondensed = customer.detailedSchemes.map(scheme => {
          const schemeTotals = calculateSchemeTotals(scheme);
          const status = getSchemeStatus(scheme);
          return [
            scheme.id.toUpperCase(),
            formatDate(scheme.startDate),
            "Rs." + (scheme.monthlyPaymentAmount),
            status,
            `${schemeTotals.paymentsMadeCount || 0}/${scheme.durationMonths}`,
            "Rs." + (schemeTotals.totalCollected),
          ];
        });
        autoTable(doc, {
          head: [tableColumnsCondensed],
          body: tableRowsCondensed,
          startY: currentY,
          theme: 'grid',
          headStyles: { fillColor: [74, 85, 104] }, // Slate color
          margin: { top: 5, bottom: 2 },
          didDrawPage: (data) => { currentY = data.cursor?.y || currentY; }, // Ensure currentY is updated on new page
        });
        currentY = (doc as any).lastAutoTable.finalY + 5;
      } else {
        addTextWithOverflowCheck('No schemes to display for this customer.', 14, currentY, 10, 'italic', 7);
      }
    } // End of detailed export specific section

    // Add a larger gap or a line before the next customer if it's not the last one
    if (customerIndex < customers.length - 1) {
      currentY += 10; // Add some space
      if (currentY > pageHeight - 20) { // If space pushes to overflow, new page will be added by next customer
        // currentY will be reset by the next customer's addPage call.
      } else {
        // Optionally add a separator line if not overflowing
        // addLineWithOverflowCheck(14, currentY, doc.internal.pageSize.width - 14, currentY, 5);
      }
    }
  });

  doc.save(`Customer_Reports_${exportType}.pdf`);
};
