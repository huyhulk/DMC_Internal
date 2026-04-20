/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'hzuyucyxyohppxfwresq.supabase.co',
      },
    ],
  },
}

export default nextConfig
