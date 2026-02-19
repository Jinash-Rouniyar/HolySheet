# Polyglot Monorepo

This repository contains multiple independent applications under `apps/`.

## Structure

```
apps/
  portfolio/          Personal portfolio site (gateway)
  spreadsheet/        Celina AI Spreadsheet (React)
  spreadsheet-api/    Spreadsheet backend API (Express)
```

## Apps

| App | Description | Local Port |
|-----|------------|------------|
| `apps/portfolio` | Portfolio landing page & gateway | 3000 |
| `apps/spreadsheet` | AI-powered spreadsheet app | 3002 |
| `apps/spreadsheet-api` | Express API for research/data | 5000 |

## Getting started

Each app is independent. `cd` into the app folder and run:

```bash
npm install
npm start
```

## CI/CD

Each app has its own GitHub Actions workflow that triggers only when files in that app change.

## Vercel deployment

Each app is deployed as a separate Vercel project with a different **Root Directory**:

- **Portfolio (gateway):** `apps/portfolio` -- owns the custom domain, rewrites to other apps
- **Spreadsheet:** `apps/spreadsheet`
- **Spreadsheet API:** `apps/spreadsheet-api`
