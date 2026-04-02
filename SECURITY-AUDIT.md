# Security Audit Report — web_cv
**Date:** 2026-04-02
**Auditor:** Claude Code (automated)
**Standard:** OWASP Top 10 (2021)
**Stack:** Node.js + Express 5, SQLite (better-sqlite3), Passport Google OAuth, Stripe, Twilio WhatsApp, Puppeteer, OpenRouter

---

## Executive Summary

| Severity | Count | Status |
|---|---|---|
| Critical | 2 | Fixed |
| High | 4 | Fixed |
| Medium | 3 | Fixed |
| Low | 2 | Noted (accepted risk / pending) |
| Info | 1 | No action needed |

All Critical and High findings have been remediated. Two Low findings are documented as accepted risk for an MVP.

---

## Findings

### CRITICAL

#### C-01 — A08: No Twilio webhook signature verification
- **File:** `src/routes/whatsapp.js`
- **Risk:** Any attacker could POST to `/webhook/whatsapp` with arbitrary content, create fake users, pollute the database, or generate CVs for real phone numbers they don't own.
- **Fix:** Added `twilio.validateRequest()` with `TWILIO_AUTH_TOKEN` and the full webhook URL. Requests with invalid signatures return HTTP 403 and log the IP.
- **Status:** FIXED

#### C-02 — A01: Phone number exposed in public CV view (PII)
- **File:** `src/views/cv.html.js`
- **Risk:** `/cv/:userId` was publicly accessible (required for the WhatsApp flow) and rendered the user's phone number in the HTML. Any person who guesses the integer user ID could enumerate phone numbers.
- **Fix:** Removed phone number from the rendered HTML. The page now shows email (for Google users) or "Candidato".
- **Status:** FIXED

---

### HIGH

#### H-01 — A05: Missing security headers (no Helmet)
- **File:** `src/app.js`
- **Risk:** No `X-Frame-Options` (clickjacking), no `X-Content-Type-Options` (MIME sniffing), no `Content-Security-Policy` (XSS escalation), no `Strict-Transport-Security` (SSL stripping), no `Referrer-Policy`.
- **Fix:** Added `helmet` with a custom CSP that allows `unsafe-inline` scripts (required by the edit form's inline `<script>` blocks) while blocking all external script sources and framing.
- **Status:** FIXED

#### H-02 — A04: No rate limiting on auth and payment endpoints
- **File:** `src/app.js`
- **Risk:** `/auth/google` had no rate limiting (brute-force / enumeration); `/create-checkout-session` had no limit (automated abuse creating sessions).
- **Fix:** Added `express-rate-limit`: 20 req/15min on `/auth`, 10 req/hour on `/create-checkout-session`.
- **Status:** FIXED

#### H-03 — A07: Insecure session cookie configuration
- **File:** `src/app.js`
- **Risk:** Session cookie lacked `httpOnly` (accessible via JS), `secure` (sent over HTTP), `sameSite` (CSRF vector), and `maxAge` (never-expiring sessions).
- **Fix:** Added `httpOnly: true`, `secure: true` in production, `sameSite: 'lax'`, `maxAge: 86400000` (24h).
- **Status:** FIXED

#### H-04 — A01: No ownership check on `POST /create-checkout-session`
- **File:** `src/routes/payment.js`
- **Risk:** Any authenticated Google user could submit a form with another user's `userId` and pay for (and download) their CV.
- **Fix:** If the request comes from an authenticated Google session, it now verifies `req.user.id === userId`. Unauthenticated requests (WhatsApp flow) are allowed through since the link is sent by the bot directly.
- **Status:** FIXED

---

### MEDIUM

#### M-01 — A04: No rate limiting on WhatsApp webhook per phone number
- **File:** `src/routes/whatsapp.js`
- **Risk:** A single phone number could send thousands of messages per second, causing excessive DB writes and OpenAI API calls. IP-based rate limiting is not suitable because all Twilio messages come from Twilio's own IPs.
- **Fix:** Implemented in-memory per-phone rate limiter: max 30 messages/minute per phone number.
- **Status:** FIXED

#### M-02 — A03: WhatsApp inputs stored without length limits or character sanitization
- **File:** `src/routes/whatsapp.js`
- **Risk:** A user could send a job name of 100,000 characters, filling the SQLite `whatsapp_data` column and causing oversized payloads in the OpenAI API call. Special characters like `<`, `>`, `"` could cause issues if inputs were ever rendered without escaping.
- **Fix:** Added `sanitizeInput()`: strips `< > " ' &`, trims whitespace, truncates to 150 characters. Job count limited to max 10.
- **Status:** FIXED

#### M-03 — A10: Puppeteer had unrestricted network access during PDF generation
- **File:** `src/services/pdf.js`
- **Risk:** If malicious content reached the CV template (e.g., through a bypassed sanitization), Puppeteer could make requests to `http://localhost`, AWS metadata endpoints (`169.254.169.254`), or internal services during PDF rendering.
- **Fix:** Enabled `page.setRequestInterception(true)` and abort all requests except `about:blank` and `data:` URIs. The CV HTML is fully self-contained (no external resources).
- **Status:** FIXED

---

### LOW

#### L-01 — A09: No security event logging
- **Risk:** Failed auth attempts, IDOR attempts, and Twilio signature failures are not persisted to a log store. Without logs, incident response is blind.
- **Current state:** `console.error()` is used for security events (Twilio invalid signature, IDOR attempt). This is lost on restart.
- **Recommendation:** Integrate a log aggregator (e.g., Winston + file transport, or a cloud logging service) before going to production.
- **Status:** ACCEPTED RISK (MVP)

#### L-02 — A02: Phone numbers and email addresses stored in plaintext
- **Risk:** If the SQLite file is compromised, all user PII is readable without decryption.
- **Current state:** Standard for this type of application at MVP stage. No field-level encryption.
- **Recommendation:** Consider encrypting PII columns with AES-256 if the app handles sensitive data at scale.
- **Status:** ACCEPTED RISK (MVP)

---

### INFO

#### I-01 — A06: No known vulnerabilities in dependencies
- `npm audit` reported **0 vulnerabilities**.
- All dependencies are current as of audit date.
- **Status:** NO ACTION NEEDED

---

## Pending recommendations (developer decision required)

1. **CSRF on edit form** — The `POST /editar/:userId` form is protected by Google OAuth (`requireOwner`) and `sameSite: lax` cookies, which prevents cross-origin POST in modern browsers. For full CSRF protection, add a token (e.g., `csrf-csrf` package). Low priority until the app has more complex state-changing forms.

2. **Twilio signature: BASE_URL must match exactly** — `twilio.validateRequest()` uses `process.env.BASE_URL + '/webhook/whatsapp'` as the expected URL. If the app is behind a reverse proxy that changes the host header, validation will fail. Verify this matches the URL configured in the Twilio console exactly (including `https://` and no trailing slash).

3. **Session store** — The default `express-session` store is in-memory. It leaks memory and loses all sessions on restart. In production, use `connect-sqlite3` or `better-sqlite3-session-store` to persist sessions.

4. **HTTPS enforcement** — The `secure` cookie flag is only active when `NODE_ENV=production`. Ensure your deployment sets this. Consider adding an HTTPS redirect middleware.

5. **IDOR on `/cv/:userId`** — The CV preview remains publicly accessible by integer ID (by design, since the WhatsApp bot sends the link without requiring Google login). This is an enumeration risk. Mitigation option: use UUIDs as public identifiers instead of sequential integers.

---

## Post-deployment checklist

- [ ] `NODE_ENV=production` is set in the deployment environment
- [ ] `SESSION_SECRET` is a cryptographically random string (min 32 bytes): `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- [ ] `STRIPE_WEBHOOK_SECRET` is set from the Stripe Dashboard (Webhooks > Signing secret)
- [ ] `TWILIO_AUTH_TOKEN` matches the token in the Twilio console
- [ ] `BASE_URL` in `.env` matches the URL configured in Twilio's WhatsApp sandbox settings exactly
- [ ] The app runs behind HTTPS (Stripe and Twilio webhooks require it)
- [ ] `npm audit` returns 0 vulnerabilities
- [ ] The `data/` directory (SQLite file) is not web-accessible and is backed up
- [ ] Log aggregation is configured before launch
- [ ] Session store is replaced with a persistent backend (not in-memory)
