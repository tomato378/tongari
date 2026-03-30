# Spreadsheet Setup

Private Google Sheets cannot be read from or written to directly by a browser-only React app unless you add authentication or a bridge.

This project uses Google Apps Script as the bridge for both reading existing responses and writing new form submissions.

1. Open the response spreadsheet.
2. Open `Extensions > Apps Script`.
3. Paste the contents of [`apps-script/SheetBridge.gs`](/c:/Users/tomat/programming/react/tongari/apps-script/SheetBridge.gs).
4. Deploy it as a Web App.
5. Set execution to your account.
6. Set access to the users who should use this app.
7. After updating the script, redeploy the Web App so the latest `doGet` and `doPost` are published.
8. Create `.env.local` in the project root and set:

```bash
VITE_SHEET_BRIDGE_URL=YOUR_APPS_SCRIPT_WEB_APP_URL
```

9. If the response tab is not the first sheet in the spreadsheet, also set:

```bash
VITE_SHEET_BRIDGE_SHEET_NAME=YOUR_SHEET_TAB_NAME
```

10. Restart the Vite dev server after changing `.env.local`.

Optional:

- The Apps Script bridge can append missing columns automatically when the form sends extra metadata.
- Public Google Sheets URLs can still be read directly by the grouping page through CSV export.
