# MANDATORY: Database-First Data Architecture

## Core Principle: Database is the ONLY Source of Truth

### Rule 1: ALWAYS Fetch Fresh Data on Mount

Never load from localStorage as initial state. Always start empty and fetch from API immediately.

### Rule 2: Periodic Auto-Refresh for Live Updates

Every data component must auto-refresh every 30-60 seconds for live environment.

### Rule 3: Optimistic Updates with Immediate API Write

User edits must sync to database immediately with optimistic UI updates.

### Rule 4: localStorage is ONLY Emergency Cache

localStorage is only for offline fallback and UI preferences, never for business data.

See docs/DATA-ARCHITECTURE.md for full implementation details.
