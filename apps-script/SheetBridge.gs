function doGet(e) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = resolveSheet_(spreadsheet, e && e.parameter);

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

function doPost(e) {
  try {
    var request = parseRequest_(e);
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = resolveSheet_(spreadsheet, {
      sheet: request.sheet || "",
      sheetIndex: request.sheetIndex || "",
    });

    if (!sheet) {
      return createJsonResponse_({ ok: false, error: "Sheet not found." });
    }

    if (!request.row || typeof request.row !== "object") {
      return createJsonResponse_({ ok: false, error: "Row data is required." });
    }

    appendObjectRow_(sheet, request.row);

    return createJsonResponse_({
      ok: true,
      sheet: sheet.getName(),
      appendedAt: new Date().toISOString(),
    });
  } catch (error) {
    return createJsonResponse_({
      ok: false,
      error: error && error.message ? error.message : String(error),
    });
  }
}

function parseRequest_(e) {
  if (e && e.postData && e.postData.contents) {
    var raw = String(e.postData.contents).trim();

    if (raw) {
      return JSON.parse(raw);
    }
  }

  var parameters = (e && e.parameter) || {};
  var row = {};

  Object.keys(parameters).forEach(function(key) {
    if (key !== "sheet") {
      row[key] = parameters[key];
    }
  });

  return {
    sheet: parameters.sheet || "",
    sheetIndex: parameters.sheetIndex || "",
    row: row,
  };
}

function resolveSheet_(spreadsheet, parameters) {
  var params = parameters || {};
  var sheetName = params.sheet ? String(params.sheet).trim() : "";

  if (sheetName) {
    return spreadsheet.getSheetByName(sheetName);
  }

  var sheetIndex = Number(params.sheetIndex);

  if (!isNaN(sheetIndex) && sheetIndex >= 1) {
    return spreadsheet.getSheets()[sheetIndex - 1] || null;
  }

  return spreadsheet.getSheets()[0] || null;
}

function appendObjectRow_(sheet, rowObject) {
  var headers = getHeaders_(sheet);
  var rowKeys = Object.keys(rowObject);

  if (headers.length === 0) {
    headers = rowKeys.slice();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    var missingHeaders = rowKeys.filter(function(key) {
      return headers.indexOf(key) === -1;
    });

    if (missingHeaders.length > 0) {
      headers = headers.concat(missingHeaders);
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  }

  var row = headers.map(function(header) {
    return rowObject[header] || "";
  });

  sheet.appendRow(row);
}

function getHeaders_(sheet) {
  if (sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) {
    return [];
  }

  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
}

function createJsonResponse_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
