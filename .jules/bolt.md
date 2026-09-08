## 2026-08-10 - Memoized List Filtering with Hoisted Transformations
**Learning:** Found an opportunity to hoist string transformations outside of a .filter() loop within a React component. The loop executed .toLowerCase() multiple times per item during every render.
**Action:** Always wrap expensive list filtering in useMemo and extract loop-invariant operations (like search.toLowerCase()) out of the filter callback to reduce redundant CPU and memory allocation.
## 2026-08-15 - React Component Render Optimization
**Learning:** React components (like `StockLedger.tsx`) that perform multiple independent `.reduce` or `.filter` passes over large arrays on every render (without memoization) can cause significant performance bottlenecks and layout thrashing, particularly in a data-heavy supply chain application.
**Action:** Always combine multiple array passes into a single `O(n)` traversal loop where possible, and wrap the computation in `useMemo` with the correct dependency array to prevent unnecessary recalculations on re-renders.
## 2026-08-24 - Array Filter Optimization in React
**Learning:** Inside React functional components, recalculating `.toLowerCase()` multiple times per item within list filtering callbacks causes redundant string allocations and memory bloat on each render.
**Action:** Always hoist string manipulations like `search.toLowerCase()` outside of loops (e.g. `filter` or `map`) inside `useMemo` to reduce layout thrashing.
## 2026-09-08 - Sync Queue Multiple Array Passes
**Learning:** React functional components that calculate multiple derived states (e.g., pending, failed, synced totals) using independent `.filter()` array passes on every render will cause significant layout thrashing and O(3N) overhead, especially in long lists.
**Action:** Combine multiple independent array passes into a single O(N) traversal loop inside a `useMemo` block to minimize iteration overhead, allocations, and re-renders without breaking readability.
## 2026-09-08 - Dynamic Date Time Bombs
**Learning:** Hardcoding static temporal values (e.g., `new Date('2026-06-15')`) in test suites alongside dynamic validators like `new Date()` inside domain rules leads to temporal test failures (time bombs) when the system time progresses out of the mocked periods.
**Action:** When mocking periods/dates, specifically inside `LedgerPeriod` testing, dynamically generate the periods relative to the current system date/month (e.g., using `new Date().toISOString().slice(0, 7)`) to prevent temporal test failures.
