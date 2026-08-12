## 2026-08-10 - Memoized List Filtering with Hoisted Transformations
**Learning:** Found an opportunity to hoist string transformations outside of a .filter() loop within a React component. The loop executed .toLowerCase() multiple times per item during every render.
**Action:** Always wrap expensive list filtering in useMemo and extract loop-invariant operations (like search.toLowerCase()) out of the filter callback to reduce redundant CPU and memory allocation.

## 2026-08-12 - Consolidating Multiple Array Passes
**Learning:** React components often accumulate multiple separate array methods (`filter`, `reduce`, `map`) computing derived state from the same source array (e.g., Stock Ledger calculating units, value, alerts, and groupings independently). This results in multiple O(N) traversals on every render, wasting CPU and creating excessive garbage collection overhead.
**Action:** When computing multiple metrics from a single array, use a single `useMemo` block with one `for` loop to compute all derived state simultaneously.
