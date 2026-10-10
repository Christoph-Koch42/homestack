import { useId, type InputHTMLAttributes, type ReactNode, type Ref, type SelectHTMLAttributes } from 'react';
import './Field.css';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hideLabel?: boolean;
  big?: boolean;
  hint?: ReactNode;
  ref?: Ref<HTMLInputElement>;
}

// Underlined input; the line turns red on focus. No glow.
export default function Field({ label, hideLabel, big, hint, className = '', ...rest }: FieldProps) {
  const id = useId();
  return (
    <div className={`field ${big ? 'field--big' : ''} ${className}`}>
      <label htmlFor={id} className={hideLabel ? 'visually-hidden' : 'label field__label'}>
        {label}
      </label>
      <input id={id} className="field__input" {...rest} />
      {hint && <p className="field__hint">{hint}</p>}
    </div>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  children: ReactNode;
}

export function SelectField({ label, className = '', children, ...rest }: SelectProps) {
  const id = useId();
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id} className="label field__label">
        {label}
      </label>
      <select id={id} className="field__input field__select" {...rest}>
        {children}
      </select>
    </div>
  );
}
