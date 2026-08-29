import React, { ReactNode, useId, isValidElement, cloneElement } from 'react';

export interface FormFieldProps {
  label: string;
  children: ReactNode;
  hint?: string;
}

export const FormField: React.FC<FormFieldProps> = ({ label, children, hint }) => {
  const generatedId = useId();

  // Find the first valid element child and clone it with the generated id
  // if it doesn't already have one
  let childWithId = children;
  let childId = generatedId;

  if (isValidElement(children)) {
    childId = children.props.id || generatedId;
    childWithId = cloneElement(children, { id: childId } as React.HTMLAttributes<HTMLElement>);
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
        htmlFor={childId}
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
