/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import mongoose from 'mongoose';
import { app } from '../server';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/familyfunds';

let isConnected = false;

async function connectDB() {
  if (isConnected) return;
  
  // Check if there is already an active mongoose connection
  if (mongoose.connection.readyState >= 1) {
    isConnected = true;
    return;
  }
  
  await mongoose.connect(MONGODB_URI);
  isConnected = true;
  console.log('Serverless Mongoose Connected.');
}

export default async (req: any, res: any) => {
  try {
    await connectDB();
    // Forward the request and response to our main Express application instance
    app(req, res);
  } catch (error: any) {
    console.error('Serverless connection error:', error);
    res.status(500).json({ error: 'Serverless Database Connection Error', message: error.message });
  }
};
