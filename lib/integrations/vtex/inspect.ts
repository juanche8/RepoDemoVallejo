import type { VtexInspectionResult, VtexOrderDetail, VtexPayment } from "./types.ts";

const expectedPaymentFields = [
  "paymentSystem", "paymentSystemName", "paymentGroup", "gateway", "connector",
  "cardBrand", "issuer", "bank", "installments", "installmentValue",
  "paymentValue", "transactionValue", "interestRate", "interestValue",
  "giftCard", "voucher", "paymentStatus",
] as const;

function finite(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function percent(part: number, total: number): number {
  return total ? Number(((part / total) * 100).toFixed(2)) : 0;
}

function add(set: Set<string>, value: unknown) {
  if (typeof value === "string" && value.trim()) set.add(value.trim());
}

function isCancelled(status: string): boolean {
  return status.toLocaleLowerCase("es-AR").includes("cancel");
}

function paymentFields(payment: VtexPayment, gatewayName?: string, transactionStatus?: string) {
  return {
    paymentSystem: payment.paymentSystem,
    paymentSystemName: payment.paymentSystemName,
    paymentGroup: payment.paymentGroup ?? payment.group,
    gateway: payment.gateway ?? gatewayName,
    connector: payment.connector,
    cardBrand: payment.cardBrand,
    issuer: payment.issuer,
    bank: payment.bank,
    installments: payment.installments,
    installmentValue: payment.installmentValue,
    paymentValue: payment.paymentValue ?? payment.value,
    transactionValue: payment.transactionValue,
    interestRate: payment.interestRate,
    interestValue: payment.interestValue,
    giftCard: payment.giftCard,
    voucher: payment.voucher,
    paymentStatus: payment.status ?? transactionStatus,
  };
}

export function aggregateVtexInspection(
  details: VtexOrderDetail[],
  input: { ecommerce: "sportotal"; dateFrom: string; dateTo: string; requests: number },
): VtexInspectionResult {
  const byStatus: Record<string, number> = {};
  const provinces = new Set<string>();
  const cities = new Set<string>();
  const paymentSystems = new Set<string>();
  const paymentGroups = new Set<string>();
  const gateways = new Set<string>();
  const cardBrands = new Set<string>();
  const statuses = new Set<string>();
  const installments = new Set<number>();
  const available = new Set<string>();
  let cancelled = 0;
  let gross = 0;
  let nonCancelledValue = 0;
  let units = 0;
  let withProvince = 0;
  let withCity = 0;
  let withPostalCode = 0;
  let withPayment = 0;

  for (const order of details) {
    const status = order.status?.trim() || order.statusDescription?.trim() || "Sin estado";
    byStatus[status] = (byStatus[status] ?? 0) + 1;
    const cancelledOrder = isCancelled(status);
    if (cancelledOrder) cancelled += 1;
    const value = finite(order.value ?? order.totalValue) / 100;
    gross += value;
    if (!cancelledOrder) nonCancelledValue += value;
    units += (order.items ?? []).reduce((sum, item) => sum + finite(item.quantity), 0);

    const address = order.shippingData?.selectedAddresses?.[0];
    if (address?.state?.trim()) { withProvince += 1; add(provinces, address.state); }
    if (address?.city?.trim()) { withCity += 1; add(cities, address.city); }
    if (address?.postalCode?.trim()) withPostalCode += 1;

    const transactions = order.paymentData?.transactions ?? [];
    const payments = transactions.flatMap((transaction) =>
      (transaction.payments ?? []).map((payment) => paymentFields(payment, transaction.gatewayName, transaction.status))
    );
    if (payments.length) withPayment += 1;
    for (const payment of payments) {
      for (const [field, valueFound] of Object.entries(payment)) {
        if (valueFound !== undefined && valueFound !== null && valueFound !== "") available.add(field);
      }
      add(paymentSystems, payment.paymentSystemName ?? payment.paymentSystem);
      add(paymentGroups, payment.paymentGroup);
      add(gateways, payment.gateway ?? payment.connector);
      add(cardBrands, payment.cardBrand);
      add(statuses, payment.paymentStatus);
      if (typeof payment.installments === "number" && Number.isFinite(payment.installments)) installments.add(payment.installments);
    }
  }

  const total = details.length;
  const nonCancelled = total - cancelled;
  return {
    ...input,
    orders: { found: total, cancelled, nonCancelled, byStatus },
    value: {
      gross: Number(gross.toFixed(2)),
      nonCancelled: Number(nonCancelledValue.toFixed(2)),
      preliminaryAverageTicket: nonCancelled ? Number((nonCancelledValue / nonCancelled).toFixed(2)) : null,
    },
    units: { preliminaryTotal: units },
    geography: {
      provinceCoveragePercent: percent(withProvince, total),
      cityCoveragePercent: percent(withCity, total),
      postalCodeCoveragePercent: percent(withPostalCode, total),
      provinceExamples: [...provinces].sort().slice(0, 10),
      cityExamples: [...cities].sort().slice(0, 10),
    },
    payments: {
      coveragePercent: percent(withPayment, total),
      paymentSystems: [...paymentSystems].sort(),
      paymentGroups: [...paymentGroups].sort(),
      installments: [...installments].sort((a, b) => a - b),
      gatewaysOrConnectors: [...gateways].sort(),
      cardBrands: [...cardBrands].sort(),
      statuses: [...statuses].sort(),
      availableFields: [...available].sort(),
      unavailableFields: expectedPaymentFields.filter((field) => !available.has(field)),
    },
  };
}

export function containsPii(result: VtexInspectionResult): boolean {
  const serialized = JSON.stringify(result).toLocaleLowerCase("es-AR");
  return ["clientprofiledata", "email", "phone", "document", "street", "receivername"].some((key) => serialized.includes(key));
}
