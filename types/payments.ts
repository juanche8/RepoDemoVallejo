import type { Store } from "./analytics";

export type VtexPaymentTransaction = {
  orderId: string;
  creationDate: string;
  paymentSystem?: string;
  paymentSystemName?: string;
  paymentGroup?: string;
  paymentMethod?: string;
  paymentProvider?: string;
  gateway?: string;
  connector?: string;
  acquirer?: string;
  cardBrand?: string;
  issuer?: string;
  bank?: string;
  installments?: number;
  installmentValue?: number;
  paymentValue?: number;
  transactionValue?: number;
  interestRate?: number;
  interestValue?: number;
  giftCard?: boolean;
  voucher?: boolean;
  paymentStatus?: string;
};

export type PaymentDataSource = {
  ecommerce: Extract<Store, "Sportotal" | "Vallejo Calzados">;
  source: "VTEX";
  status: "pending";
};

export function getPaymentDataSource(ecommerce: string): PaymentDataSource {
  if (ecommerce === "Sportotal" || ecommerce === "Vallejo Calzados") {
    return { ecommerce, source: "VTEX", status: "pending" };
  }
  throw new Error("Medios de pago: ecommerce no soportado y sin fallback.");
}

export function getPaymentMethodsViewModel(ecommerce: string) {
  const connection = getPaymentDataSource(ecommerce);
  return {
    connection,
    hasData: false as const,
    sourceLabel: "VTEX · Pendiente de conexión",
    message: "Conectaremos las transacciones reales para analizar medios de pago, cuotas, tarjetas y gateways.",
  };
}
