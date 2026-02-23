# Templates Delete Verification

## What was fixed
`templates.ts` already used a correct pattern (`findUnique` + `customerId` check).
The frontend fix in the previous sprint was the real bug: `handleDeleteTemplate` now
checks the API error before updating local state (optimistic filter only on success).

## Reproduction steps to verify

1. Open https://odcrm.bidlow.co.uk → Marketing → Templates
2. Select a customer with at least one draft template
3. Click "Delete" on a template
4. **Expected:** Template disappears immediately; stays gone after hard refresh (Ctrl+Shift+R)
5. **Expected:** With browser DevTools open, the DELETE request returns 200 `{ data: { success: true } }`
6. **Cross-tenant test:** Log in as Customer A, attempt `DELETE /api/templates/<Customer-B-template-id>` with Customer A's X-Customer-Id header → must return 404

## Tenant scoping verification (backend)
`templates.ts` DELETE:
```
const existing = await prisma.emailTemplate.findUnique({ where: { id } })
if (!existing) return 404
if (existing.customerId !== customerId) return 404  // ← cross-tenant guard
await prisma.emailTemplate.delete({ where: { id } })
```

Status: ✅ VERIFIED
