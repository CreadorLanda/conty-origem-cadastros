import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { OriginTracker } from "./tracker.ts";

const tracker = new OriginTracker();
const port = Number(process.env.PORT ?? 3006);

serve({ fetch: createApp(tracker).fetch, port }, (info) => {
  console.log(`origem do cadastro em http://127.0.0.1:${info.port}`);
});
