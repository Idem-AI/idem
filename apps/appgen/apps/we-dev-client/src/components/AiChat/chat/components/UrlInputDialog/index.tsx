import useChatModeStore from '@/stores/chatModeSlice';
import useChatStore from '@/stores/chatSlice';
import React, { useState, KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';

interface UrlInputDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (url: string) => void;

}

export const UrlInputDialog: React.FC<UrlInputDialogProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const { t } = useTranslation();
  const { isDeepThinking } = useChatStore();
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  const validateUrl = (url: string) => {
    try {
      const urlObject = new URL(url);
      return urlObject.protocol === 'http:' || urlObject.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleSubmit = () => {
    if (!url.trim()) {
      setError(t('chat.urlInput.errorEmpty'));
      return;
    }

    if (!validateUrl(url)) {
      setError(t('chat.urlInput.errorInvalid'));
      return;
    }

    onSubmit(url);
    setUrl('');
    setError('');
    onClose();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div 
          className="relative w-full max-w-md transform overflow-hidden glass-card p-6 text-left transition-all"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Title */}
          <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100 mb-4">
            {t('chat.urlInput.title')}
          </h3>

          {/* Input */}
          <div className="mt-2">
            <input
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError('');
              }}
              onKeyDown={handleKeyDown}
              className="input"
              placeholder={t('chat.urlInput.placeholder')}
              autoFocus
            />
            {error && (
              <p className="mt-2 text-sm text-red-500">
                {error}
              </p>
            )}
          </div>

          {/* Buttons */}
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="outer-button inline-flex justify-center text-sm font-medium"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="inner-button inline-flex justify-center text-sm font-medium"
            >
              {t('common.confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}; 