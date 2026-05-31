# Web Application Firewall (WAF) Hardening Guidance

This document describes the recommended Web Application Firewall (WAF) configurations and security rules to protect the RETURN application in production.

---

## 1. Cloudflare WAF Hardening

If routing traffic through Cloudflare, enable and configure the following rules:

### OWASP Core Ruleset
- **Sensitivity Level**: **Medium** (Standard production baseline to minimize false positives while blocking generic injection attacks).
- **Action**: **Block** for high anomalies; **Challenge (JS Challenge)** for medium anomalies.

### Custom Firewall Rules
Create custom WAF rules under **Security > WAF**:

| Rule Name | Expression | Action | Rationale |
| :--- | :--- | :--- | :--- |
| **Block Tor Exit Nodes** | `ip.geoip.is_in_tor_backbone` | **Managed Challenge** | Prevents automated abuse via anonymizing networks. |
| **Protect Admin Routes** | `http.request.uri.path contains "/admin" and not ip.src in {ENTERPRISE_IPS}` | **Block** or **Challenge** | Limits administration surface area to corporate/VPN IPs. |
| **Block Known Bad Bots** | `cf.client.bot` (verified bots) is false and `cf.edge.server_port` != 443 | **JS Challenge** | Filters script kiddies and scrapers. |
| **Rate Limit API Login** | `http.request.uri.path eq "/api/auth/login"` | **Rate Limit** (10 requests / 5 mins) | Edge-level brute-force mitigation before hitting Origin Serverless functions. |

---

## 2. Vercel WAF & Firewall

If deployed on Vercel (Enterprise or Pro team), configure the Vercel Firewall features via `vercel.json` or Vercel dashboard:

### IP Rate Limiting (Edge Tiers)
Add rate-limiting config to `vercel.json` to prevent serverless function execution exhaustion:

```json
{
  "crons": [
    {
      "path": "/api/cron/cleanup-sessions",
      "schedule": "0 * * * *"
    }
  ],
  "security": {
    "ipRules": {
      "blocked": []
    }
  }
}
```

*Configure in Vercel Dashboard:*
- **Rate Limiting Rule**: Limit `/api/:path*` routes to `100 requests per minute` per client IP.
- **Aggressive Rate Limiting**: Limit `/api/auth/login` to `10 requests per minute` per client IP.

### DDoS Mitigation & Bot Protection
- **Vercel Attack Mode**: Enable under **Project Settings > Security** to trigger challenge pages automatically during a detected DDoS.
- **Managed Directory Blocks**: Block traffic matching common vulnerability scanners (e.g., `.git/config`, `wp-login.php`, `xmlrpc.php`).

---

## 3. Application-Level Rate Limiting Tiers

While Edge WAF blocks massive DDoS and brute-force campaigns, the application level handles granular API limit enforcement (using Upstash Redis / Memory):

- **Auth Routes (`/api/auth/*`)**: 10 requests / 15 minutes per IP + Identifier.
- **Telemetry Uploads (`/api/tracker/*`)**: 60 requests / minute per Device ID.
- **General APIs**: 120 requests / minute per User.

---

## 4. Geo-Blocking Considerations

If the RETURN application serves specific countries or regions (e.g., Middle East or North America):
- **Cloudflare Geo-blocking**: Allow-list target regions (e.g., Egypt, USA, Germany) and apply a **JS Challenge** or **Block** to countries with high botnet activity if they fall outside the operational footprint.
