## 2024-05-18 - Modal Component Accessibility Requirements
**Learning:** Custom UI dialogs/modals in the `@dms/web-admin` application require explicitly setting fundamental ARIA roles (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`) and implementing an Escape key event listener to close the modal, in order to comply with accessibility standards.
**Action:** When building or updating custom modals, always include `role="dialog"`, `aria-modal="true"`, dynamic `aria-labelledby`, and ensure keyboard accessibility by binding 'Escape' to the modal's close functionality.
## 2024-05-19 - FormField Auto-ID Accessibility
**Learning:** When building generic form wrapper components, ensure accessibility by using `useId()` and `React.cloneElement()` to automatically generate and link the `<label>`'s `htmlFor` attribute to the child element's `id`, and safely assign `aria-describedby` to link any associated hint text.
**Action:** Use `useId` and `cloneElement` in generic form fields to wire up accessibility attributes automatically.
