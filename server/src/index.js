import dotenv from "dotenv";
import server from "./server.js";
import connectDB from "./db/index.js";

dotenv.config({ path: "./.env" });

const serverPort = process.env.PORT || 8080;

if (process.env.VERCEL) {
  // Running on Vercel → don't listen
  console.log("Running on Vercel serverless environment");
} else {
  // Local development → normal listen
  connectDB()
    .then(() => {
      server.listen(serverPort, () => {
        console.log({
          serverStatus: "🌐 Application is Running",
          URL: `🔗 http://localhost:${serverPort}`,
        });
      });
    })
    .catch((error) => {
      console.log("DB connection Failed from Index.js", error);
    });
}
