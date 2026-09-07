import type { NextRequest } from "next/server";

import { GET_xlsx } from "@/lib/crm-export-routes";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return GET_xlsx(request);
}
