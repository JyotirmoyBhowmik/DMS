## 2026-08-10 - Memoized List Filtering with Hoisted Transformations
**Learning:** Found an opportunity to hoist string transformations outside of a .filter() loop within a React component. The loop executed .toLowerCase() multiple times per item during every render.
**Action:** Always wrap expensive list filtering in useMemo and extract loop-invariant operations (like search.toLowerCase()) out of the filter callback to reduce redundant CPU and memory allocation.
## 2026-08-15 - React Component Render Optimization
**Learning:** React components (like `StockLedger.tsx`) that perform multiple independent `.reduce` or `.filter` passes over large arrays on every render (without memoization) can cause significant performance bottlenecks and layout thrashing, particularly in a data-heavy supply chain application.
**Action:** Always combine multiple array passes into a single `O(n)` traversal loop where possible, and wrap the computation in `useMemo` with the correct dependency array to prevent unnecessary recalculations on re-renders.
## 2026-08-24 - Array Filter Optimization in React
**Learning:** Inside React functional components, recalculating `.toLowerCase()` multiple times per item within list filtering callbacks causes redundant string allocations and memory bloat on each render.
**Action:** Always hoist string manipulations like `search.toLowerCase()` outside of loops (e.g. `filter` or `map`) inside `useMemo` to reduce layout thrashing.
## 2024-05-18 - AdminDashboard Array Filter Anti-pattern
**Learning:** Found a specific codebase pattern where `O(N)` `Array.prototype.filter` methods were being evaluated directly inside of `Array.prototype.map` render loops for potentially large telemetry datasets like `salesOrders`. This creates an `O(N*M)` complexity (where M is the map iteration count, e.g. 7 for days of the week). When React re-renders the dashboard, this causes unnecessary main thread CPU spikes and garbage collection thrashing.
**Action:** Always inspect array iterations inside JSX map blocks. If they loop over the same large dataset repeatedly, hoist the computation into a `useMemo` block that traverses the dataset once `O(N)` to pre-calculate buckets or counts.
