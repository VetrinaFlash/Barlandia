import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

// In dev, espone i binding Cloudflare (D1 ecc.) a `next dev` tramite il
// proxy della piattaforma. Lo stato è condiviso col worker realtime
// tramite la stessa directory di persistenza (vedi README).
initOpenNextCloudflareForDev({
  persist: { path: '../../.wrangler/state/v3' },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@barlandia/shared'],
};

export default nextConfig;
