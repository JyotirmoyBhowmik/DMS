## 2024-05-18 - Modal Component Accessibility Requirements
**Learning:** Custom UI dialogs/modals in the `@dms/web-admin` application require explicitly setting fundamental ARIA roles (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`) and implementing an Escape key event listener to close the modal, in order to comply with accessibility standards.
**Action:** When building or updating custom modals, always include `role="dialog"`, `aria-modal="true"`, dynamic `aria-labelledby`, and ensure keyboard accessibility by binding 'Escape' to the modal's close functionality.

## 2024-05-24 - FormField auto-linking
**Learning:** Wrapper components with labels need to automatically associate the label with the child input using htmlFor and ID. Also aria-describedby for hints.
**Action:** Use useId() and React.cloneElement() to inject an ID into the child if it doesn't have one, and link it to the label and hint.
