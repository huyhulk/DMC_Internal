/** @type {import('next').NextConfig} */
const nextConfig = {
  // Compress responses (gzip) — important for Vercel Hobby cold start transfer time
  compress: true,
  poweredByHeader: false,
  turbopack: {
    root: import.meta.dirname,
  },

  // Tree-shake large packages at build time → smaller chunks → faster cold start
  experimental: {
    optimizePackageImports: [
      '@tremor/react',
      'lucide-react',
      'recharts',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-popover',
      '@radix-ui/react-tabs',
      '@radix-ui/react-scroll-area',
      'date-fns',
    ],
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'hzuyucyxyohppxfwresq.supabase.co',
      },
    ],
    // Cache remote images longer in CDN
    minimumCacheTTL: 3600,
  },
}

export default nextConfig
