/** @type {import('next').NextConfig} */
const nextConfig = {
  // No cacheComponents: every API request must re-read runs/ so the dashboard is live.
  agentRules: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
