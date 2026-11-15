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

const basePath = process.env.NEXT_PUBLIC_BASE_PATH !== undefined
  ? process.env.NEXT_PUBLIC_BASE_PATH
  : '/uk/milburn-review';


// The Household impact tab's API URL is baked in at build time: fail a
// production build that lacks it, and every build that has it in the wrong
// form (scripts/household-api-env.mjs).
checkHouseholdApiEnv(process.env);

const nextConfig: NextConfig = {
  ...(basePath ? { basePath } : {}),
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_POLICYENGINE_VERSION: lockedVersion('policyengine'),
    NEXT_PUBLIC_PUBLISHED_GEOGRAPHY: publishedGeography(),
    NEXT_PUBLIC_DATA_ROUTE: dataRoute(),
  },
  // recharts and d3 ship CJS interop and rely on browser globals; transpiling
  // them through Next's pipeline avoids ESM/CJS mismatch errors during build.
  transpilePackages: ['recharts', 'd3'],
  // An artifact directory is named by its digest and never changes once
  // written, so the browser may keep its files; the page still checks every
  // byte against the manifest, which is always fetched fresh
  async headers() {
    return [
      // A local review build: not for search engines (the page's robots
      // meta says the same)
      {
        source: '/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      {
        source: '/data/artifacts/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
