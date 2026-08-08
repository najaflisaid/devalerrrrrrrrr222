# De Valeur — PRD

Existing luxury watches/accessories e-commerce. Stack: React + Vite + TypeScript, Firebase/Firestore/Auth/Storage, FastAPI backend (AI chat, Epoint payments, WhatsApp). Preview: https://device-return-2.preview.emergentagent.com

## Feature: Zəmanət Servisi (Warranty / Service Handover) — added 2026-06
Goal: When a customer has a product problem, they hand the product to a store branch, sign a handover act; the store worker accepts it to service; admin advances status; when the repaired item returns to the branch the customer is notified and signs to pick it up.

### User decisions
- Customer registers normally (existing phone-based auth), then accesses warranty from the **menu** (not a separate public link).
- Act fields kept minimal (name/surname come from account): **brand, model number, fault description, branch**, + finger/mouse **signature**.
- Admin **accepts to service by selecting a worker's name** (from existing workers). Status "Servisə qəbul olundu" shows on the customer page.
- Admin can advance status; when set to **Filiala qaytarıldı (at_branch)** the customer page shows a notification and re-opens a **pickup signature**. Customer signs → completed.

### Implementation
- Service: `src/services/warrantyService.ts` — CRUD + realtime on Firestore collection `warranty_services`.
  Statuses: `submitted → accepted → in_service → at_branch → completed`.
- Customer page: `src/pages/WarrantyServicePage.tsx` at route `/warranty` (login-gated). Create-act form + live list with stepper/status, at_branch pickup signature.
- Admin tab: `src/components/admin/WarrantyServiceTab.tsx` — filters (status + branch), accept (worker dropdown from `workers`, optional worker signature), status buttons (Servisə göndərildi / Filiala qaytarıldı), signatures display, delete. Registered in `AdminPanel.tsx` under "Sifarişlər" group, id `warrantyService`.
- Menu links in `Header.tsx`: desktop `header-warranty-link`, account dropdown `account-warranty`, mobile `mobile-warranty-link` (customer role only).
- Reuses existing `InlineSignaturePad`. Branches from `worker_branches`, brands from products.

### Status
- Customer flow: TESTED end-to-end (iteration_16, 100%). 3 branches load; act created; status badge "Təhvil verildi"; menu links present.
- Admin flow: IMPLEMENTED + compiles (production build passes) but NOT yet verified end-to-end — needs an admin login credential.

### Backlog / Next
- P0: Verify admin-side flow (accept → status → at_branch → customer pickup) with an admin account.
- P1: Optional WhatsApp/notification push when status becomes at_branch (currently in-app only on the link).
- P2: Use Firestore auto-id / counter for act numbers instead of Date.now() slice.
