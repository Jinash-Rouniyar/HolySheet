# Holysheet backend (Express API)

Deploy this folder as a **separate Vercel project** for the API only.

## Vercel deployment

1. In Vercel: **New Project** → same repo.
2. **Root Directory:** set to **`backend`** (this folder).
3. **Build Command:** leave empty or set to **`npm install`**.
4. **Environment variables:** add `PERPLEXITY_API_KEY` in the project settings.
5. Deploy.

## Local run

```bash
cd backend
npm install
# Create .env with PERPLEXITY_API_KEY=your_key
npm start
```

API base will be `http://localhost:5000` (e.g. `GET /api`, `POST /api/research`).
