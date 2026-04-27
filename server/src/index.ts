import Koa from "koa";
import cors from "@koa/cors";
import bodyParser from "koa-bodyparser";
import apiRouter from "./router/api.ts";


const app = new Koa();

app.use(
  cors({
    origin: "http://localhost:5173",
  })
);

app.use(bodyParser());



app.use(apiRouter.routes());
app.use(apiRouter.allowedMethods());

app.listen(3001, () => {
  console.log("Koa API running at http://localhost:3001");
});