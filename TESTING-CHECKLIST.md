# MANDATORY Testing Checklist

## 🚨 CRITICAL RULE

**NO CODE GETS DEPLOYED WITHOUT PASSING ALL CHECKS BELOW**

This checklist is MANDATORY for every deployment. No exceptions.

---

## ✅ Pre-Commit Checklist

### 1. Code Quality
- [ ] No console errors in browser DevTools (F12)
- [ ] No TypeScript errors (`npm run build` passes)
- [ ] No ESLint errors (`npm run lint` if available)
- [ ] All imports are correct and resolved
- [ ] All new components have proper prop types

### 2. Local Testing - Frontend
- [ ] `npm run dev` starts without errors
- [ ] App loads at http://localhost:5173
- [ ] No white screen / loading errors
- [ ] Main navigation works
- [ ] Changed components render correctly
- [ ] No context provider errors (Alert, Toast, etc.)

### 3. Local Testing - Backend
- [ ] `cd server && npm run dev` starts without errors
- [ ] API accessible at http://localhost:3001
- [ ] Test critical endpoints:
  - [ ] GET /api/customers returns data
  - [ ] POST /api/customers creates record
  - [ ] PUT /api/customers/:id updates record
- [ ] Database connection works (Prisma Studio: `npm run prisma:studio`)

### 4. Integration Testing
- [ ] Frontend can communicate with backend
- [ ] Database operations work end-to-end
- [ ] Create, Read, Update operations function
- [ ] Error handling displays properly

---

## ✅ Pre-Deploy Checklist

### 1. Build Verification
```bash
# Frontend build test
npm run build
# Should complete without errors

# Backend TypeScript check
cd server && npx tsc --noEmit
# Should complete without errors
```

- [ ] Production build succeeds
- **PowerShell:** Use `;` not `&&` for chained commands (e.g. `cd server; npm run build` then `cd ..; npm run build`).
- [ ] No build warnings (if possible)
- [ ] Build output looks correct

### 2. Commit Quality
- [ ] Commit message is descriptive
- [ ] Lists what was changed and why
- [ ] Includes testing notes
- [ ] References any related issues/docs

### 3. Documentation
- [ ] README updated if needed
- [ ] Architecture docs updated if structure changed
- [ ] API docs updated if endpoints changed
- [ ] Migration guides created if database changed

---

## ✅ Post-Deploy Checklist

### 1. Deployment Verification (3-5 minutes after push)
- [ ] GitHub Actions workflow completes successfully
  - Check: https://github.com/gregvisser/ODCRM/actions
- [ ] No failed jobs in deployment pipeline
- [ ] Both frontend and backend deployed

### 2. Production Smoke Test
Navigate to: https://odcrm.bidlow.co.uk

- [ ] **App loads without errors**
- [ ] **No white screen**
- [ ] **Sign in works**
- [ ] **Main navigation loads**
- [ ] **Customers tab loads**
- [ ] **Can view customer data**
- [ ] **Can create new customer**
- [ ] **No console errors** (F12 → Console)

### 3. Critical Path Testing
Test the main user flows:
- [ ] User can sign in
- [ ] User can view customers list
- [ ] User can create new customer
- [ ] User can edit existing customer
- [ ] User can view customer details
- [ ] Dashboard loads and shows data

### 4. Browser Compatibility (Spot Check)
- [ ] Chrome/Edge - works
- [ ] Firefox - works (if time permits)
- [ ] Safari - works (if time permits)

---

## 🔧 Component-Specific Testing

### When Adding Chakra UI Components:
- [ ] Component is wrapped in proper provider if needed
- [ ] AlertTitle/AlertDescription inside <Alert>
- [ ] ToastProvider available for useToast
- [ ] ModalProvider available for modals
- [ ] Test in isolation first

### When Adding Database Operations:
- [ ] Test in Prisma Studio first
- [ ] Verify schema matches code
- [ ] Test with sample data
- [ ] Check for SQL injection risks
- [ ] Verify error handling

### When Adding API Endpoints:
- [ ] Test with curl/Postman first
- [ ] Verify authentication works
- [ ] Test error cases (400, 401, 404, 500)
- [ ] Check request/response types
- [ ] Document in API docs

---

## 🚫 Common Mistakes to Avoid

### 1. Context Errors
❌ **Wrong:**
```tsx
// Using AlertTitle outside Alert
<Box>
  <AlertTitle>Title</AlertTitle>
</Box>
```

✅ **Correct:**
```tsx
<Alert>
  <AlertTitle>Title</AlertTitle>
</Alert>
```

### 2. Missing Imports
❌ **Wrong:**
```tsx
// Forgot to import Text
<Text>Hello</Text> // Error!
```

✅ **Correct:**
```tsx
import { Text } from '@chakra-ui/react'
<Text>Hello</Text>
```

### 3. Build vs Dev Differences
- Test production build locally: `npm run build && npm run preview`
- Dev mode might hide errors that break production

---

## 📋 Testing Template

Copy this for each deployment:

```
## Testing Checklist for [Feature Name]

Date: [YYYY-MM-DD]
Developer: [Name]
Branch: [branch name]
Commit: [commit hash]

### Pre-Commit
- [ ] Code quality checks passed
- [ ] Local testing passed
- [ ] Backend API tests passed
- [ ] Integration tests passed

### Pre-Deploy  
- [ ] Build verification passed
- [ ] Commit quality verified
- [ ] Documentation updated

### Post-Deploy
- [ ] GitHub Actions passed
- [ ] Production smoke test passed
- [ ] Critical path testing passed
- [ ] No console errors in production

### Issues Found:
- [List any issues discovered]

### Resolution:
- [How issues were resolved]

Deployed: ✅ / ❌
Notes: [Any additional notes]
```

---

## 🎯 Quality Standards

### Code Must:
1. Build without errors
2. Pass TypeScript checks
3. Have no critical lint issues
4. Work in production build
5. Be tested locally before push

### Deployments Must:
1. Pass all automated checks
2. Be tested in production immediately
3. Have rollback plan ready
4. Be documented properly
5. Fix any issues immediately

---

## 🚨 If Production Breaks

### Immediate Actions:
1. **Acknowledge the issue** - Don't make excuses
2. **Identify the root cause** - What code broke?
3. **Fix it immediately** - Priority #1
4. **Test the fix locally** - Don't deploy broken fixes
5. **Deploy the fix** - Push to main
6. **Verify fix in production** - Immediately after deploy
7. **Document what happened** - Prevent recurrence

### Post-Incident:
1. Document the bug and fix
2. Update this checklist if needed
3. Add regression test if possible
4. Review what checks were missed

---

## 💡 Remember

> **"Test it locally, test it thoroughly, then deploy confidently."**

- If you're unsure, test more
- If it breaks production, it's a critical issue
- No shortcuts, no excuses
- Do it right the first time

---

**Last Updated:** 2026-01-27
**Status:** Active - Mandatory for all deployments
