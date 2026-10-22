import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  output: 'standalone',
  // permite vários `next dev` em paralelo (NEXT_DIST_DIR=.next-a)
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  outputFileTracingRoot: path.join(__dirname, '../../'),
};

export default nextConfig;
