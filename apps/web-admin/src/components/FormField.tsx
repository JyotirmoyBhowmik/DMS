import React, { ReactNode, useId, isValidElement, cloneElement } from 'react';

export interface FormFieldProps {
  label: string;
  children: ReactNode;
  hint?: string;
}

export const FormField: React.FC<FormFieldProps> = ({ label, children, hint }) => {
  const generatedId = useId();
  const hintId = hint ? `${generatedId}-hint` : undefined;

  let content = children;
  if (isValidElement<{ id?: string; 'aria-describedby'?: string }>(children)) {
    content = cloneElement(children, {
      id: children.props.id || generatedId,
      'aria-describedby': hintId,
    });
  }

  const finalId = isValidElement<{ id?: string }>(children)
    ? children.props.id || generatedId
    : generatedId;

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
        htmlFor={finalId}
        style={{
          fontSize: '12px',
          fontWeight: 600,
          color: '#0F172A',
          display: 'block',
        }}
      >
        {label}
      </label>

      {content}

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
