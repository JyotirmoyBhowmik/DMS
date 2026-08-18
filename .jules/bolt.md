## 2026-08-10 - Memoized List Filtering with Hoisted Transformations
**Learning:** Found an opportunity to hoist string transformations outside of a .filter() loop within a React component. The loop executed .toLowerCase() multiple times per item during every render.
**Action:** Always wrap expensive list filtering in useMemo and extract loop-invariant operations (like search.toLowerCase()) out of the filter callback to reduce redundant CPU and memory allocation.
## 2026-08-15 - React Component Render Optimization
**Learning:** React components (like `StockLedger.tsx`) that perform multiple independent `.reduce` or `.filter` passes over large arrays on every render (without memoization) can cause significant performance bottlenecks and layout thrashing, particularly in a data-heavy supply chain application.
**Action:** Always combine multiple array passes into a single `O(n)` traversal loop where possible, and wrap the computation in `useMemo` with the correct dependency array to prevent unnecessary recalculations on re-renders.

## 2025-02-14 - React.memo for Presentational Components

**Learning:** Pure presentational components like `DataTable` and `StatCard` in the frontend (especially inside complex dashboards like `AdminDashboard`) should be memoized with `React.memo` to prevent cascading re-renders when parent state updates.
**Action:** Always wrap UI components that render primarily based on props using `React.memo` in complex dashboards or data grid views. Remember to cast generic components like `DataTable<T>` with `as typeof OriginalComponent` when memoizing to preserve TypeScript type inference.
