// Builds a CSV file from column headers + rows and triggers a browser
// download for it -- used by the chart panels' "Download CSV" buttons so
// the exact sweep points behind a plot (frequency, Xc/XL, impedance, ...)
// can be checked in Excel, the same way rlc_auto_sweep_points.csv was
// generated for the Python script.
export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const lines = [headers.join(","), ...rows.map((row) => row.join(","))];
  const csv = lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
