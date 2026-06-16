/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import mongoose from 'mongoose';
import { app } from '../server';

const MONGODB_URI = process.env.MONGODB_URI;

let isConnected = false;

async function connectDB() {
  // Reuse existing connection if healthy
  if (isConnected && mongoose.connection.readyState === 1) return;

  if (!MONGODB_URI) {
    throw new Error(
      'MONGODB_URI environment variable is not set. Please add it in Vercel → Project Settings → Environment Variables.'
    );
  }

  // Disable command buffering so operations fail fast instead of queueing forever
  mongoose.set('bufferCommands', false);

  await mongoose.connect(MONGODB_URI, {
    // Must be shorter than Vercel's 10s function timeout
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    // Keep the connection pool small for serverless to avoid exhausting Atlas limits
    maxPoolSize: 1,
  });

  isConnected = true;
  console.log('[Serverless] MongoDB connected successfully.');
}

export default async (req: any, res: any) => {
  try {
    await connectDB();
    // Forward request to our main Express application
    app(req, res);
  } catch (error: any) {
    console.error('[Serverless] Fatal error:', error);
    res.status(500).json({
      error: 'Serverless Database Connection Error',
      message: error.message,
    });
  }
};
