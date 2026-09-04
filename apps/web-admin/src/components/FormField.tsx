import React, { ReactNode, useId, isValidElement, cloneElement } from 'react';

export interface FormFieldProps {
  label: string;
  children: ReactNode;
  hint?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  children,
  hint,
}) => {
  const generatedId = useId();
  const hintId = useId();

  // Generate child id or use existing one if present
  let childId = generatedId;
  if (isValidElement(children) && children.props.id) {
    childId = children.props.id;
  }

  // Inject id and aria-describedby into the child element
  const enhancedChild = isValidElement(children)
    ? cloneElement(children as React.ReactElement<any>, {
        id: childId,
        'aria-describedby': hint ? hintId : undefined,
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

      {enhancedChild}

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
