/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        dns: false,
        child_process: false,
        module: false,
        worker_threads: false,
      };
    }
    
    // Handle external packages that need Node.js environment
    config.externals = [
      ...(config.externals || []), 
      function({ request }, callback) {
        // Skip processing of socket-server completely
        if (request.includes('socket-server')) {
          return callback(null, 'commonjs ' + request);
        }
        // Handle Google GenAI and its dependencies for server-side only
        if (isServer && (
          request === '@google/genai' ||
          request.startsWith('@google/genai/') ||
          (request === 'ws' && isServer) ||
          request === 'google-auth-library' ||
          request === 'zod' ||
          request === 'zod-to-json-schema'
        )) {
          return callback(null, 'commonjs ' + request);
        }
        callback();
      }
    ];
    
    // Add a rule to handle .js imports in TypeScript files
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.js', '.ts', '.tsx'],
    };
    
    return config;
  },
  // Transpile socket.io-client for browser compatibility
  transpilePackages: ['socket.io-client', 'engine.io-client', 'socket.io-parser'],
};

export default nextConfig; 