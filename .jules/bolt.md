## 2026-08-10 - Memoized List Filtering with Hoisted Transformations
**Learning:** Found an opportunity to hoist string transformations outside of a .filter() loop within a React component. The loop executed .toLowerCase() multiple times per item during every render.
**Action:** Always wrap expensive list filtering in useMemo and extract loop-invariant operations (like search.toLowerCase()) out of the filter callback to reduce redundant CPU and memory allocation.

## 2026-08-13 - Co-location of Expensive Derivations and Controlled Inputs
**Learning:** Found a component where an expensive data derivation (building a tree structure) was re-executed on every keystroke because it was not memoized and co-located with a controlled input form (which triggers frequent state updates).
**Action:** When working with forms or inputs in components that also render complex derived data structures, always ensure the expensive derivations are wrapped in `useMemo` so that typing does not cause O(n) re-calculations and input lag.
