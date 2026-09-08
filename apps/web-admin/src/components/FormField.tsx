import React, { ReactNode, useId, isValidElement, cloneElement } from 'react';

export interface FormFieldProps {
  label: string;
  children: ReactNode;
  hint?: string;
}

export const FormField: React.FC<FormFieldProps> = ({ label, children, hint }) => {
  const generatedId = useId();
  const hintId = useId();

  let childToRender = children;

  if (isValidElement<{ id?: string; 'aria-describedby'?: string }>(children)) {
    const childId = children.props.id || generatedId;
    const describedBy = hint ? hintId : children.props['aria-describedby'];

    childToRender = cloneElement(children, {
      ...children.props,
      id: childId,
      'aria-describedby': describedBy,
    });
  }

  const labelHtmlFor = isValidElement<{ id?: string }>(children)
    ? children.props.id || generatedId
    : undefined;

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
        htmlFor={labelHtmlFor}
        style={{
          fontSize: '12px',
          fontWeight: 600,
          color: '#0F172A',
          display: 'block',
        }}
      >
        {label}
      </label>

      {childToRender}

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
