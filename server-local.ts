/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import { connectDatabase, seedDatabase, startServer } from './server';

connectDatabase()
  .then(async () => {
    await seedDatabase();
    await startServer();
  })
  .catch(err => {
    console.error('Failed to connect to MongoDB locally:', err);
    process.exit(1);
  });
