export type MetaEcommerce = "sportotal" | "vallejo";

type MetaEnvironment = Record<string, string | undefined>;

const accountEnvironmentByEcommerce: Record<MetaEcommerce, string> = {
  sportotal: "META_SPORTOTAL_AD_ACCOUNT_ID",
  vallejo: "META_VALLEJO_AD_ACCOUNT_ID",
};

export function normalizeMetaEcommerce(value: string): MetaEcommerce {
  if (value === "sportotal" || value === "Sportotal") return "sportotal";
  if (value === "vallejo" || value === "Vallejo Calzados") return "vallejo";
  throw new Error("Meta Ads: ecommerce no soportado.");
}

export function getMetaAdAccountId(
  ecommerce: string,
  environment: MetaEnvironment = process.env,
): string {
  const normalizedEcommerce = normalizeMetaEcommerce(ecommerce);
  const environmentName = accountEnvironmentByEcommerce[normalizedEcommerce];
  const accountId = environment[environmentName]?.trim().replace(/^act_/, "");
  if (!accountId) {
    throw new Error(`Meta Ads: falta la cuenta configurada para ${normalizedEcommerce}.`);
  }
  if (!/^\d+$/.test(accountId)) {
    throw new Error(`Meta Ads: cuenta inválida para ${normalizedEcommerce}.`);
  }
  return accountId;
}
