import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // For GitHub Pages, if deploying to a subpath like username.github.io/repo-name:
  // basePath: '/repo-name',
  // assetPrefix: '/repo-name/',
  // output: 'export', // Add this for static site generation for GitHub Pages, ensure all routes are compatible.
  // For now, keeping it without 'export' to ensure Firebase client-side logic works smoothly.
  // If a completely static build is required, ensure all Firebase interactions are strictly client-side.
};

export default nextConfig;
