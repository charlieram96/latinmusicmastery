'use client';
import { useCallback } from 'react';
import { useTranslation } from '@/components/language-provider';
import { studioText } from '@/lib/playsense-studio/i18n/text';

/** Uses the application's existing language preference; never changes score data. */
export function useStudioText() {
  const { locale } = useTranslation();
  return useCallback(<T,>(value: T): T => typeof value === 'string' ? studioText(value, locale) as T : value, [locale]);
}
