import { APP_BUILD_ID, APP_VERSION, UPDATE_NOTES } from "@/lib/version";
export const dynamic = "force-dynamic";
export function GET() {
  return Response.json({ buildId: APP_BUILD_ID, version: APP_VERSION, notes: UPDATE_NOTES }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
