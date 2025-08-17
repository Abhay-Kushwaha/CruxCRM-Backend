import app from "../src/app.js";

// Vercel expects a handler, not an express listen
export default function handler(req, res) {
    return app(req, res);
}
