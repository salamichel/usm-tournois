import { useState, useEffect, useCallback, DependencyList } from 'react';
import { toast } from 'react-toastify';

export interface UseAsyncDataOptions<T> {
  /**
   * Function that fetches the data
   */
  fetchFn: () => Promise<T>;

  /**
   * Dependencies array for useEffect (when to refetch)
   */
  dependencies?: DependencyList;

  /**
   * Custom error message
   */
  errorMessage?: string;

  /**
   * Whether to fetch data on mount
   */
  fetchOnMount?: boolean;

  /**
   * Callback when data is successfully loaded
   */
  onSuccess?: (data: T) => void;

  /**
   * Callback when an error occurs
   */
  onError?: (error: any) => void;
}

export interface UseAsyncDataResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  setData: React.Dispatch<React.SetStateAction<T | null>>;
}

/**
 * Custom hook for managing async data fetching with loading and error states
 *
 * Eliminates boilerplate code for:
 * - Loading states
 * - Error handling with toast notifications
 * - useEffect + async data fetching
 * - Manual refetch capability
 *
 * @example
 * ```tsx
 * const { data: tournaments, loading, refetch } = useAsyncData({
 *   fetchFn: () => adminService.getAllTournaments(),
 *   errorMessage: 'Failed to load tournaments'
 * });
 * ```
 */
export function useAsyncData<T>({
  fetchFn,
  dependencies = [],
  errorMessage = 'Failed to load data',
  fetchOnMount = true,
  onSuccess,
  onError,
}: UseAsyncDataOptions<T>): UseAsyncDataResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(fetchOnMount);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await fetchFn();
      setData(result);

      if (onSuccess) {
        onSuccess(result);
      }
    } catch (err: any) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);

      // Show error toast
      const message = err?.response?.data?.message || err?.message || errorMessage;
      toast.error(message);

      if (onError) {
        onError(err);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchFn, errorMessage, onSuccess, onError]);

  useEffect(() => {
    if (fetchOnMount) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    setData,
  };
}

/**
 * Hook for managing form submission with loading and error states
 *
 * @example
 * ```tsx
 * const { loading, submit } = useAsyncSubmit({
 *   submitFn: (data) => adminService.createTournament(data),
 *   successMessage: 'Tournament created!',
 *   onSuccess: () => navigate('/admin/tournaments')
 * });
 * ```
 */
export interface UseAsyncSubmitOptions<TInput, TOutput> {
  submitFn: (data: TInput) => Promise<TOutput>;
  successMessage?: string;
  errorMessage?: string;
  onSuccess?: (result: TOutput) => void;
  onError?: (error: any) => void;
}

export interface UseAsyncSubmitResult<TInput> {
  loading: boolean;
  submit: (data: TInput) => Promise<void>;
}

export function useAsyncSubmit<TInput = any, TOutput = any>({
  submitFn,
  successMessage,
  errorMessage = 'Operation failed',
  onSuccess,
  onError,
}: UseAsyncSubmitOptions<TInput, TOutput>): UseAsyncSubmitResult<TInput> {
  const [loading, setLoading] = useState(false);

  const submit = useCallback(
    async (data: TInput) => {
      try {
        setLoading(true);
        const result = await submitFn(data);

        if (successMessage) {
          toast.success(successMessage);
        }

        if (onSuccess) {
          onSuccess(result);
        }
      } catch (err: any) {
        const message = err?.response?.data?.message || err?.message || errorMessage;
        toast.error(message);

        if (onError) {
          onError(err);
        }

        throw err; // Re-throw so caller can handle if needed
      } finally {
        setLoading(false);
      }
    },
    [submitFn, successMessage, errorMessage, onSuccess, onError]
  );

  return {
    loading,
    submit,
  };
}
