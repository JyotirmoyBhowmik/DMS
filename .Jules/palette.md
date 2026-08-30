## 2024-05-18 - Modal Component Accessibility Requirements
**Learning:** Custom UI dialogs/modals in the `@dms/web-admin` application require explicitly setting fundamental ARIA roles (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`) and implementing an Escape key event listener to close the modal, in order to comply with accessibility standards.
**Action:** When building or updating custom modals, always include `role="dialog"`, `aria-modal="true"`, dynamic `aria-labelledby`, and ensure keyboard accessibility by binding 'Escape' to the modal's close functionality.
## 2024-05-19 - Form Accessibility via Generic Wrappers
**Learning:** Generic form field wrappers (like `FormField`) often break accessibility by failing to link the `<label>` to its corresponding input `<input>`/`<select>` child.
**Action:** When building generic form wrapper components, always use `useId()` and `React.cloneElement()` to automatically generate and link the `<label>`'s `htmlFor` attribute to the child element's `id` attribute. This guarantees accessibility without placing the burden on the consumer.
