import { clsx, ClassValue } from 'clsx';

/**
 * Utility function to merge class names
 * Wrapper around clsx
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
