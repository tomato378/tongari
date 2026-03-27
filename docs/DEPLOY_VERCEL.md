# Deploy on Vercel

This app is a static Vite frontend, so Vercel is the simplest hosting target.

## What gets deployed

- The React app in this repository
- Not your Google Apps Script bridge

If you use a private response spreadsheet, the Apps Script bridge must stay deployed separately on Google Apps Script.

## GitHub + Vercel dashboard flow

### 1. Log in to GitHub CLI

```bash
gh auth login
```

### 2. Create the GitHub repository and push `main`

From the project root:

```bash
gh repo create
git push -u origin main
```

If you want to skip the interactive prompts, you can also run:

```bash
gh repo create YOUR_REPO_NAME --private --source=. --remote=origin --push
```

### 3. Import the repository in the Vercel dashboard

1. Open the Vercel dashboard.
2. Click `New Project`.
3. Choose `Import Git Repository`.
4. Connect GitHub if prompted.
5. Select the repository you just pushed.
6. Keep the detected Vite settings and deploy.

Once connected, pushes to `main` will trigger production deployments automatically.

## One-time setup without GitHub

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

## Notes

- Public Google Sheets URLs can be pasted into the app directly.
- Private Sheets should be exposed through the Apps Script web app bridge.
- Apps Script web apps need to be deployed and shared with the users who will access them.

## References

- Vite on Vercel: https://vercel.com/docs/frameworks/frontend/vite
- Deploying to Vercel: https://vercel.com/docs/deployments
- Apps Script Web Apps: https://developers.google.com/apps-script/guides/web
- Apps Script Content Service: https://developers.google.com/apps-script/guides/content
