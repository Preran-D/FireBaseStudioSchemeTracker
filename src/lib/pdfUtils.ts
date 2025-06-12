import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Scheme } from '@/types/scheme'; // Assuming Scheme type is available
import { calculateSchemeTotals, getSchemeStatus, formatDate, formatCurrency } from '@/lib/utils'; // Assuming these utils are available

export const exportGroupSchemesToPdf = (
  groupName: string,
  schemes: Scheme[],
  groupSummaryStats: { // Add group summary stats as a parameter
    totalCustomers: number;
    totalSchemes: number;
    totalPaid: number;
    totalPending: number;
    totalOverdueAmount: number;
    activeSchemesCount: number;
  }
) => {
  const doc = new jsPDF();

  // Add Group Title
  doc.setFontSize(18);
  doc.text(`Group Details: ${groupName}`, 14, 22);

  // Add Group Summary Statistics
  doc.setFontSize(11);
  doc.text(`Total Customers: ${groupSummaryStats.totalCustomers}`, 14, 32);
  doc.text(`Total Schemes: ${groupSummaryStats.totalSchemes}`, 14, 38);
  // doc.text(`Active Schemes: ${groupSummaryStats.activeSchemesCount}`, 14, 44);

  doc.text(`Total paid: ${"Rs." + (groupSummaryStats.totalPaid) + "/-"}`, 80, 32);
  // doc.text(`Total Pending: ${"Rs." + (groupSummaryStats.totalPending) + "/-"}`, 80, 38);
  // doc.text(`Total Overdue: ${"Rs." + (groupSummaryStats.totalOverdueAmount) + "/-"}`, 80, 44);

  doc.line(14, 50, doc.internal.pageSize.width - 14, 50); // Horizontal line separator


  const tableColumns = [
    'Customer Name',
    'Scheme ID',
    'Start Date',
    'Amount',
    'Total Paid',
    'Payments',
    'Status',
  ];

  let currentY = 55; // Initial Y position for the first table

  schemes.forEach((scheme, index) => {
    const schemeTotals = calculateSchemeTotals(scheme);
    const status = (getSchemeStatus(scheme).toLowerCase() !== 'closed') ? 'ACTIVE' : 'CLOSED';

    const schemeTableRows = [[
      scheme.customerName,
      scheme.id.toString(), // scheme.id is now number
      formatDate(scheme.startDate),
      "Rs." + scheme.monthlyPaymentAmount + "/-",
      "Rs." + (schemeTotals.totalCollected ?? 0) + "/-", // Use ?? 0 for potential undefined
      `${schemeTotals.paymentsMadeCount || 0} / ${scheme.durationMonths}`,
      status,
    ]];

    autoTable(doc, {
      head: [tableColumns], // Always provide header columns
      body: schemeTableRows,
      startY: currentY,
      theme: 'striped',
      headStyles: { fillColor: [22, 160, 133] },
      margin: { top: 10 },
      didDrawPage: (data) => { // Ensure currentY is updated if a page break occurs
        currentY = data.cursor?.y || currentY;
      }
      // Removed didParseCell hack, relying on autoTable's default width calculations or explicit widths if issues arise
    });

    currentY = (doc as any).lastAutoTable.finalY || currentY; // Update Y to position after the scheme table

    // Add Transaction Details
    if (scheme.payments && scheme.payments.length > 0) {
      currentY += 4; // Add a small gap before the transaction table
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text("Transactions:", 14, currentY);
      currentY += 5;

      const transactionTableColumns = ['Month #', 'Payment Date', 'Amount Paid', 'Status'];
      const transactionTableRows = scheme.payments.map(p => [
        p.monthNumber,
        p.paymentDate ? formatDate(p.paymentDate) : 'N/A',
        p.amountPaid ? formatCurrency(p.amountPaid) : 'N/A',
        p.status,
      ]);

      autoTable(doc, {
        head: [transactionTableColumns],
        body: transactionTableRows,
        startY: currentY,
        theme: 'grid', // Use a different theme for transactions for visual distinction
        headStyles: { fillColor: [75, 75, 75] }, // Darker grey for transaction header
        styles: { fontSize: 8 },
        margin: { left: 14 + 2, right: 14 }, // Indent transaction table slightly
        tableWidth: 'auto', // Adjust table width to content
        didDrawPage: (data) => { // Ensure currentY is updated if a page break occurs
          currentY = data.cursor?.y || currentY;
        }
      });
      currentY = (doc as any).lastAutoTable.finalY || currentY;
    } else {
      currentY += 5; // Add a small gap
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.text("No payments recorded for this scheme.", 14 + 2, currentY); // Indent "No payments" text
      currentY += 7;
    }
    currentY += 10; // Add some padding before the next scheme entry
  });

  doc.save(`Group_${groupName}_Schemes.pdf`);
};

// Define types for customer report data (can be imported from reports/page.tsx if structured better)
interface CustomerReportSchemeSummary {
  totalSchemes: number;
  activeSchemes: number;
  fullyPaidSchemes: number;
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

export const exportCustomerReportsToPdf = (customers: CustomerReportDataForPdf[]) => {
  const doc = new jsPDF();
  const pageHeight = doc.internal.pageSize.height;
  let currentY = 20; // Initial Y position

  const addText = (text: string, x: number, y: number, size = 10, style = 'normal') => {
    doc.setFontSize(size);
    doc.setFont('helvetica', style); // Ensure font is set
    doc.text(text, x, y);
    currentY = y + size / 2; // Approximate next line
  };

  const checkPageOverflow = (heightNeeded: number) => {
    if (currentY + heightNeeded > pageHeight - 20) { // 20 for bottom margin
      doc.addPage();
      currentY = 20;
    }
  };


  customers.forEach((customer, index) => {
    if (index > 0) {
      doc.addPage();
      currentY = 20;
    }

    // Customer Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(customer.customerName, 14, currentY);
    currentY += 8;

    // Customer Contact Info (if available)
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    if (customer.customerPhone) {
      doc.text(`Phone: ${customer.customerPhone}`, 14, currentY);
      currentY += 5;
    }
    if (customer.customerAddress) {
      doc.text(`Address: ${customer.customerAddress}`, 14, currentY);
      currentY += 5;
    }
    if (customer.groups.length > 0) {
      doc.text(`Groups: ${customer.groups.join(', ')}`, 14, currentY);
      currentY += 5;
    }
    currentY += 3; // Extra space before summary

    // Schemes Summary
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Schemes Summary:', 14, currentY);
    currentY += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    let summaryX = 14;
    doc.text(`Total Schemes: ${customer.schemesSummary.totalSchemes}`, summaryX, currentY);
    summaryX += 60; // Adjust spacing as needed
    doc.text(`Active: ${customer.schemesSummary.activeSchemes}`, summaryX, currentY);
    summaryX += 30;
    doc.text(`Fully Paid: ${customer.schemesSummary.fullyPaidSchemes}`, summaryX, currentY);
    currentY += 5;
    summaryX = 14; // Reset X for next line
    doc.text(`Closed: ${customer.schemesSummary.closedSchemes}`, summaryX, currentY);
    summaryX += 60;
    doc.text(`Overdue: ${customer.schemesSummary.overdueSchemes}`, summaryX, currentY);
    currentY += 5;
    summaryX = 14;
    doc.text(`Total Collected: ${"Rs." + customer.schemesSummary.totalCollected + "/-"}`, summaryX, currentY);
    currentY += 10; // Space before detailed schemes table

    // Detailed Schemes Table
    if (customer.detailedSchemes.length > 0) {
      const schemeTableColumns = ['Scheme ID', 'Start Date', 'Monthly Amt.', 'Status', 'Payments (Made/Total)', 'Total Paid'];
      const schemeTableRows = customer.detailedSchemes.map(scheme => {
        const totals = calculateSchemeTotals(scheme); // Recalculate for safety, though already in summary
        const status = getSchemeStatus(scheme); // Use current status
        return [
          scheme.id.toString(), // scheme.id is now number
          formatDate(scheme.startDate),
          "Rs." + scheme.monthlyPaymentAmount + "/-",
          status,
          `${totals.paymentsMadeCount || 0}/${scheme.durationMonths}`,
          "Rs." + totals.totalCollected + "/-",
        ];
      });

      checkPageOverflow(20 + schemeTableRows.length * 7); // Estimate height: header + rows

      autoTable(doc, {
        head: [schemeTableColumns],
        body: schemeTableRows,
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [74, 85, 104] }, // Example: Slate color
        didDrawPage: (data) => { // Update currentY after table is drawn
          currentY = data.cursor?.y || currentY;
        }
      });
      currentY += 5; // Add some padding after the table
    } else {
      doc.text('No detailed schemes to display for this customer.', 14, currentY);
      currentY += 7;
    }
  });

  doc.save('Customer_Reports.pdf');
};
