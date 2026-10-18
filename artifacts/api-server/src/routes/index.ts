import { Router, type IRouter } from "express";
import type { Request, Response } from "express";
import healthRouter from "./health";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.use(healthRouter);
router.use(async (req: Request, res: Response) => {
  const backendOrigin = process.env.ZT_BACKEND_ORIGIN ?? "http://127.0.0.1:8000";
  const target = new URL(req.originalUrl, backendOrigin);
  const headers = new Headers();
  const contentType = req.get("content-type");
  const accept = req.get("accept");
  const adminKey = req.get("x-admin-key");

  if (contentType) headers.set("content-type", contentType);
  if (accept) headers.set("accept", accept);
  if (adminKey) headers.set("x-admin-key", adminKey);

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const body = hasBody
    ? typeof req.body === "string"
      ? req.body
      : JSON.stringify(req.body ?? {})
    : undefined;

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body,
      signal: AbortSignal.timeout(130_000),
    });

    res.status(upstream.status);
    for (const header of ["content-type", "cache-control", "content-disposition"]) {
      const value = upstream.headers.get(header);
      if (value) res.setHeader(header, value);
    }
    res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error), path: req.path },
      "Python backend proxy failed",
    );
    res.status(502).json({ error: "Backend indisponible" });
  }
});

export default router;
