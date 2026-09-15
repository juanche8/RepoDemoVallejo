export type Store = "Sportotal" | "Vallejo Calzados" | "Freekick";
export type MacroCategory = "Calzado" | "Indumentaria" | "Accesorios";
export type Device = "Desktop" | "Mobile" | "Tablet";
export type CommercialChannel = "Ecommerce" | "Marketplace" | "Tienda física asistida";
export type AcquisitionChannel = "Paid Social" | "Paid Search" | "Organic Search" | "Direct" | "Email" | "Referral";
export type ComparisonMode = "previous_day" | "previous_period" | "previous_week" | "none";
export type DatePreset = "today" | "yesterday" | "last7" | "last30" | "month" | "custom";
export type DateRange = { from: string; to: string };

export type Product = {
  productId: string;
  name: string;
  model: string;
  brand: string;
  macroCategory: MacroCategory;
  category: string;
  subcategory: string;
  store: Store;
};

export type SKU = {
  skuId: string;
  productId: string;
  color: string;
  size: string;
  currentPrice: number;
  listPrice: number;
  cost?: number;
  stock: number;
};

export type DailyMetric = {
  date: string;
  ecommerce: Store;
  productId?: string;
  commercialChannel: CommercialChannel;
  acquisitionChannel: AcquisitionChannel;
  province: string;
  device: Device;
  source?: string;
  medium?: string;
  campaign?: string;
  sessions: number;
  productViews: number;
  addToCarts: number;
  beginCheckouts: number;
  purchases: number;
  revenue: number;
  units: number;
};

export type MetricTotals = {
  sessions: number;
  productViews: number;
  addToCarts: number;
  beginCheckouts: number;
  purchases: number;
  revenue: number;
  units: number;
  stock: number;
};

export type StockBySize = { size: string; stock: number };

export type ProductPerformance = Product & MetricTotals & {
  previous: MetricTotals;
  skus: SKU[];
  currentPrice: number;
  listPrice: number;
  discount: number;
  totalStock: number;
  stockBySize: StockBySize[];
  coverDays: number | null;
  lastSaleDate: string;
};

export type Filters = {
  store: string;
  macroCategory: string;
  category: string;
  brand: string;
  product: string;
  commercialChannel: string;
  acquisitionChannel: string;
  province: string;
  device: string;
};

export type InventorySnapshot = {
  date: string;
  ecommerce: Store;
  skuId: string;
  availableStock: number;
  reservedStock: number;
  totalStock: number;
};
