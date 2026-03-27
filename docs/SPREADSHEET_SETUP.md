# Spreadsheet Setup

Private Google Sheets cannot be read directly from a browser-only React app unless you add authentication or a server-side bridge.

This app supports a simple bridge using Google Apps Script:

1. Open the response spreadsheet.
2. Open `Extensions > Apps Script`.
3. Paste the contents of [`apps-script/SheetBridge.gs`](/c:/Users/tomat/programming/react/tongari/apps-script/SheetBridge.gs).
4. Deploy it as a Web App.
5. Set execution to your account.
6. Set access to whoever should use this app.
7. Paste the Web App URL into this app's `スプレッドシートURL` field.

Optional:

- Add `?sheet=フォームの回答%201` to target a specific sheet tab.
- Public Google Sheets URLs can also be pasted directly; the app converts them to a CSV export URL automatically.
