import type { Store } from "@/types/analytics";

export type GA4QueryInput = {
  propertyId: string;
  dateFrom: string;
  dateTo: string;
  ecommerce: Store;
};

export type GA4DimensionValues = {
  date: string;
  sessionDefaultChannelGroup: string;
  sessionSource: string;
  sessionMedium: string;
  sessionCampaignName: string;
  deviceCategory: string;
};

export type GA4MetricValues = {
  activeUsers: number;
  newUsers: number;
  sessions: number;
  engagedSessions: number;
  engagementRate: number;
  ecommercePurchases: number;
  purchaseRevenue: number;
};

export type GA4ApiValue = { value?: string | null };

export type GA4ApiRow = {
  dimensionValues?: GA4ApiValue[];
  metricValues?: GA4ApiValue[];
};

export type GA4ApiResponse = {
  dimensionHeaders?: Array<{ name?: string }>;
  metricHeaders?: Array<{ name?: string; type?: string }>;
  rows?: GA4ApiRow[];
  rowCount?: number;
};

export type GA4ReportDefinition = {
  dimensions: readonly string[];
  metrics: readonly string[];
  dimensionFilter?: {
    filter: {
      fieldName: string;
      inListFilter: { values: readonly string[] };
    };
  };
};

export type GA4FunnelEvents = {
  viewItem: number;
  addToCart: number;
  beginCheckout: number;
  purchaseEventCount: number;
  viewItemUsers: number;
  addToCartUsers: number;
  beginCheckoutUsers: number;
  purchaseUsers: number;
};

export type GA4DashboardTotals = {
  sessions: number;
  activeUsers: number;
  newUsers: number;
  purchases: number;
  revenue: number;
};

export type GA4DashboardBreakdown = GA4DashboardTotals & {
  name: string;
};

export type GA4DashboardData = {
  propertyId: string;
  dateFrom: string;
  dateTo: string;
  updatedAt: string;
  hasData: boolean;
  totals: GA4DashboardTotals;
  funnelEvents: GA4FunnelEvents;
  funnelEventsAvailable: boolean;
  channelGroups: GA4DashboardBreakdown[];
  devices: GA4DashboardBreakdown[];
  comparison?: GA4DashboardData | null;
  comparisonError?: string | null;
};

export type GA4CategoryMetricRow = {
  name: string;
  itemsViewed: number;
  itemsAddedToCart: number;
  itemsCheckedOut: number;
  itemsPurchased: number;
  itemRevenue: number;
};

export type GA4CategoriesData = {
  propertyId: string;
  dateFrom: string;
  dateTo: string;
  updatedAt: string;
  hasData: boolean;
  detailAvailable: boolean;
  macros: GA4CategoryMetricRow[];
  details: GA4CategoryMetricRow[];
  audiences: GA4CategoryMetricRow[];
  uncategorizedPercentage: number;
  comparison?: GA4CategoriesData | null;
  comparisonError?: string | null;
};

export type GA4ProductMetricRow = GA4CategoryMetricRow & {
  itemId: string;
  itemName: string;
  itemBrand: string;
  macroCategory: string;
  category: string;
};

export type GA4BrandProductData = {
  propertyId: string;
  dateFrom: string;
  dateTo: string;
  updatedAt: string;
  hasData: boolean;
  productDetailAvailable: boolean;
  brands: GA4CategoryMetricRow[];
  products: GA4ProductMetricRow[];
  coverage: {
    itemBrand: number;
    itemId: number;
    itemName: number;
  };
  comparison?: GA4BrandProductData | null;
  comparisonError?: string | null;
};

export type GA4ProductSortKey =
  | "revenue"
  | "purchased"
  | "conversion"
  | "views"
  | "addedToCart"
  | "checkedOut"
  | "itemName"
  | "itemBrand";

export type GA4ProductPageItem = GA4ProductMetricRow & {
  previous: GA4ProductMetricRow | null;
};

export type GA4ProductPage = {
  items: GA4ProductPageItem[];
  page: number;
  pageSize: 25 | 50 | 100;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type GA4ProductOpportunities = {
  highInterest: GA4ProductMetricRow[];
  highConversion: GA4ProductMetricRow[];
  cartFriction: GA4ProductMetricRow[];
};

export type GA4BrandProductPageData = Omit<GA4BrandProductData, "products" | "comparison"> & {
  productCount: number;
  productPage: GA4ProductPage;
  opportunities: GA4ProductOpportunities;
  comparison: Omit<GA4BrandProductData, "products" | "comparison"> | null;
};

export type GA4NormalizedRow = {
  date: string;
  propertyId: string;
  ecommerce: Store;
  channelGroup: string;
  source: string;
  medium: string;
  campaign: string;
  deviceCategory: string;
  activeUsers: number;
  newUsers: number;
  sessions: number;
  engagedSessions: number;
  engagementRate: number;
  ecommercePurchases: number;
  purchaseRevenue: number;
};
