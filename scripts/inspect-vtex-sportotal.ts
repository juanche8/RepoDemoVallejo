import { createVtexReadClient } from "../lib/integrations/vtex/client.ts";
import { safeVtexError } from "../lib/integrations/vtex/errors.ts";
import { aggregateVtexInspection, containsPii } from "../lib/integrations/vtex/inspect.ts";
import type { VtexOrderDetail } from "../lib/integrations/vtex/types.ts";

const dateFrom = "2026-07-16";
const dateTo = "2026-07-22";

async function main() {
  let requests = 0;
  const trackedFetch: typeof fetch = async (input, init) => {
    requests += 1;
    return fetch(input, init);
  };
  const client = createVtexReadClient("Sportotal", process.env, trackedFetch);
  const firstPage = await client.listOrders(dateFrom, dateTo, 1, 100);
  const pages = Math.max(1, Number(firstPage.paging?.pages ?? 1));
  const summaries = [...(firstPage.list ?? [])];
  for (let page = 2; page <= pages; page += 1) {
    const response = await client.listOrders(dateFrom, dateTo, page, 100);
    summaries.push(...(response.list ?? []));
  }
  const details: VtexOrderDetail[] = [];
  for (const summary of summaries) {
    if (!summary.orderId) continue;
    details.push(await client.getOrder(summary.orderId));
  }
  const result = aggregateVtexInspection(details, { ecommerce: "sportotal", dateFrom, dateTo, requests });
  if (containsPii(result)) throw new Error("VTEX_BAD_RESPONSE: el agregado contiene PII.");
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify(safeVtexError(error))}\n`);
  process.exitCode = 1;
});
