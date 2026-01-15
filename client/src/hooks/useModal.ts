import { useState, useCallback } from 'react';

export interface UseModalResult<T = any> {
  isOpen: boolean;
  data: T | null;
  open: (data?: T) => void;
  close: () => void;
  toggle: () => void;
  setData: (data: T | null) => void;
}

/**
 * Custom hook for managing modal state
 *
 * Eliminates boilerplate code for:
 * - Modal open/close state
 * - Associated data (e.g., selected item for editing)
 * - Open/close handlers
 *
 * @example
 * ```tsx
 * const editModal = useModal<Tournament>();
 *
 * // Open modal with data
 * <button onClick={() => editModal.open(tournament)}>Edit</button>
 *
 * // In modal component
 * <Modal
 *   isOpen={editModal.isOpen}
 *   onClose={editModal.close}
 *   data={editModal.data}
 * />
 * ```
 */
export function useModal<T = any>(initialData: T | null = null): UseModalResult<T> {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<T | null>(initialData);

  const open = useCallback((modalData?: T) => {
    if (modalData !== undefined) {
      setData(modalData);
    }
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    // Optionally clear data on close (uncomment if desired)
    // setTimeout(() => setData(null), 300); // Delay to allow exit animation
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  return {
    isOpen,
    data,
    open,
    close,
    toggle,
    setData,
  };
}

/**
 * Hook for managing multiple related modals
 *
 * @example
 * ```tsx
 * const modals = useModals(['create', 'edit', 'delete'] as const);
 *
 * modals.create.open();
 * modals.edit.open(tournament);
 * modals.delete.open(tournamentId);
 * ```
 */
export function useModals<T extends readonly string[]>(
  names: T
): Record<T[number], UseModalResult> {
  const modals = {} as Record<T[number], UseModalResult>;

  names.forEach((name) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    modals[name] = useModal();
  });

  return modals;
}
