## 2026-08-10 - Memoized List Filtering with Hoisted Transformations
**Learning:** Found an opportunity to hoist string transformations outside of a .filter() loop within a React component. The loop executed .toLowerCase() multiple times per item during every render.
**Action:** Always wrap expensive list filtering in useMemo and extract loop-invariant operations (like search.toLowerCase()) out of the filter callback to reduce redundant CPU and memory allocation.
## 2023-11-20 - String Transformations in Memoized Filters
**Learning:** Performing string transformations like `.toLowerCase()` inside array filter operations used in `useMemo` hooks can cause redundant string allocations and increase garbage collection overhead on every render, especially when the search string remains constant throughout the filter loop.
**Action:** Always hoist loop-invariant operations, such as search query transformations, outside of the `.filter()` callback when filtering lists within `useMemo`. Also, add an early return to bypass the filtering loop if the search string is empty.
