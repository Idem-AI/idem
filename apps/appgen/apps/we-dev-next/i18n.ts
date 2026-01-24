import { notFound } from 'next/navigation';
import { getRequestConfig } from 'next-intl/server';
import { Language } from './src/utils/lang';

// 支持的语言列表
const locales = Object.values(Language);

export default getRequestConfig(async ({ locale: _locale, requestLocale }) => {
  // 获取请求的语言
  const locale = await requestLocale;
  
  // 验证请求的语言是否受支持
  if (!locales.includes(locale as Language)) {
    notFound();
  }

  // 根据当前语言加载对应的消息文件
  const messages = (await import(`./src/messages/${locale}.json`)).default;

  return {
    locale,
    messages,
    // 当访问不支持的语言时，重定向到默认语言
    onError: (error) => {
      if (error.code === 'MISSING_MESSAGE') {
        console.warn('Missing message:', error.message);
        return null;
      }
      throw error;
    }
  };
}); 