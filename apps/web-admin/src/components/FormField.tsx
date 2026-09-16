import React, { ReactNode, useId } from 'react';

export interface FormFieldProps {
  label: string;
  children: ReactNode;
  hint?: string;
}

export const FormField: React.FC<FormFieldProps> = ({ label, children, hint }) => {
  const generatedId = useId();
  const hintId = `${generatedId}-hint`;

  // Safely clone children to inject ID and aria-describedby if it's a valid React element
  let childContent = children;
  let childId: string | undefined;

  if (React.isValidElement<{ id?: string; 'aria-describedby'?: string }>(children)) {
    childId = children.props.id || generatedId;
    const existingDescribedBy = children.props['aria-describedby'];
    const newDescribedBy = hint
      ? existingDescribedBy
        ? `${existingDescribedBy} ${hintId}`
        : hintId
      : existingDescribedBy;

    childContent = React.cloneElement(children, {
      id: childId,
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

      {childContent}

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
