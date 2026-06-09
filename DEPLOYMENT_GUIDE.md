# Deployment Guide

## Best public deployment option for this final build
This project now works best on any Node.js host that gives you a **persistent filesystem** or a mounted volume, because the live data store uses `src/data/return.db` and `src/data/store.json`.

Good choices:
- VPS or cloud VM
- Docker on a server with a mounted volume
- Any Node hosting that supports persistent disk

Use Vercel only after replacing the filesystem store with an external database.

## Quick public deployment with Docker
```bash
cp .env.example .env.local

docker compose -f docker-compose.app.yml up --build -d
```

Your public host should keep `src/data` mounted so new users, reports, matches, chats, and devices stay saved after restart.

## Manual production run
```bash
npm install
npm run build
npm start
```

## Environment variables
Create `.env.local`:
```env
NEXT_PUBLIC_APP_URL=https://your-domain.example
RESEND_API_KEY=your_resend_api_key
EMAIL_FROM=verified-sender@your-domain.example
```

## Public rollout checklist
1. Point your domain to the server.
2. Add the environment variables above.
3. Build and start the app.
4. Keep `src/data` persistent.
5. Test sign-up, sign-in, missing/found reports, AI photo matching, case details, device registration, and chat.

## Notes for the graduation project demo
- AI photo matching is now image-first whenever both reports include photos with AI visual analysis.
- GPS, QR, NFC, Bluetooth, and Wi-Fi are all enabled in the device layer and clearly documented inside the dashboard UI.
- If email delivery is not configured, the OTP code is still written to `src/data/outbox.json`.
- For long-term scale, migrate the file store to PostgreSQL or another managed database.
