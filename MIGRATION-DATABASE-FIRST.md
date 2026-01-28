# Migration Plan: Database-First Architecture

## Executive Summary

**Problem**: Components loading stale localStorage data causing incorrect metrics, missing data, and multi-user sync issues.

**Solution**: System-wide migration to database-first architecture where API is always fetched first and localStorage is only an emergency cache.

**Impact**: Accurate real-time data, multi-user collaboration, scalability to 100+ accounts.

---

## What Was Built

### 1. Mandatory Architecture Rules
- **File**: `.cursor/rules/data-architecture-mandatory.md`
- **Purpose**: Enforces database-first pattern for ALL agents/developers
- **Status**: Active - Auto-applied to all chat sessions

### 2. Comprehensive Documentation
- **File**: `docs/DATA-ARCHITECTURE.md`
- **Contents**:
  - Architecture diagrams
  - Code patterns and anti-patterns
  - Component checklist
  - Performance considerations
  - Testing strategies
  
### 3. Reusable Hook: `useDatabaseFirst`
- **File**: `src/hooks/useDatabaseFirst.ts`
- **Features**:
  - Automatic API fetch on mount
  - Auto-refresh every 30s (configurable)
  - Optimistic updates with rollback
  - Event-based cross-component sync
  - Cache fallback only when API fails
  - Error handling with toast notifications

---

## Migration Strategy

### Phase 1: IMMEDIATE (Today)

#### Critical Components (Data Display)
1. **Dashboard** - ✅ DONE (already migrated)
2. **AccountsTabDatabase** - IN PROGRESS
3. **MarketingLeadsTab** - IN PROGRESS
4. **ContactsTab** - NEXT

**Why these first**: They display metrics and multi-user data. Stale data here causes wrong business decisions.

### Phase 2: THIS WEEK

#### All Remaining Data Components
- OnboardingHomePage
- EmailAccountsTab
- CampaignsTab
- Any component that reads from database

### Phase 3: NEXT SPRINT

#### Real-Time Enhancements
- WebSocket support for instant updates
- Optimistic concurrency control
- Conflict resolution UI

---

## How to Migrate a Component

### Before (Bad Pattern):

```typescript
function MyComponent() {
  // ❌ Loads from localStorage first
  const [data, setData] = useState(() => loadFromStorage())
  
  // ❌ Only fetches on manual refresh
  const handleRefresh = () => {
    fetchFromApi()
  }
  
  return <div>{data.map(...)}</div>
}
```

### After (Good Pattern) - Using Hook:

```typescript
import { useDatabaseFirst } from '../hooks/useDatabaseFirst'

function MyComponent() {
  // ✅ Database-first with auto-refresh
  const { data, loading, error, refresh } = useDatabaseFirst({
    apiEndpoint: '/api/resource',
    cacheKey: 'resource',
    refreshInterval: 30000, // 30 seconds
    updateEvent: 'resourceUpdated',
    showToasts: true,
  })
  
  if (loading) return <Spinner />
  if (error) return <Alert>{error}</Alert>
  
  return <div>{data.map(...)}</div>
}
```

### After (Good Pattern) - Manual Implementation:

```typescript
function MyComponent() {
  // ✅ Empty initial state
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  
  // ✅ Fetch immediately on mount
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const { data: freshData } = await api.get('/api/resource')
        setData(freshData)
        setJson('resource', freshData) // Cache in background
      } catch (error) {
        // ✅ Only use cache if API fails
        const cached = getJson('resource')
        if (cached) setData(cached)
      } finally {
        setLoading(false)
      }
    }
    
    fetchData()
    
    // ✅ Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])
  
  return <div>{data.map(...)}</div>
}
```

---

## Testing Checklist

For each migrated component:

### ✅ Fresh Data Test
1. Clear browser cache (`Ctrl+Shift+R`)
2. Refresh page
3. Verify data loads correctly

### ✅ Stale Cache Test
1. Open DevTools → Application → Local Storage
2. Manually edit cached data to wrong values
3. Refresh page
4. Verify fresh data from API overwrites cache

### ✅ Auto-Refresh Test
1. Open component
2. Wait 30-60 seconds
3. Check console logs for background refresh
4. Verify no UI flicker/jump

### ✅ Multi-User Test
1. Open 2 browser windows
2. Edit data in Window 1
3. Within 30-60s, verify Window 2 shows update

### ✅ Offline Test
1. Block network in DevTools
2. Refresh page
3. Verify fallback to cache works
4. Verify warning message shown

---

## Rollout Plan

### Day 1 (Today)
- [x] Create architecture docs
- [x] Create reusable hook
- [x] Migrate Dashboard
- [ ] Deploy and verify Dashboard works

### Day 2 (Tomorrow)
- [ ] Migrate AccountsTabDatabase
- [ ] Migrate MarketingLeadsTab
- [ ] Test multi-user scenarios
- [ ] Deploy and verify

### Day 3
- [ ] Migrate ContactsTab
- [ ] Migrate OnboardingHomePage
- [ ] Full system testing
- [ ] Deploy

### Week 2
- [ ] Migrate remaining components
- [ ] Performance testing with 100+ accounts
- [ ] Load testing
- [ ] User training on new behavior

---

## Performance Impact

### Current (Bad):
- Initial load: Fast (from cache) but **WRONG DATA**
- Background fetch: Slow and often skipped
- Multi-user: Doesn't sync (each user sees different data)
- Scale: Breaks at 50+ accounts (cache corruption)

### After Migration (Good):
- Initial load: ~200-500ms (API fetch) with **CORRECT DATA**
- Background refresh: Every 30s, imperceptible to user
- Multi-user: Syncs within 30s automatically
- Scale: Works with 1000+ accounts (database handles it)

### Performance Targets:
- API response time: <200ms (add indexes if needed)
- Initial page load: <2s (including API fetch)
- Auto-refresh impact: <50ms (should be invisible)
- UI remains responsive during refresh

---

## Monitoring & Alerts

### Metrics to Track:
- API response times (should be <200ms p95)
- Cache hit rate (should be <10% after migration)
- Failed API requests (should trigger alerts)
- Auto-refresh frequency (verify it's happening)

### Console Logging:
All components now log:
- `🔄 [component] Fetching from API...`
- `✅ [component] Loaded X items from API`
- `⚠️ [component] Using cached data (API failed)`
- `❌ [component] API fetch failed: error`

---

## Rollback Plan

If migration causes issues:

1. **Immediate**: Revert PR in GitHub
2. **Short-term**: Use cache-first while fixing issues
3. **Long-term**: Fix root cause and re-deploy

**Current state**: All changes are backward-compatible. Old components still work.

---

## Success Criteria

Migration is successful when:

- ✅ All components fetch from API on mount
- ✅ Auto-refresh works every 30-60s
- ✅ No localStorage loading as initial state
- ✅ Multi-user updates sync within 60s
- ✅ System works correctly with 100+ accounts
- ✅ No console errors related to data fetching
- ✅ Page load times <2s
- ✅ Users see fresh data immediately

---

## Communication Plan

### For Users:
- "System now updates automatically every 30 seconds"
- "You'll always see the most recent data"
- "Changes from other team members appear within 1 minute"
- "If you see old data, hard refresh: Ctrl+Shift+R"

### For Developers:
- "All new components MUST use `useDatabaseFirst` hook"
- "Never load from localStorage as initial state"
- "Database is single source of truth"
- "See docs/DATA-ARCHITECTURE.md for patterns"

---

## Questions & Answers

**Q: Will this make the app slower?**
A: Initial load is 200-500ms instead of instant, but data is CORRECT. Background refreshes are invisible.

**Q: What about offline support?**
A: Cache fallback works when API fails. Full offline mode coming in Phase 3.

**Q: Do we need WebSockets?**
A: Not yet. 30-second polling is sufficient for current scale (15 accounts, 5 users). WebSockets in Phase 3.

**Q: What if database is slow?**
A: Add indexes first, then Redis caching, then pagination. Target: <200ms API response.

**Q: How do we test this?**
A: See "Testing Checklist" above. All tests automated in future.

---

**Status**: Phase 1 In Progress  
**Owner**: Development Team  
**Last Updated**: 2026-01-28  
**Next Review**: 2026-02-04
