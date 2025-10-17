import { notFound } from 'next/navigation';
import { getRequestConfig } from 'next-intl/server';
import { Language } from '@/utils/lang';

// Supported language list
const locales = Object.values(Language);

export default getRequestConfig(async ({ locale }) => {
  // Validate if the requested language is supported
  if (!locales.includes(locale as Language)) {
    notFound();
  }

  // Load corresponding message file based on current language
  const messages = (await import(`../messages/${locale}.json`)).default;

  return {
    messages,
    // When accessing unsupported language, redirect to default language
    onError: (error) => {
      if (error.code === 'MISSING_MESSAGE') {
        console.warn('Missing message:', error.message);
        return null;
      }
      throw error;
    }
  };
}); 