import React, { ReactNode, useId, isValidElement, cloneElement } from 'react';

export interface FormFieldProps {
  label: string;
  children: ReactNode;
  hint?: string;
}

export const FormField: React.FC<FormFieldProps> = ({ label, children, hint }) => {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;

  const childWithProps = isValidElement(children)
    ? cloneElement(children as React.ReactElement<any>, {
        id: children.props.id || id,
        'aria-describedby': hintId || children.props['aria-describedby'],
      })
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
        htmlFor={isValidElement(children) ? children.props.id || id : undefined}
        style={{
          fontSize: '12px',
          fontWeight: 600,
          color: '#0F172A',
          display: 'block',
        }}
      >
        {label}
      </label>

      {childWithProps}

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
