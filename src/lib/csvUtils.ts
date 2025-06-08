
export function arrayToCSV(data: any[][]): string {
  return data.map(row => 
    row.map(String) // convert every value to String
       .map(v => v.replace(/"/g, '""')) // escape double colons
       .map(v => `"${v}"`) // quote it
       .join(',') // join colons
  ).join('\r\n'); // join rows
}

export function downloadCSV(csvString: string, filename: string) {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

// Basic CSV parser
export function parseCSV(csvText: string): { headers: string[], rows: string[][] } {
  const lines = csvText.split(/\r\n|\n/).filter(line => line.trim() !== '');
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = lines[0].split(',').map(header => header.trim().replace(/^"|"$/g, ''));
  const rows: string[][] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(value => value.trim().replace(/^"|"$/g, ''));
    if (values.length === headers.length) {
      rows.push(values);
    } else {
      console.warn(`Skipping row ${i+1} due to mismatched column count.`);
    }
  }
  return { headers, rows };
}
