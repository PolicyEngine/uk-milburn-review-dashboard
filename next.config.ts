import type { NextConfig } from 'next';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkHouseholdApiEnv } from './scripts/household-api-env.mjs';

/**
 * The version uv.lock pins for a Python package, or '' if it is not there.
 * The page's replication line shows these, read at build time from the
 * lockfile this build was made from.
 */
function lockedVersion(name: string): string {
  try {
    const lock = readFileSync(join(process.cwd(), 'uv.lock'), 'utf8');
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = lock.match(
      new RegExp(`\\[\\[package\\]\\]\\nname = "${escaped}"\\nversion = "([^"]+)"`),
    );
    return match ? match[1] : '';
  } catch {
    return '';
  }
}

/**
 * The files of results by area this build ships, comma-separated. The page
 * requests only these, so a table not yet published shows as such without a
 * 404 in the console.
 */
function publishedGeography(): string {
  return ['regional.csv', 'constituency.csv']
    .filter((file) => existsSync(join(process.cwd(), 'public', 'data', file)))
    .join(',');
}

/**
 * Where the page's figures come from. "local-build" (the Milburn review's
 * flat results on a build no receipt covers, utils/milburn/localBuild.js)
 * when public/data/milburn_measures.json exists, else "verified" (the
 * receipted publication route); NEXT_PUBLIC_DATA_ROUTE overrides either.
 */
function dataRoute(): string {
  const given = process.env.NEXT_PUBLIC_DATA_ROUTE;
  if (given) return given;
  return existsSync(join(process.cwd(), 'public', 'data', 'milburn_measures.json')) ? 'local-build' : 'verified';
}

// A static export for a Claude artifact (ARTIFACT_EXPORT=1): no base path,
// no server redirects or headers, written to its own folder so the dev
// server's .next is untouched.
const artifactExport = process.env.ARTIFACT_EXPORT === '1';

// The zone's path on policyengine.org, fixed: the page, its canonical and
// its Open Graph image (src/app/layout.tsx) are all under it. The artifact
// export alone has none.
const basePath = artifactExport ? '' : '/uk/milburn-review';

// The Household impact tab's API URL is baked in at build time: fail every
// build that has it in the wrong form; without it, warn and show the stored
// examples only (scripts/household-api-env.mjs).
checkHouseholdApiEnv(process.env);

const nextConfig: NextConfig = {
  ...(basePath ? { basePath } : {}),
  ...(artifactExport ? { output: 'export' as const, distDir: 'artifact-export', images: { unoptimized: true } } : {}),
  env: {
    // The artifact's files sit next to its page: fetch data relative to it
    NEXT_PUBLIC_BASE_PATH: artifactExport ? '.' : basePath,
    NEXT_PUBLIC_POLICYENGINE_VERSION: lockedVersion('policyengine'),
    NEXT_PUBLIC_PUBLISHED_GEOGRAPHY: publishedGeography(),
    NEXT_PUBLIC_DATA_ROUTE: dataRoute(),
  },
  // recharts and d3 ship CJS interop and rely on browser globals; transpiling
  // them through Next's pipeline avoids ESM/CJS mismatch errors during build.
  transpilePackages: ['recharts', 'd3'],
  // The bare origin (http://localhost:3100) has no page under a base path;
  // send it to the dashboard rather than a 404.
  async redirects() {
    if (artifactExport) return [];
    return basePath
      ? [{ source: '/', destination: basePath, basePath: false, permanent: false }]
      : [];
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
