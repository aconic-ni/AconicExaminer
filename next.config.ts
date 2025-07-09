import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  
  // Explicitly set basePath and assetPrefix for GitHub Pages deployment.
  // This ensures that all asset paths are correct for the subdirectory hosting.
  basePath: '/AconicExaminer',
  assetPrefix: '/AconicExaminer/',

  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;

