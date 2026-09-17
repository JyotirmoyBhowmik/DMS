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
  const hintId = `${generatedId}-hint`;

  // Try to use the child's existing ID if it has one, otherwise use generated
  let inputId = generatedId;
  let childWithProps = children;

  if (React.isValidElement<{ id?: string, 'aria-describedby'?: string }>(children)) {
    inputId = children.props.id || generatedId;

    // Combine existing aria-describedby with our hint ID if needed
    const existingDescribedBy = children.props['aria-describedby'];
    const newDescribedBy = hint
      ? existingDescribedBy ? `${existingDescribedBy} ${hintId}` : hintId
      : existingDescribedBy;

    childWithProps = React.cloneElement(children, {
      id: inputId,
      'aria-describedby': newDescribedBy,
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
        htmlFor={inputId}
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
