import type { NextConfig } from "next";
import type { Configuration as WebpackConfig } from 'webpack';
import path from 'path';

// Conditionally import bundle analyzer only when needed
const withBundleAnalyzer = process.env.ANALYZE === 'true'
  ? require('@next/bundle-analyzer')({ enabled: true })
  : (config: NextConfig) => config;

const nextConfig: NextConfig = {
  //output: "export",
  optimizeFonts: false,
  eslint: {
    // Skip ESLint in production builds (devDependencies not available)
    ignoreDuringBuilds: process.env.NODE_ENV === 'production'
  },
  devIndicators: {
    appIsrStatus: false,
    buildActivityPosition: 'bottom-right',
  },
  images: {
    unoptimized: true
  },
  async headers() {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const productionUrl = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL;
    
    // Build production WebSocket URLs
    let productionConnectSrc = '';
    if (productionUrl && !isDevelopment) {
      try {
        const url = new URL(productionUrl);
        const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${url.host}`;
        productionConnectSrc = ` ${wsUrl} ${productionUrl}`;
      } catch (_e) {
        // Note: Using console.warn here instead of logger because:
        // 1. This runs in Next.js build/config context, not runtime
        // 2. Logger may not be available during build configuration
        // 3. Build-time warnings should be visible in build output
        console.warn('Invalid NEXT_PUBLIC_SOCKET_SERVER_URL for CSP:', productionUrl);
      }
    }
    
    // Build CSP header
    // Note: 'unsafe-eval' is required for Babel standalone (custom components)
    // This is mitigated by:
    // - Components are only loaded from trusted storage
    // - Babel runs in isolated scope with blocked APIs (fetch, localStorage, etc.)
    // - Components cannot access dangerous globals
    const cspDirectives = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com`,
      `script-src-elem 'self' 'unsafe-inline' https://cdnjs.cloudflare.com`,
      "style-src 'self' 'unsafe-inline' https://gail.wharton.upenn.edu",
      "style-src-attr 'unsafe-inline'",
      "font-src 'self' data: https://gail.wharton.upenn.edu",
      "img-src 'self' data: blob:",
      `connect-src 'self' https://api.openai.com${productionConnectSrc}${isDevelopment ? " ws://localhost:* wss://localhost:* http://localhost:*" : ""}`,
      "media-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "frame-src 'none'",
      "worker-src 'self' blob: data:",
      "manifest-src 'self'"
    ].join('; ');

    return [
      {
        // Apply security headers to all routes
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspDirectives
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          }
        ],
      },
    ];
  },
  webpack: (config: WebpackConfig) => {
    // Handle module resolution for problematic dependencies
    config.resolve = {
      ...config.resolve,
      extensionAlias: {
        '.js': ['.ts', '.tsx', '.js', '.jsx']
      },
      alias: {
        ...config.resolve?.alias,
        '~/methods': path.resolve(__dirname, 'node_modules/khroma/dist/methods'),
      }
    };

    // Handle TypeScript files in node_modules for specific packages
    const rules = config.module?.rules || [];
    rules.push({
      test: /\.ts$/,
      include: [
        /node_modules\/@braintree\/sanitize-url/,
        /node_modules\/chevrotain-allstar/,
        /node_modules\/khroma/,
        /node_modules\/langium/,
        /node_modules\/path-data-parser/,
      ],
      use: [
        {
          loader: 'babel-loader',
          options: {
            presets: ['next/babel'],
            plugins: ['@babel/plugin-transform-typescript']
          }
        }
      ]
    });

    return config;
  }
};

export default withBundleAnalyzer(nextConfig);
