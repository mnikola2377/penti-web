import type { Config } from "@netlify/functions";
import { handleInquiryRequest } from "../../src/lib/handle-inquiry";

export default async (req: Request) => {
  const result = await handleInquiryRequest(req, {
    supabaseUrl: readEnv("SUPABASE_URL"),
    serviceRoleKey: readEnv("SUPABASE_SERVICE_ROLE_KEY"),
  });
  return Response.json(result.body, { status: result.status });
};

export const config: Config = {
  path: "/api/poptavka",
  method: "POST",
};

function readEnv(name: string): string | undefined {
  if (typeof Netlify !== "undefined" && Netlify.env) {
    const value = Netlify.env.get(name);
    if (value) return value;
  }
  return process.env[name];
}
