export type GoogleAdsQueryInput = {
  customerId: string;
  loginCustomerId?: string;
  dateFrom: string;
  dateTo: string;
};

export type GoogleAdsCampaignMetric = {
  date: string;
  campaignId: string;
  campaignName: string;
  campaignStatus: string;
  campaignType: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  attributedConversionValue: number;
};

export type GoogleAdsDerivedMetrics = {
  ctr: number | null;
  cpc: number | null;
  cpa: number | null;
  roas: number | null;
};

export type GoogleAdsTotals = GoogleAdsDerivedMetrics & {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  attributedConversionValue: number;
};

export type GoogleAdsApiResult = {
  campaign?: {
    id?: string | number;
    name?: string;
    status?: string;
    advertisingChannelType?: string;
  };
  metrics?: {
    impressions?: string | number;
    clicks?: string | number;
    costMicros?: string | number;
    conversions?: string | number;
    conversionsValue?: string | number;
  };
  segments?: { date?: string };
};

export type GoogleAdsSearchStreamResponse = Array<{
  results?: GoogleAdsApiResult[];
}>;
