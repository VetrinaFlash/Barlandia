// In dev, setupDevPlatform espone i binding Cloudflare (D1 ecc.) a `next dev`
// tramite getPlatformProxy/miniflare. Lo stato è condiviso col worker
// realtime tramite la stessa directory di persistenza (vedi README).
if (process.env.NODE_ENV === 'development') {
  const { setupDevPlatform } = await import('@cloudflare/next-on-pages/next-dev');
  await setupDevPlatform({
    persist: { path: '../../.wrangler/state/v3' },
  });
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@barlandia/shared'],
};

export default nextConfig;
