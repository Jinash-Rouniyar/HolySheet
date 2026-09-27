# HolySheet

Celina — an AI spreadsheet agent. Natural language in, live workbook edits out.

This repo is the spreadsheet app only. The personal site lives in a separate `portfolio` repo and is hosted on [jinash.com](https://www.jinash.com).

```
apps/spreadsheet/    Next.js app + agent harness (port 3002)
```

## Local

```bash
cd apps/spreadsheet
npm install
cp .env.example .env   # add API keys
npm run dev
```

Open `http://localhost:3002/spreadsheet`.

The agent loop is a long-running Node process (SSE + bash/python). Deploy it as a standalone server (e.g. Fly), not Vercel serverless.

## CI

`.github/workflows/spreadsheet.yml` runs lint + build when `apps/spreadsheet/**` changes.
