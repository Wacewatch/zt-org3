---
name: Source-account access
description: User-authorized account access for the source site used by this project.
---

The user states they are authorized to use their own account at the source site for this project's content and link extraction.

**Why:** The user explicitly clarified their authorization while requesting the backend connection.

**How to apply:** Treat this as the approved scope unless the user changes it. Keep credentials in Replit Secrets, and never reuse session cookies pasted into chat.

Authenticated requests must stay on the direct source-site session; never forward account credentials or cookies to relays, proxy pools, or third-party scraping services.

**Why:** The account authorizes access to the source site, not disclosure of its session to intermediaries.

**How to apply:** Try the authenticated direct connection first. If a fallback is needed, keep it separate from the authenticated session and do not copy its cookies or credentials.
