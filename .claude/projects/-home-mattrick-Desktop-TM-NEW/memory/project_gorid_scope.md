---
name: GorID is third-party — trade only
description: Trashmarket.fun does not own/create GorID. The GorID feature is only for domain lookups and trading, not registration management.
type: project
---

GorID is a third-party service — Trashmarket.fun is not the owner/creator.

**Why:** The dApp integrates GorID for trading/lookup purposes only. Registration and admin functions are out of scope.

**How to apply:** When working on goridService.ts or the GorID page, only implement lookup and trade flows. Don't build registration/management features. QA checklist should test domain search and trade, not registration.
