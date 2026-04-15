import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import router from "./routes";
import adminRouter from "./routes/admin";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);
app.use("/api/admin", adminRouter);

app.get("/privacy-policy", (_req, res) => {
  const filePath = path.join(process.cwd(), "privacy-policy.html");
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error("Privacy policy file not found:", filePath);
      res.status(404).send("Privacy policy not available");
    }
  });
});

export default app;
