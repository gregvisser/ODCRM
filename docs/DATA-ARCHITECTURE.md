# Data Architecture: Database-First System

## Overview

This document defines the data architecture for the OpenDoors CRM system. **ALL components must follow these patterns.**

## Core Principle

**The database is the single source of truth. localStorage is only a cache.**

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     USER INTERFACE (React)                   │
│                                                              │
│  Component State (useState)                                  │
│  ↓ Initial: [] (empty)                                      │
│  ↓ After fetch: [fresh data from API]                       │
└─────────────────────────────────────────────────────────────┘
                            ↓ ↑
                    Fetch    │ │    Update
                    (GET)    │ │    (PUT/POST)
                            ↓ ↑
┌─────────────────────────────────────────────────────────────┐
│                     API LAYER (Express)                      │
│                                                              │
│  /api/customers     - GET, POST, PUT, DELETE                │
│  /api/leads         - GET (with real-time sync)             │
│  /api/contacts      - GET, POST, PUT, DELETE                │
└─────────────────────────────────────────────────────────────┘
                            ↓ ↑
                    Query    │ │    Write
                            ↓ ↑
┌─────────────────────────────────────────────────────────────┐
│                DATABASE (PostgreSQL via Prisma)              │
│                                                              │
│  customers table    - Source of truth for accounts          │
│  lead_records table - Source of truth for leads             │
│  contacts table     - Source of truth for contacts          │
│                                                              │
│  + Background Workers:                                       │
│    - leadsSync.ts (syncs Google Sheets every 10 mins)       │
└─────────────────────────────────────────────────────────────┘
                            ↓ ↑
              (Background only)
                            ↓ ↑
┌─────────────────────────────────────────────────────────────┐
│              LOCALSTORAGE (Emergency Cache Only)             │
│                                                              │
│  Used only when:                                            │
│  1. API request fails (network error)                       │
│  2. User is offline                                         │
│  3. Storing UI preferences (theme, tab positions)           │
│  4. Storing drafts of unsaved work                          │
│                                                              │
│  NEVER used as primary data source                          │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow Patterns

### Pattern 1: Component Initialization (Read)

```typescript
function MyComponent() {
  // 1. Start with empty state
  const [data, setData] = useState<Data[]>([])
  const [loading, setLoading] = useState(true)
  
  // 2. Fetch immediately on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: freshData } = await api.get('/api/resource')
        setData(freshData) // UI updates with fresh data
        setJson(StorageKeys.resource, freshData) // Cache in background
      } catch (error) {
        // 3. Only use cache if API fails
        const cached = getJson(StorageKeys.resource)
        if (cached) setData(cached)
      } finally {
        setLoading(false)
      }
    }
    
    fetchData()
  }, [])
  
  // ... render with data
}
```

### Pattern 2: Live Updates (Polling)

```typescript
useEffect(() => {
  // Fetch on mount
  fetchData()
  
  // Auto-refresh every 30 seconds
  const interval = setInterval(() => {
    fetchData() // Silent background refresh
  }, 30000)
  
  return () => clearInterval(interval)
}, [])
```

### Pattern 3: User Updates (Write)

```typescript
const updateItem = async (id: string, updates: Partial<Item>) => {
  try {
    // 1. Optimistic update (instant UI feedback)
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ))
    
    // 2. Sync to database immediately
    await api.put(`/api/items/${id}`, updates)
    
    // 3. Broadcast to other components
    emit('itemsUpdated')
    
  } catch (error) {
    // 4. Revert on failure
    toast({ title: 'Failed to save', status: 'error' })
    fetchData() // Re-fetch correct state
  }
}
```

## Component Checklist

Every data component MUST have:

- [x] Empty initial state (no localStorage load)
- [x] Immediate API fetch on mount
- [x] Loading state during first fetch
- [x] Auto-refresh interval (30-60s)
- [x] Error handling with cache fallback
- [x] Event listeners for cross-component updates
- [x] Optimistic updates for writes
- [x] Revert mechanism for failed writes

## Current Implementation Status

### ✅ Fully Migrated
- `DashboardsHomePage.tsx` - Database-first, auto-refresh

### ⚠️ Needs Migration
- `AccountsTabDatabase.tsx` - Has hydration but needs auto-refresh
- `MarketingLeadsTab.tsx` - Has filtering issues, needs refactor
- `ContactsTab.tsx` - Needs database-first pattern
- `OnboardingHomePage.tsx` - Needs database-first pattern

### 📋 Migration Priority
1. **Critical** (Do First): Components that display metrics/counts
2. **High**: Components that show multi-user data
3. **Medium**: Components with editable forms
4. **Low**: Read-only informational components

## Performance Considerations

### For Small Scale (1-50 accounts)
- Auto-refresh: Every 30 seconds
- No pagination needed
- Simple API queries

### For Medium Scale (50-500 accounts)
- Auto-refresh: Every 60 seconds
- Pagination: 50 items per page
- Database indexes on all query fields

### For Large Scale (500+ accounts)
- Auto-refresh: Every 2-3 minutes OR use WebSockets
- Pagination: 50 items per page
- Advanced database optimization
- Consider Redis caching layer
- Implement virtual scrolling for large lists

## Testing Strategy

### Unit Tests
- Test component fetches data on mount
- Test fallback to cache when API fails
- Test optimistic updates and reverts

### Integration Tests
- Test multi-user scenarios (2+ tabs)
- Test data consistency across components
- Test auto-refresh doesn't cause flicker

### Performance Tests
- Test with 100+ accounts
- Measure page load time (<2s)
- Measure auto-refresh impact (should be imperceptible)

## Migration Script Template

For migrating existing components:

```typescript
// BEFORE (BAD):
const [data, setData] = useState(() => loadFromStorage())

// AFTER (GOOD):
const [data, setData] = useState([])
const [loading, setLoading] = useState(true)

useEffect(() => {
  const fetchData = async () => {
    setLoading(true)
    try {
      const { data: freshData } = await api.get('/api/resource')
      setData(freshData)
      setJson(StorageKeys.resource, freshData)
    } catch (error) {
      const cached = getJson(StorageKeys.resource)
      if (cached) setData(cached)
    } finally {
      setLoading(false)
    }
  }
  
  fetchData()
  const interval = setInterval(fetchData, 30000)
  return () => clearInterval(interval)
}, [])
```

## Future Enhancements

### Phase 1: Real-time Updates (WebSockets)
- Replace polling with WebSocket connections
- Instant updates across all users
- Reduced server load

### Phase 2: Optimistic Concurrency Control
- Version numbers on all records
- Detect and resolve conflicts
- Merge strategies for simultaneous edits

### Phase 3: Offline Support
- Service Worker for offline mode
- Queue writes when offline
- Sync when connection restored

## Questions & Answers

**Q: Why not use React Query or SWR?**
A: We can migrate to these libraries later. For now, we're establishing the pattern that works with our current setup.

**Q: What about real-time collaboration?**
A: Coming in Phase 1. For now, 30-second polling is sufficient for the fast-paced environment.

**Q: Isn't 30-second polling expensive?**
A: No, API calls are lightweight. With 10 users × 5 components × 30s = ~1000 requests/hour, which is negligible.

**Q: What if database is slow?**
A: Optimize queries first (indexes, limits). Then add Redis caching. Last resort: increase polling interval.

---

**Maintained by**: Development Team  
**Last Updated**: 2026-01-28  
**Status**: Active Architecture
