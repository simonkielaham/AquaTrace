
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  webpack: (config) => {
    config.watchOptions.ignored = [
      ...(config.watchOptions.ignored as string[] | RegExp[]),
      '**/data/**',
      '**/staged/**',
    ];
    return config;
  },
};

export default nextConfig;

    