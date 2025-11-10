const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Rewrites configuration to proxy API requests to the backend server
  // This is used only in development to avoid CORS issues
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: 'http://localhost:8080/api/v1/:path*', // Proxy to Backend
      },
    ]
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
        ],
      },
    ];
  },

  webpack: (config, { isServer }) => {
    // Add Monaco Editor Webpack Plugin
    if (!isServer) {
      config.plugins.push(
        new MonacoWebpackPlugin({
          languages: ['javascript', 'typescript', 'json', 'css', 'html', 'markdown'],
          filename: 'static/[name].worker.js',
        })
      );
    }
    return config;
  },
};

module.exports = nextConfig;