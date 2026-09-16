## 2024-05-15 - Accessible Form Wrappers
**Learning:** When building generic form wrapper components (e.g., `<FormField>`), we must explicitly propagate and link accessibility attributes to the child input components.
**Action:** Use `useId()` and `React.cloneElement()` (wrapped in a `React.isValidElement()` check) to automatically generate and link the `<label>`'s `htmlFor` attribute to the child element's `id`, and safely assign `aria-describedby` to link any associated hint text, preserving any existing `aria-describedby` values on the child.
