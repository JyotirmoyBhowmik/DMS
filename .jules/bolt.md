## 2026-08-10 - Memoized List Filtering with Hoisted Transformations
**Learning:** Found an opportunity to hoist string transformations outside of a .filter() loop within a React component. The loop executed .toLowerCase() multiple times per item during every render.
**Action:** Always wrap expensive list filtering in useMemo and extract loop-invariant operations (like search.toLowerCase()) out of the filter callback to reduce redundant CPU and memory allocation.
## 2026-08-15 - React Component Render Optimization
**Learning:** React components (like `StockLedger.tsx`) that perform multiple independent `.reduce` or `.filter` passes over large arrays on every render (without memoization) can cause significant performance bottlenecks and layout thrashing, particularly in a data-heavy supply chain application.
**Action:** Always combine multiple array passes into a single `O(n)` traversal loop where possible, and wrap the computation in `useMemo` with the correct dependency array to prevent unnecessary recalculations on re-renders.
## 2026-08-24 - Array Filter Optimization in React
**Learning:** Inside React functional components, recalculating `.toLowerCase()` multiple times per item within list filtering callbacks causes redundant string allocations and memory bloat on each render.
**Action:** Always hoist string manipulations like `search.toLowerCase()` outside of loops (e.g. `filter` or `map`) inside `useMemo` to reduce layout thrashing.
## 2026-08-25 - SyncQueue array processing optimization
**Learning:** React components (like `SyncQueue.tsx`) frequently iterating over the same arrays multiple times with `.filter()` blocks trigger unnecessary allocations and CPU cycles on every render, leading to layout thrashing.
**Action:** Replace multiple redundant array iterations with a single `.reduce()` or `O(n)` traversal pass wrapped in `useMemo` that destructures required variables at once.
