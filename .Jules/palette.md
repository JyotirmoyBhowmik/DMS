## 2026-08-21 - Custom Modal Accessibility Structure
**Learning:** Custom UI dialogs in this application must strictly include basic ARIA roles (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`) and provide an Escape key listener for dismissal, to meet accessibility guidelines without full reliance on third-party libraries.
**Action:** Always ensure any newly implemented or refactored modals are inherently keyboard dismissible and semantically linked to their titles for screen readers.
