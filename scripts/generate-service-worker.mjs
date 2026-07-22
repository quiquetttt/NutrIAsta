import { generateSW } from 'workbox-build';

import config from '../workbox-config.cjs';

const result = await generateSW(config);
process.stdout.write(
  `Service worker generado: ${result.count} archivos, ${result.size} bytes precacheados.\n`,
);
