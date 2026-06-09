---
name: TanStack Query v5 auth retry
description: Default retry behavior causes an auth-check spinner to hang for several seconds before redirecting to login.
---

The rule: configure the `QueryClient` `retry` option as a function that returns `false` for HTTP 401 errors.

**Why:** TanStack Query v5 defaults to 3 retries with exponential backoff. A 401 from `/api/auth/me` (unauthenticated user) waits through all retries before the error state is set and the AuthGuard redirects to `/login`. This shows a blank/spinner screen for ~10 seconds.

**How to apply:** In `App.tsx` QueryClient setup:
```ts
retry: (failureCount, error: any) => {
  if (error?.status === 401) return false;
  return failureCount < 1;
},
```
Do not pass `retry: false` per-hook via the `query` option — TanStack Query v5 `UseQueryOptions` requires `queryKey` to be present, causing TS2741.
