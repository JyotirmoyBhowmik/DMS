import React, { ReactNode, useId } from 'react';

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

  let childId = generatedId;
  let enhancedChildren = children;

  if (React.isValidElement<{ id?: string; 'aria-describedby'?: string }>(children)) {
    childId = children.props.id || generatedId;
    enhancedChildren = React.cloneElement(children, {
      id: childId,
      'aria-describedby': [hint ? hintId : undefined, children.props['aria-describedby']].filter(Boolean).join(' ') || undefined,
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

      {enhancedChildren}

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
