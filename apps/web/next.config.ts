import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Dev-only: allow the dev-tooling origins besides `localhost`. Under WSL2 the app
  // is often opened via 127.0.0.1 or the WSL network IP; Next 16 otherwise blocks
  // those cross-origin dev requests (HMR websocket), which breaks client hydration
  // so the login form submits natively (GET /login?) without ever running sign-in.
  allowedDevOrigins: ['127.0.0.1', '10.255.255.254'],
  experimental: {
    // Spreadsheet onboarding (T8) uploads a file through a Server Action; the
    // default 1 MB cap is tight for a 250–500 company .xlsx.
    serverActions: { bodySizeLimit: '8mb' },
  },
};

export default nextConfig;
