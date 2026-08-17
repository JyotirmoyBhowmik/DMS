## 2024-08-17 - Inconsistent Accessibility in Custom Overlays vs Standard Components
**Learning:** Developers often forget essential accessibility attributes (like `aria-label` on icon-only close buttons) when building custom inline modal overlays (as seen in `LandingPage.tsx` and `EnterpriseHierarchy.tsx`), whereas standard shared components (like `Modal.tsx`) typically include them properly.
**Action:** Always audit custom overlays and side panels for missing ARIA attributes, and advocate for refactoring inline modals to use standard, pre-vetted accessible components whenever possible.
