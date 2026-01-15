import { useState, useMemo, useCallback } from 'react';

export interface UseTableDataOptions<T> {
  data: T[];
  /**
   * Function to extract searchable text from an item
   */
  searchFields?: (item: T) => string[];
  /**
   * Function to filter items based on a filter value
   */
  filterFn?: (item: T, filterValue: string) => boolean;
  /**
   * Initial sort field
   */
  initialSortField?: keyof T;
  /**
   * Initial sort direction
   */
  initialSortDirection?: 'asc' | 'desc';
}

export interface UseTableDataResult<T> {
  filteredData: T[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filterValue: string;
  setFilterValue: (value: string) => void;
  sortField: keyof T | null;
  sortDirection: 'asc' | 'desc';
  setSorting: (field: keyof T) => void;
  totalCount: number;
  filteredCount: number;
}

/**
 * Custom hook for managing table/list data with search, filter, and sort
 *
 * Eliminates boilerplate code for:
 * - Search functionality
 * - Filter functionality
 * - Sort functionality
 * - Derived counts
 *
 * @example
 * ```tsx
 * const { filteredData, searchQuery, setSearchQuery } = useTableData({
 *   data: tournaments,
 *   searchFields: (t) => [t.name, t.location],
 *   filterFn: (t, filter) => filter === 'all' || t.status === filter,
 * });
 * ```
 */
export function useTableData<T extends Record<string, any>>({
  data,
  searchFields,
  filterFn,
  initialSortField = null,
  initialSortDirection = 'asc',
}: UseTableDataOptions<T>): UseTableDataResult<T> {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterValue, setFilterValue] = useState('all');
  const [sortField, setSortField] = useState<keyof T | null>(initialSortField);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(initialSortDirection);

  const filteredData = useMemo(() => {
    let result = [...data];

    // Apply search filter
    if (searchQuery && searchFields) {
      const query = searchQuery.toLowerCase();
      result = result.filter((item) => {
        const fields = searchFields(item);
        return fields.some((field) => field?.toLowerCase().includes(query));
      });
    }

    // Apply custom filter
    if (filterValue !== 'all' && filterFn) {
      result = result.filter((item) => filterFn(item, filterValue));
    }

    // Apply sorting
    if (sortField) {
      result.sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];

        if (aVal === bVal) return 0;

        let comparison = 0;
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          comparison = aVal.localeCompare(bVal);
        } else if (typeof aVal === 'number' && typeof bVal === 'number') {
          comparison = aVal - bVal;
        } else if (aVal instanceof Date && bVal instanceof Date) {
          comparison = aVal.getTime() - bVal.getTime();
        } else {
          comparison = String(aVal).localeCompare(String(bVal));
        }

        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  }, [data, searchQuery, filterValue, sortField, sortDirection, searchFields, filterFn]);

  const setSorting = useCallback(
    (field: keyof T) => {
      if (sortField === field) {
        // Toggle direction
        setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        // New field, default to asc
        setSortField(field);
        setSortDirection('asc');
      }
    },
    [sortField]
  );

  return {
    filteredData,
    searchQuery,
    setSearchQuery,
    filterValue,
    setFilterValue,
    sortField,
    sortDirection,
    setSorting,
    totalCount: data.length,
    filteredCount: filteredData.length,
  };
}
