import { apiError, checkRequest, workspace } from "@/lib/api";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    checkRequest(request);
    return Response.json(await workspace(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return apiError(e);
  }
}
