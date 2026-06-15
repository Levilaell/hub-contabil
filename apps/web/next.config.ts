import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    // Spreadsheet onboarding (T8) uploads a file through a Server Action; the
    // default 1 MB cap is tight for a 250–500 company .xlsx.
    serverActions: { bodySizeLimit: '8mb' },
  },
};

export default nextConfig;
