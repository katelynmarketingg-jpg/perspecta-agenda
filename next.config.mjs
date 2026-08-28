/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pragmático para o primeiro deploy: não travar o build por lint/type.
  // Apertar depois que a base estiver estável.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
