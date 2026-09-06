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
  const hintId = hint ? `${generatedId}-hint` : undefined;

  let childWithProps = children;
  let htmlFor = generatedId;

  if (React.isValidElement(children)) {
    const childId = children.props.id || generatedId;
    htmlFor = childId;

    const childProps: any = { id: childId };
    if (hintId) {
      childProps['aria-describedby'] = children.props['aria-describedby']
        ? `${children.props['aria-describedby']} ${hintId}`
        : hintId;
    }

    childWithProps = React.cloneElement(children, childProps);
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
        htmlFor={htmlFor}
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
