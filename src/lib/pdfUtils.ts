import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Scheme } from '@/types/scheme'; // Assuming Scheme type is available
import { calculateSchemeTotals, getSchemeStatus, formatDate, formatCurrency } from '@/lib/utils'; // Assuming these utils are available

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
  includeDetailedTransactions: boolean // New parameter
) => {
  const doc = new jsPDF();
  let currentY = 22; // Initial Y position

  // Add Group Title
  doc.setFontSize(18);
  doc.text(`Group Details: ${groupName}`, 14, currentY);
  currentY += 10;

  // Add Group Summary Statistics
  doc.setFontSize(11);
  doc.text(`Total Customers: ${groupSummaryStats.totalCustomers}`, 14, currentY);
  doc.text(`Total paid: ${formatCurrency(groupSummaryStats.totalPaid)}`, 100, currentY);
  currentY += 6;
  doc.text(`Total Schemes: ${groupSummaryStats.totalSchemes}`, 14, currentY);
  // doc.text(`Active Schemes: ${groupSummaryStats.activeSchemesCount}`, 100, currentY);
  currentY += 6;
  // doc.text(`Total Pending: ${formatCurrency(groupSummaryStats.totalPending)}`, 14, currentY);
  // doc.text(`Total Overdue: ${formatCurrency(groupSummaryStats.totalOverdueAmount)}`, 100, currentY);
  // currentY += 8;


  schemes.forEach((scheme, schemeIndex) => {
    currentY += (schemeIndex === 0 ? 6 : 10); // Add more space for the first scheme, less for subsequent

    // Page break check before adding a new scheme
    if (currentY > doc.internal.pageSize.height - 40) { // Check if enough space for scheme details + some transactions
      doc.addPage();
      currentY = 20;
    }

    doc.setLineWidth(0.5);
    doc.line(14, currentY - 4, doc.internal.pageSize.width - 14, currentY - 4); // Horizontal line separator

    const schemeTotals = calculateSchemeTotals(scheme);
    const status = getSchemeStatus(scheme);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Scheme: ${scheme.id.toUpperCase()}`, 14, currentY);
    currentY += 6;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Customer: ${scheme.customerName}`, 14, currentY);
    currentY += 5;
    doc.text(`Start Date: ${formatDate(scheme.startDate)}`, 14, currentY);
    doc.text(`Status: ${status}`, 100, currentY);
    currentY += 5;
    doc.text(`Monthly Amount: ${formatCurrency(scheme.monthlyPaymentAmount)}`, 14, currentY);
    doc.text(`Payments: ${schemeTotals.paymentsMadeCount || 0}/${scheme.durationMonths}`, 100, currentY);
    currentY += 5;
    doc.text(`Total Collected: ${formatCurrency(schemeTotals.totalCollected)}`, 14, currentY);
    doc.text(`Total Remaining: ${formatCurrency(schemeTotals.totalRemaining)}`, 100, currentY);
    currentY += 7;

    if (scheme.payments && scheme.payments.length > 0) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Transactions:', 14, currentY);
      currentY += 5;

      let transactionTableColumns: string[];
      let transactionTableRows: any[][] = [];

      if (includeDetailedTransactions) {
        transactionTableColumns = ['#', 'Due Date', 'Paid Date', 'Expected', 'Paid', 'Mode', 'Status'];
        scheme.payments.filter(p => !p.isDeleted).forEach(p => {
          transactionTableRows.push([
            p.monthNumber,
            formatDate(p.dueDate),
            p.paymentDate ? formatDate(p.paymentDate) : 'N/A',
            formatCurrency(p.amountExpected),
            p.amountPaid ? formatCurrency(p.amountPaid) : 'N/A',
            p.modeOfPayment?.join(', ') || 'N/A',
            p.status,
          ]);
        });
      } else {
        transactionTableColumns = ['Paid Date', 'Amount Paid', 'Status'];
        scheme.payments.filter(p => !p.isDeleted && p.status === 'Paid').forEach(p => { // Show only non-deleted paid transactions for condensed view
          transactionTableRows.push([
            p.paymentDate ? formatDate(p.paymentDate) : 'N/A',
            p.amountPaid ? formatCurrency(p.amountPaid) : 'N/A',
            p.status,
          ]);
        });
      }

      if (transactionTableRows.length > 0) {
        // Page break check before drawing transaction table
        if (currentY + (transactionTableRows.length * 6) + 15 > doc.internal.pageSize.height - 10) { // Estimate table height
            doc.addPage();
            currentY = 20;
        }

        autoTable(doc, {
          head: [transactionTableColumns],
          body: transactionTableRows,
          startY: currentY,
          theme: 'grid',
          headStyles: { fillColor: [100, 100, 100], fontSize: 8 }, // Darker gray for transaction header
          styles: { fontSize: 8, cellPadding: 1.5 },
          columnStyles: {
            0: { cellWidth: includeDetailedTransactions ? 8 : 25}, // Month # or Date
            // Add more column styles if needed for specific widths
          },
          didDrawPage: (data) => {
            currentY = data.cursor?.y || currentY;
          }
        });
        currentY = (doc as any).autoTable.previous.finalY + 5;
      } else {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'italic');
        doc.text('No transactions to display for this view.', 14, currentY);
        currentY += 6;
      }
    } else {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.text('No transactions for this scheme.', 14, currentY);
      currentY += 6;
    }
  });

  doc.save(`Group_${groupName}_Schemes_Tx.pdf`);
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
    doc.text(`Completed: ${customer.schemesSummary.completedSchemes}`, summaryX, currentY);
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
          scheme.id.toUpperCase(),
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
