# TasteMap MVP

## Dev
```bash
cd client
npm install
npm run dev
```

## Env
Create `client/.env` from the example:
```bash
cp .env.example .env
```

Set:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Deploy to Vercel
- Import the repo in Vercel
- Framework Preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- Root Directory: `client`

Add Vercel Environment Variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

This repo also includes a root `vercel.json` for routing SPA paths.
