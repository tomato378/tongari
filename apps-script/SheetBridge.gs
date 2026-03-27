function doGet(e) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = e && e.parameter && e.parameter.sheet ? e.parameter.sheet : "";
  var sheet = sheetName
    ? spreadsheet.getSheetByName(sheetName)
    : spreadsheet.getSheets()[0];

  if (!sheet) {
    return ContentService.createTextOutput(
      JSON.stringify({ error: "Sheet not found." }),
    ).setMimeType(ContentService.MimeType.JSON);
  }

  var values = sheet.getDataRange().getDisplayValues();
  var headers = values.length > 0 ? values[0] : [];
  var rows = values.slice(1).map(function(row) {
    return headers.reduce(function(record, header, index) {
      record[header] = row[index] || "";
      return record;
    }, {});
  });

  return ContentService.createTextOutput(
    JSON.stringify({
      headers: headers,
      rows: rows,
      sheet: sheet.getName(),
    }),
  ).setMimeType(ContentService.MimeType.JSON);
}
