import "./config/env.ts";
import Koa from "koa";
import cors from "@koa/cors";
import bodyParser from "koa-bodyparser";
import { initAgent } from "./agents/index.ts";
import apiRouter from "./router/api.ts";
import { logger } from "./utils/logger.ts";

const PORT = 3001;

const app = new Koa();

app.use(
  cors({
    origin: "http://localhost:5173",
  })
);

app.use(bodyParser());



app.use(apiRouter.routes());
app.use(apiRouter.allowedMethods());

const startServer = async () => {
  logger.info("BOOT", "Starting suvia server");
  logger.info("BOOT", `NODE_ENV=${app.env}`);
  logger.info("BOOT", `Port=${PORT}`);

  await initAgent();

  await new Promise<void>((resolve, reject) => {
    const server = app.listen(PORT, () => {
      logger.info("SERVER", `Koa API running at http://localhost:${PORT}`);
      logger.info("SERVER", `Chat endpoint: POST http://localhost:${PORT}/api/chat`);
      resolve();
    });

    server.once("error", reject);
  });
};

startServer().catch((error) => {
  logger.error("SERVER", "Failed to start server", error);
  process.exit(1);
});
