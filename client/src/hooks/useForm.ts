import { useState, useCallback, ChangeEvent } from 'react';

export interface UseFormOptions<T> {
  initialValues: T;
  validate?: (values: T) => Partial<Record<keyof T, string>>;
  onSubmit: (values: T) => void | Promise<void>;
}

export interface UseFormResult<T> {
  values: T;
  errors: Partial<Record<keyof T, string>>;
  touched: Partial<Record<keyof T, boolean>>;
  isSubmitting: boolean;
  handleChange: (field: keyof T) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  handleBlur: (field: keyof T) => () => void;
  setFieldValue: (field: keyof T, value: any) => void;
  setValues: (values: Partial<T>) => void;
  setErrors: (errors: Partial<Record<keyof T, string>>) => void;
  resetForm: () => void;
  handleSubmit: (e?: React.FormEvent) => Promise<void>;
}

/**
 * Custom hook for form state management and validation
 *
 * Eliminates boilerplate code for:
 * - Form values state
 * - Change handlers
 * - Validation
 * - Error display
 * - Submit handling
 *
 * @example
 * ```tsx
 * const form = useForm({
 *   initialValues: { name: '', email: '' },
 *   validate: (values) => {
 *     const errors: any = {};
 *     if (!values.name) errors.name = 'Name is required';
 *     if (!values.email) errors.email = 'Email is required';
 *     return errors;
 *   },
 *   onSubmit: async (values) => {
 *     await api.create(values);
 *   }
 * });
 *
 * // In JSX
 * <input
 *   value={form.values.name}
 *   onChange={form.handleChange('name')}
 *   onBlur={form.handleBlur('name')}
 * />
 * {form.touched.name && form.errors.name && <span>{form.errors.name}</span>}
 * ```
 */
export function useForm<T extends Record<string, any>>({
  initialValues,
  validate,
  onSubmit,
}: UseFormOptions<T>): UseFormResult<T> {
  const [values, setValuesState] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = useCallback(
    (field: keyof T) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;

      setValuesState((prev) => ({
        ...prev,
        [field]: value,
      }));

      // Clear error for this field when user types
      if (errors[field]) {
        setErrors((prev) => ({
          ...prev,
          [field]: undefined,
        }));
      }
    },
    [errors]
  );

  const handleBlur = useCallback(
    (field: keyof T) => () => {
      setTouched((prev) => ({
        ...prev,
        [field]: true,
      }));

      // Validate on blur if validator is provided
      if (validate) {
        const validationErrors = validate(values);
        if (validationErrors[field]) {
          setErrors((prev) => ({
            ...prev,
            [field]: validationErrors[field],
          }));
        }
      }
    },
    [validate, values]
  );

  const setFieldValue = useCallback((field: keyof T, value: any) => {
    setValuesState((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  const setValues = useCallback((newValues: Partial<T>) => {
    setValuesState((prev) => ({
      ...prev,
      ...newValues,
    }));
  }, []);

  const resetForm = useCallback(() => {
    setValuesState(initialValues);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
  }, [initialValues]);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      if (e) {
        e.preventDefault();
      }

      // Mark all fields as touched
      const allTouched = Object.keys(values).reduce((acc, key) => {
        acc[key as keyof T] = true;
        return acc;
      }, {} as Partial<Record<keyof T, boolean>>);
      setTouched(allTouched);

      // Validate
      if (validate) {
        const validationErrors = validate(values);
        setErrors(validationErrors);

        // Don't submit if there are errors
        if (Object.keys(validationErrors).length > 0) {
          return;
        }
      }

      // Submit
      try {
        setIsSubmitting(true);
        await onSubmit(values);
      } catch (error) {
        console.error('Form submission error:', error);
        throw error;
      } finally {
        setIsSubmitting(false);
      }
    },
    [values, validate, onSubmit]
  );

  return {
    values,
    errors,
    touched,
    isSubmitting,
    handleChange,
    handleBlur,
    setFieldValue,
    setValues,
    setErrors,
    resetForm,
    handleSubmit,
  };
}
