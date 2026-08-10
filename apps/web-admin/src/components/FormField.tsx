import React, { ReactNode, useId, isValidElement } from 'react';

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
  const defaultId = useId();

  // Extract child id if it has one, otherwise use generated id
  let childId = defaultId;
  let enhancedChildren = children;

  if (isValidElement(children)) {
    // @ts-ignore - Check if children has props.id
    if (children.props && children.props.id) {
      // @ts-ignore
      childId = children.props.id;
    } else {
      // Clone element to inject the generated id
      enhancedChildren = React.cloneElement(children as React.ReactElement<any>, { id: childId });
    }
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
          cursor: 'pointer',
        }}
      >
        {label}
      </label>

      {enhancedChildren}

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
