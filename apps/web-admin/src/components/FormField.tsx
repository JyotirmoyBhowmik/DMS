import React, { ReactNode, useId } from 'react';

export interface FormFieldProps {
  label: string;
  children: ReactNode;
  hint?: string;
  id?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  children,
  hint,
  id,
}) => {
  const generatedId = useId();

  // Prefer the ID passed to the FormField wrapper.
  // If not, try to use the child's explicit ID.
  // Finally, fallback to the auto-generated ID.
  const childId = React.isValidElement(children) ? children.props.id : undefined;
  const fieldId = id || childId || generatedId;

  const childWithId = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<any>, { id: fieldId })
    : children;

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
        htmlFor={fieldId}
        style={{
          fontSize: '12px',
          fontWeight: 600,
          color: '#0F172A',
          display: 'block',
        }}
      >
        {label}
      </label>

      {childWithId}

      {hint && (
        <span
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
