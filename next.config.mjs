/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Server-only secrets are read via process.env in src/lib/env.ts and are
  // never exposed to the client bundle. Only NEXT_PUBLIC_* values are public.
};

export default nextConfig;
