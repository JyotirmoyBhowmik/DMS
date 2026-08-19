## 2026-08-10 - Memoized List Filtering with Hoisted Transformations
**Learning:** Found an opportunity to hoist string transformations outside of a .filter() loop within a React component. The loop executed .toLowerCase() multiple times per item during every render.
**Action:** Always wrap expensive list filtering in useMemo and extract loop-invariant operations (like search.toLowerCase()) out of the filter callback to reduce redundant CPU and memory allocation.
## 2026-08-15 - React Component Render Optimization
**Learning:** React components (like `StockLedger.tsx`) that perform multiple independent `.reduce` or `.filter` passes over large arrays on every render (without memoization) can cause significant performance bottlenecks and layout thrashing, particularly in a data-heavy supply chain application.
**Action:** Always combine multiple array passes into a single `O(n)` traversal loop where possible, and wrap the computation in `useMemo` with the correct dependency array to prevent unnecessary recalculations on re-renders.
## 2026-08-19 - Eliminate Repeated Array Traversal in Render Loops
**Learning:** Found a pattern where an array was being filtered multiple times inside a `.map()` during render (e.g., to aggregate data for different days in a chart). This causes $O(M \cdot N)$ complexity (where M is map items, N is array length) and unnecessary allocations on every re-render.
**Action:** Always pre-calculate aggregations in a single $O(N)$ pass using `.reduce` or a loop wrapped in a `useMemo` block, and perform simple key lookups inside the render loop instead of full array filtering.
