module.exports = {
  globDirectory: 'dist',
  globPatterns: ['**/*.{html,js,css,json,png,ico,svg,woff,woff2}'],
  globIgnores: ['sw.js', 'workbox-*.js'],
  swDest: 'dist/sw.js',
  navigateFallback: '/index.html',
  cleanupOutdatedCaches: true,
  clientsClaim: false,
  skipWaiting: false,
  sourcemap: false,
  maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
};
