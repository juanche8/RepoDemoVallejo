export type VtexEcommerce = "sportotal";

export type VtexEnvironment = Record<string, string | undefined>;

export type VtexCredentials = {
  ecommerce: VtexEcommerce;
  account: string;
  appKey: string;
  appToken: string;
};

export type VtexOrderSummary = {
  orderId?: string;
  creationDate?: string;
  status?: string;
  statusDescription?: string;
  value?: number;
  totalValue?: number;
};

export type VtexOrdersResponse = {
  list?: VtexOrderSummary[];
  paging?: { total?: number; pages?: number; currentPage?: number; perPage?: number };
};

export type VtexOrderItem = {
  quantity?: number;
  price?: number;
  sellingPrice?: number;
};

export type VtexAddress = {
  city?: string;
  state?: string;
  postalCode?: string;
  addressType?: string;
};

export type VtexPayment = {
  paymentSystem?: string;
  paymentSystemName?: string;
  group?: string;
  paymentGroup?: string;
  gateway?: string;
  connector?: string;
  cardBrand?: string;
  issuer?: string;
  bank?: string;
  installments?: number;
  installmentValue?: number;
  value?: number;
  paymentValue?: number;
  transactionValue?: number;
  interestRate?: number;
  interestValue?: number;
  giftCard?: boolean;
  voucher?: boolean;
  status?: string;
};

export type VtexTransaction = {
  status?: string;
  gatewayName?: string;
  connectorResponses?: Record<string, unknown>;
  payments?: VtexPayment[];
};

export type VtexOrderDetail = VtexOrderSummary & {
  items?: VtexOrderItem[];
  totals?: Array<{ id?: string; value?: number }>;
  shippingData?: {
    selectedAddresses?: VtexAddress[];
    logisticsInfo?: Array<{ deliveryChannel?: string }>;
  };
  paymentData?: { transactions?: VtexTransaction[] };
};

export type VtexInspectionResult = {
  ecommerce: VtexEcommerce;
  dateFrom: string;
  dateTo: string;
  requests: number;
  orders: {
    found: number;
    cancelled: number;
    nonCancelled: number;
    byStatus: Record<string, number>;
  };
  value: {
    gross: number;
    nonCancelled: number;
    preliminaryAverageTicket: number | null;
  };
  units: { preliminaryTotal: number };
  geography: {
    provinceCoveragePercent: number;
    cityCoveragePercent: number;
    postalCodeCoveragePercent: number;
    provinceExamples: string[];
    cityExamples: string[];
  };
  payments: {
    coveragePercent: number;
    paymentSystems: string[];
    paymentGroups: string[];
    installments: number[];
    gatewaysOrConnectors: string[];
    cardBrands: string[];
    statuses: string[];
    availableFields: string[];
    unavailableFields: string[];
  };
};
