## 2024-05-18 - Modal Component Accessibility Requirements
**Learning:** Custom UI dialogs/modals in the `@dms/web-admin` application require explicitly setting fundamental ARIA roles (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`) and implementing an Escape key event listener to close the modal, in order to comply with accessibility standards.
**Action:** When building or updating custom modals, always include `role="dialog"`, `aria-modal="true"`, dynamic `aria-labelledby`, and ensure keyboard accessibility by binding 'Escape' to the modal's close functionality.
## 2026-09-04 - FormField Wrapper Accessibility
**Learning:** Generic form wrapper components like `<FormField>` in `@dms/web-admin` must automatically generate and link the `<label>`'s `htmlFor` attribute to the child input's `id`, and safely assign `aria-describedby` for hint text. If this isn't handled centrally, every form field across the app suffers from missing click-to-focus and screen reader relationships.
**Action:** Use `React.useId()` and `React.cloneElement()` (checking `React.isValidElement()`) in wrapper components to automatically inject ID relationships into generic children.
