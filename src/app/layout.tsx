import { PolicyEngineShell } from "@policyengine/ui-kit/layout";
import "@policyengine/ui-kit/styles.css";

import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';
// The PolicyEngine tokens, bundled with the page instead of fetched from
// unpkg. After globals.css, as the unpkg sheet was: its spacing values win,
// so the page lays out as before. Values match design-system 0.4.0's for
// every token the page uses (it differs only in colours nothing here reads).
import '@policyengine/ui-kit/legacy/tokens.css';
import './fonts.css';
import './siteHeader.css';
import localFont from 'next/font/local';
import SiteFooter from '@/components/SiteFooter';
import { SITE_HEADER_STYLES, SITE_NAV_ITEMS } from '@/utils/siteNav';
import { DEEP_LINK_SCRIPT } from '@/utils/landing';
import { earlyManifestScript } from '@/utils/publication/early';
import { BOOT_VIEW_SCRIPT } from '@/utils/bootView';
import { publicationBoot } from './publicationBoot';
import { isLocalBuildRoute } from '@/utils/milburn/localBuild';
import { reportCopy } from '@/utils/milburn/reportStatus';
import { GA_INIT_SCRIPT, GA_MEASUREMENT_ID } from '@/utils/analytics';
import { chartChunkFiles, chartChunkScript } from '@/utils/chartChunk';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const TITLE = 'Milburn review: young people and work';
// The meta description, in the report-status switch's words
// (utils/milburn/reportStatus.js)
const DESCRIPTION: string = reportCopy().metaDescription;

// Inter, committed with the page (fonts/: the variable face, every weight,
// Latin subset; SIL Open Font License in fonts/OFL.txt): the
// build fetches nothing from Google, and the page asks no third party for a
// font. Preloaded, swapped in when it arrives, over an Arial fallback sized
// to Inter's metrics so the swap does not move the text.
const inter = localFont({
  src: './fonts/inter-latin-variable.woff2',
  weight: '100 900',
  style: 'normal',
  display: 'swap',
  variable: '--font-inter',
  adjustFontFallback: 'Arial',
});

// The chart views' chunk files, read once from the build's client chunks
// when the page is prerendered (after they are written); none if they are
// not there (utils/chartChunk.js)
let chartFiles: string[] | null = null;
function builtChartFiles(): string[] {
  if (chartFiles) return chartFiles;
  try {
    const dir = join(/* turbopackIgnore: true */ process.cwd(), '.next', 'static', 'chunks');
    const chunks: Record<string, string> = {};
    for (const name of readdirSync(dir)) {
      if (name.endsWith('.js')) chunks[name] = readFileSync(join(dir, name), 'utf8');
    }
    const files: string[] = chartChunkFiles(chunks);
    if (!files.length) console.warn('Chart chunk not found in the build: links to chart views will not preload it');
    chartFiles = files;
    return files;
  } catch {
    chartFiles = [];
    return [];
  }
}

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  // A local review build: kept out of search engines (next.config.ts sends
  // X-Robots-Tag too)
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1.0,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // With the publication verified by the build (publicationBoot.ts), the
  // head need not request its receipts and files before the page's code
  const booted = (await publicationBoot()) !== null;
  return (
    // The inline script marks a link to a view on <html> before hydration
    <html lang="en-GB" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Before the first paint: a link to a view (?tab=, ?sub=, ...)
            keeps the server's landing page hidden (utils/landing.js) */}
        <script dangerouslySetInnerHTML={{ __html: DEEP_LINK_SCRIPT }} />
        {/* ...and which view it opens, for that view's placeholder
            (utils/bootView.js) */}
        <script dangerouslySetInnerHTML={{ __html: BOOT_VIEW_SCRIPT }} />
        {/* The manifest request starts here, not after the page's code has
            loaded (utils/publication/early.js). Not on the local build
            route (utils/milburn/localBuild.js), which never reads the
            manifest or its artifacts */}
        {!isLocalBuildRoute() && (
          <script dangerouslySetInnerHTML={{ __html: earlyManifestScript(process.env.NEXT_PUBLIC_BASE_PATH || '', { artifacts: !booted }) }} />
        )}
        {/* A link to a chart view starts the chart code's download here,
            beside the page's own (utils/chartChunk.js) */}
        <script dangerouslySetInnerHTML={{ __html: chartChunkScript(process.env.NEXT_PUBLIC_BASE_PATH || '', builtChartFiles()) }} />
      </head>
      <body>
        {/* The site header with policyengine.org's own menu and side padding
            (utils/siteNav.js; siteHeader.css for the rest of its look) */}
        <PolicyEngineShell
          country="uk"
          showFooter={false}
          headerProps={{ navItems: SITE_NAV_ITEMS, styles: SITE_HEADER_STYLES }}>
          {children}
          <SiteFooter />
        </PolicyEngineShell>
        {/* Google Analytics, policyengine.org's property, in a production
            build only (utils/analytics.js) */}
        {process.env.NODE_ENV === 'production' && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} strategy="afterInteractive" />
            <Script id="google-analytics" strategy="afterInteractive">
              {GA_INIT_SCRIPT}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
