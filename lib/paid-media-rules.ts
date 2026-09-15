export const PAID_MEDIA_THRESHOLDS = {
  minimumLandingPageViewRate: 70,
  maximumLandingSessionDifferenceRate: 20,
} as const;

export type PaidMediaDiscrepancyInput = {
  linkClicks: number;
  landingPageViews: number;
  ga4Sessions: number;
  spend: number;
};

export function analyzePaidMediaDiscrepancy(
  input: PaidMediaDiscrepancyInput,
  thresholds = PAID_MEDIA_THRESHOLDS,
) {
  const linkToLandingRate = input.linkClicks
    ? (input.landingPageViews / input.linkClicks) * 100
    : 0;
  const landingSessionDifference = Math.abs(input.landingPageViews - input.ga4Sessions);
  const landingSessionDifferenceRate = input.landingPageViews
    ? (landingSessionDifference / input.landingPageViews) * 100
    : input.ga4Sessions
      ? 100
      : 0;

  return {
    linkToLandingRate,
    landingSessionDifference,
    landingSessionDifferenceRate,
    lowLandingRate: input.linkClicks > 0
      && linkToLandingRate < thresholds.minimumLandingPageViewRate,
    landingSessionGap: landingSessionDifferenceRate
      > thresholds.maximumLandingSessionDifferenceRate,
    activeTrafficWithoutSessions: input.spend > 0
      && input.linkClicks > 0
      && input.ga4Sessions === 0,
  };
}

export function attributionDiscrepancy(platform: number, ga4: number) {
  if (platform === 0 && ga4 === 0) return { alert: false, severity: "none" as const, differenceRate: null };
  if (platform > 0 && ga4 === 0) return { alert: true, severity: "critical" as const, differenceRate: null };
  if (ga4 > 0 && platform === 0) return { alert: true, severity: "critical" as const, differenceRate: null };
  const differenceRate = (Math.abs(platform - ga4) / ga4) * 100;
  return { alert: differenceRate > 25, severity: differenceRate > 25 ? "attention" as const : "none" as const, differenceRate };
}

export function paidMediaEmptyMessage(hasRows: boolean, spend: number): string | null {
  return !hasRows || spend <= 0
    ? "No se registraron datos de Paid Media para los filtros y período seleccionados."
    : null;
}
