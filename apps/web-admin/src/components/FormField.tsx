import React, { ReactNode, useId } from 'react';

export interface FormFieldProps {
  label: string;
  children: ReactNode;
  hint?: string;
}

export const FormField: React.FC<FormFieldProps> = ({ label, children, hint }) => {
  const id = useId();
  const hintId = `${id}-hint`;

  let child = children;
  let labelId = id;

  if (React.isValidElement<{ id?: string; 'aria-describedby'?: string }>(children)) {
    labelId = children.props.id || id;
    const existingAriaDescribedBy = children.props['aria-describedby'];
    const ariaDescribedBy = hint
      ? [existingAriaDescribedBy, hintId].filter(Boolean).join(' ')
      : existingAriaDescribedBy;

    child = React.cloneElement(children, {
      id: labelId,
      ...(ariaDescribedBy ? { 'aria-describedby': ariaDescribedBy } : {}),
    });
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        marginBottom: '16px',
        width: '100%',
      }}
    >
      <label
        htmlFor={labelId}
        style={{
          fontSize: '12px',
          fontWeight: 600,
          color: '#0F172A',
          display: 'block',
        }}
      >
        {label}
      </label>

      {child}

      {hint && (
        <span
          id={hintId}
          style={{
            fontSize: '12px',
            color: '#64748B',
          }}
        >
          {hint}
        </span>
      )}
    </div>
  );
};
