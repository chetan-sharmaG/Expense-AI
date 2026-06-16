/**
 * Diagnostic endpoint - tests basic Vercel function execution with zero dependencies.
 * If this works, the issue is in server.ts imports.
 * If this also fails, the issue is with Vercel configuration.
 */
export default (req: any, res: any) => {
  res.json({
    ok: true,
    timestamp: new Date().toISOString(),
    env: {
      hasMongoUri: !!process.env.MONGODB_URI,
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
      hasJwtSecret: !!process.env.JWT_SECRET,
      nodeVersion: process.version,
    },
  });
};
