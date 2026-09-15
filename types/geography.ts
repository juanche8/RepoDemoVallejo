import type { Store } from "./analytics";

export type VtexOrderItem = {
  id: string;
  quantity: number;
  sellingPrice?: number;
};

export type VtexDeliveryAddress = {
  city?: string;
  state?: string;
  postalCode?: string;
  addressType?: string;
};

export type VtexGeographicOrder = {
  orderId: string;
  creationDate: string;
  orderValue: number;
  items: VtexOrderItem[];
  totalQuantity: number;
  shippingData?: {
    selectedAddresses?: VtexDeliveryAddress[];
    deliveryChannel?: string;
  };
};

export type NormalizedDeliveryLocation = {
  province: string;
  city: string;
  postalCode: string;
  plaza: string;
  original: {
    province?: string;
    city?: string;
    postalCode?: string;
  };
};

export type InventoryGeographySource = {
  ecommerce: Extract<Store, "Sportotal" | "Vallejo Calzados">;
  status: "pending";
  source: "VTEX";
};

function normalizeGeographicName(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es-AR")
    .replace(/(^|[\s'-])\p{L}/gu, (letter) => letter.toLocaleUpperCase("es-AR"));
}

export function normalizeProvince(value: string): string {
  return normalizeGeographicName(value);
}

export function normalizeCity(value: string): string {
  return normalizeGeographicName(value);
}

export function createPlaza(city: string, province: string): string {
  return `${normalizeCity(city)}, ${normalizeProvince(province)}`;
}

export function normalizeDeliveryLocation(address: VtexDeliveryAddress): NormalizedDeliveryLocation {
  const province = normalizeProvince(address.state ?? "Sin provincia");
  const city = normalizeCity(address.city ?? "Sin ciudad");
  return {
    province,
    city,
    postalCode: address.postalCode?.trim() ?? "",
    plaza: createPlaza(city, province),
    original: {
      province: address.state,
      city: address.city,
      postalCode: address.postalCode,
    },
  };
}

export function getGeographySource(ecommerce: string): InventoryGeographySource {
  if (ecommerce === "Sportotal" || ecommerce === "Vallejo Calzados") {
    return { ecommerce, status: "pending", source: "VTEX" };
  }
  throw new Error("Venta por plaza: ecommerce no soportado y sin fallback.");
}

export function getSalesByPlazaViewModel(ecommerce: string) {
  const connection = getGeographySource(ecommerce);
  return {
    connection,
    hasData: false as const,
    sourceLabel: "VTEX · Pendiente de conexión",
    message: "Conectaremos los pedidos reales para analizar ventas por provincia y plaza.",
  };
}
