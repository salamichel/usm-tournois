import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | 'full';
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  className?: string;
}

/**
 * BaseModal - Reusable modal component with consistent styling
 *
 * Features:
 * - Consistent header with title and close button
 * - Flexible content area via children
 * - Optional footer for action buttons
 * - Configurable sizes
 * - Overlay click to close
 * - Escape key to close
 * - Body scroll lock when open
 */
const BaseModal: React.FC<BaseModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'lg',
  showCloseButton = true,
  closeOnOverlayClick = true,
  className = '',
}) => {
  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    full: 'max-w-full mx-4',
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className={`bg-white rounded-lg shadow-xl ${sizeClasses[size]} w-full ${className}`}>
        {/* Header */}
        <div className="border-b p-4 flex items-center justify-between">
          <h2 id="modal-title" className="text-xl font-bold">
            {title}
          </h2>
          {showCloseButton && (
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 transition-colors"
              aria-label="Close modal"
            >
              <X size={24} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-6">{children}</div>

        {/* Footer (optional) */}
        {footer && (
          <div className="border-t p-4 flex items-center justify-end gap-3 bg-gray-50">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default BaseModal;
