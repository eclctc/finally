# FinAlly frontend

Next.js + TypeScript + Tailwind, exported as static files (`out/`) and served by the FastAPI backend.

```bash
npm install
npm run dev      # http://localhost:3000, proxies /api to the backend on :8000
npm test         # Vitest + React Testing Library
npm run build    # static export to out/
```
