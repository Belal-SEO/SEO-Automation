/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdf-parse (built on pdfjs-dist, with dynamic requires) breaks when
  // webpack-bundled for the serverless function -- run it as a plain
  // Node require() at runtime instead.
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
};

export default nextConfig;
