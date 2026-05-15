/**
 * Vercel Serverless Function Entry Point
 *
 * Vercel detects this file (api/express.js) as a serverless function via the
 * vercel.json "rewrites" rule and invokes it for every request that matches /api/(.*).
 * The Express app is exported as the default handler, so Vercel will call it
 * with (req, res) for each invocation and manage the HTTP lifecycle externally.
 *
 * Importing the Server class from src/server.js is safe because:
 *  - server.js only calls app.listen() when require.main === module (local dev only),
 *    not when it is imported as a module like here.
 *  - In Vercel the VERCEL env var is set; server.js's start() checks that flag and
 *    skips the listen() call accordingly.
 */

const Server = require('../src/server');

// Instantiate (config & middleware wiring happens in the constructor)
const server = new Server();

// Export the Express app for Vercel's HTTP handler
module.exports = server.getApp();
