import { NextResponse, type NextRequest } from "next/server";
import { applyAttributionCookies } from "@/lib/attribution";

// First-party attribution cookies (visitor id, first-visit source), same contract as royabes.com.
export function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  applyAttributionCookies(request, response, "cca.royabes.com");
  return response;
}

export const config = {
  matcher: ["/((?!api/|_next/|.*\\..*).*)"],
};
