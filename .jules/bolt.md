## 2026-08-10 - Memoized List Filtering with Hoisted Transformations
**Learning:** Found an opportunity to hoist string transformations outside of a .filter() loop within a React component. The loop executed .toLowerCase() multiple times per item during every render.
**Action:** Always wrap expensive list filtering in useMemo and extract loop-invariant operations (like search.toLowerCase()) out of the filter callback to reduce redundant CPU and memory allocation.
