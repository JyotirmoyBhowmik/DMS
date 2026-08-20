## 2026-08-10 - Memoized List Filtering with Hoisted Transformations
**Learning:** Found an opportunity to hoist string transformations outside of a .filter() loop within a React component. The loop executed .toLowerCase() multiple times per item during every render.
**Action:** Always wrap expensive list filtering in useMemo and extract loop-invariant operations (like search.toLowerCase()) out of the filter callback to reduce redundant CPU and memory allocation.
## 2026-08-15 - React Component Render Optimization
**Learning:** React components (like `StockLedger.tsx`) that perform multiple independent `.reduce` or `.filter` passes over large arrays on every render (without memoization) can cause significant performance bottlenecks and layout thrashing, particularly in a data-heavy supply chain application.
**Action:** Always combine multiple array passes into a single `O(n)` traversal loop where possible, and wrap the computation in `useMemo` with the correct dependency array to prevent unnecessary recalculations on re-renders.

## 2026-08-20 - Array Counting Optimization with useMemo
**Learning:** Multiple array passes inside React components (e.g. using .filter().length multiple times) are a performance anti-pattern. They cause unnecessary O(k*n) operations on every render.
**Action:** Always fuse multiple array counting loops into a single O(n) pass and wrap the result in useMemo to prevent unnecessary recalculations during unrelated re-renders (like when UI state like selectedError changes).
