import type {NextConfig} from 'next';
import type webpack from 'webpack'; // Changed to 'import type' to resolve TypeScript error

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
  webpack: (config, { isServer }): webpack.Configuration => {
    // 1. Ensure watchOptions exists
    if (!config.watchOptions) {
      config.watchOptions = {};
    }

    // 2. Safely access and spread the existing ignored array, defaulting to an empty array
    // The use of '|| []' ensures we always spread an iterable array, preventing the TypeError.
    const existingIgnored = (config.watchOptions.ignored || []) as (string | RegExp)[];

    config.watchOptions.ignored = [
      ...existingIgnored,
      '**/data/**',
      '**/staged/**',
    ];

    // Note: The build log also references Object.webpack, so let's ensure the function signature
    // includes the standard Next.js arguments, even if you don't use them (config, options)
    // config is of type webpack.Configuration (from 'webpack' import)
    return config;
  },
};

export default nextConfig;