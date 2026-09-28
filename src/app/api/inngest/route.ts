import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { trackBreakoutCandidate } from "@/inngest/functions";

// Expose the Inngest API
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    trackBreakoutCandidate
  ],
});
