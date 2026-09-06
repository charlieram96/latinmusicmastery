import type { Metadata } from "next";
import { Inter, Montserrat } from "next/font/google";
import { cookies } from "next/headers";
import { PageLoadingProvider } from "@/components/page-loading-overlay";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/components/theme-provider";
import { LanguageProvider } from "@/components/language-provider";
import { CourseModeProvider } from "@/contexts/course-mode-context";
import { PlaysenseProvider } from "@/contexts/playsense-context";
import { DEFAULT_LOCALE, LANGUAGE_COOKIE, getTranslation, isLocale } from "@/lib/i18n";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LANGUAGE_COOKIE)?.value;
  const locale = isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;
  return {
    title: getTranslation(locale, "metadata.root.title"),
    description: getTranslation(locale, "metadata.root.description"),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LANGUAGE_COOKIE)?.value;
  const locale = isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${inter.variable} ${montserrat.variable} antialiased font-sans`}
      >
        {/* Applies the stored theme before hydration so light-mode users never see a dark flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <ThemeProvider>
          <LanguageProvider initialLocale={locale}>
            <CourseModeProvider>
              <PlaysenseProvider>
                <PageLoadingProvider>
                  {children}
                </PageLoadingProvider>
              </PlaysenseProvider>
            </CourseModeProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
