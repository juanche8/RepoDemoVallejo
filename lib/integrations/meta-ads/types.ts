export type MetaAction = { action_type?: string; value?: string };

export type MetaInsightsRow = {
  campaign_id?: string;
  campaign_name?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  spend?: string;
  actions?: MetaAction[];
  action_values?: MetaAction[];
};

export type MetaInsightsResponse = {
  data?: MetaInsightsRow[];
  paging?: { cursors?: { after?: string }; next?: string };
  error?: {
    code?: number;
    error_subcode?: number;
    message?: string;
    type?: string;
  };
};

export type MetaCampaignMetric = {
  campaignId: string;
  campaignName: string;
  impressions: number;
  reach: number;
  clicks: number;
  spend: number;
  purchases: number;
  attributedPurchaseValue: number;
  omniPurchases: number;
  omniPurchaseValue: number;
  ctr: number | null;
  cpc: number | null;
  cpa: number | null;
  roas: number | null;
};

export type MetaTotals = Omit<MetaCampaignMetric, "campaignId" | "campaignName" | "reach"> & {
  reach: number | null;
};

export type MetaAdsData = {
  connectionStatus: "connected";
  ecommerce: "sportotal" | "vallejo";
  dateFrom: string;
  dateTo: string;
  updatedAt: string;
  campaigns: MetaCampaignMetric[];
  totals: MetaTotals;
  comparison?: MetaAdsData | null;
  comparisonError?: string | null;
  comparisonConnectionStatus?: string | null;
};
