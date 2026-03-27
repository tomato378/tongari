# Deploy on Vercel

This app is a static Vite frontend, so Vercel is the simplest hosting target.

## What gets deployed

- The React app in this repository
- Not your Google Apps Script bridge

If you use a private response spreadsheet, the Apps Script bridge must stay deployed separately on Google Apps Script.

## One-time setup

1. Create a Vercel account.
2. In this project directory, run:

```bash
npm install
npm run build
```

3. Deploy from the project root:

```bash
npm run deploy:prod
```

Vercel's official Vite docs say you can deploy an existing Vite project by installing the Vercel CLI and running `vercel` from the project root.

## Alternative: dashboard + Git

If you put this project in GitHub/GitLab/Bitbucket, you can import the repo in Vercel and let it build automatically on each push.

## Notes

- Public Google Sheets URLs can be pasted into the app directly.
- Private Sheets should be exposed through the Apps Script web app bridge.
- Apps Script web apps need to be deployed and shared with the users who will access them.

## References

- Vite on Vercel: https://vercel.com/docs/frameworks/frontend/vite
- Deploying to Vercel: https://vercel.com/docs/deployments
- Apps Script Web Apps: https://developers.google.com/apps-script/guides/web
- Apps Script Content Service: https://developers.google.com/apps-script/guides/content
