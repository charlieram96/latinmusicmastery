"use client";

import {useTranslation} from '@/components/language-provider';

/** Label the displayed waveform, independently of the playback source switch. */
export function AudioWaveformLabel({source}: {source: 'original' | 'imported' | 'mixed'}) {
  const {locale} = useTranslation();
  const labels = locale === 'es'
    ? {original: 'Audio original del video', imported: 'Audio de reemplazo', mixed: 'Audio original + reemplazos'}
    : {original: 'Original video audio', imported: 'Replacement audio', mixed: 'Original audio + replacements'};
  return <span className="text-xs font-medium text-foreground">{labels[source]}</span>;
}
