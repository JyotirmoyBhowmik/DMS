## 2024-05-18 - Modal Component Accessibility Requirements
**Learning:** Custom UI dialogs/modals in the `@dms/web-admin` application require explicitly setting fundamental ARIA roles (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`) and implementing an Escape key event listener to close the modal, in order to comply with accessibility standards.
**Action:** When building or updating custom modals, always include `role="dialog"`, `aria-modal="true"`, dynamic `aria-labelledby`, and ensure keyboard accessibility by binding 'Escape' to the modal's close functionality.

## 2024-05-24 - Form Accessibility
**Learning:** The application extensively uses a generic `<FormField>` wrapper for labels, but it was missing the critical `htmlFor` <-> `id` connection, breaking accessibility for screen readers and click-to-focus behavior.
**Action:** Implemented automatic `id` generation and injection using `useId()` and `React.cloneElement()` in generic form wrapper components to ensure a11y without needing to manually thread IDs through every form implementation.
