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

  let childWithProps = children;

  if (React.isValidElement<{ id?: string, 'aria-describedby'?: string }>(children)) {
    const childId = children.props.id || generatedId;
    const additionalProps: { id: string; 'aria-describedby'?: string } = {
      id: childId
    };

    if (hint) {
      additionalProps['aria-describedby'] = children.props['aria-describedby']
        ? `${children.props['aria-describedby']} ${hintId}`
        : hintId;
    }

    childWithProps = React.cloneElement(children, additionalProps);
  }

  const labelTargetId = React.isValidElement<{ id?: string }>(children)
    ? (children.props.id || generatedId)
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
        htmlFor={labelTargetId}
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
