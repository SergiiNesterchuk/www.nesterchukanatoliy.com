import { createLogger } from "@/shared/logger";

const logger = createLogger("NovaPoshta");

const API_URL = "https://api.novaposhta.ua/v2.0/json/";

// Simple in-memory cache
const cache = new Map<string, { data: unknown; expires: number }>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry || Date.now() > entry.expires) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache(key: string, data: unknown, ttlMs: number) {
  cache.set(key, { data, expires: Date.now() + ttlMs });
  // Prevent memory leak: limit cache size
  if (cache.size > 500) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
}

export interface NovaPoshtaSettlement {
  Ref: string;
  Description: string;
  AreaDescription: string;
  RegionsDescription: string;
  SettlementTypeDescription: string;
  DeliveryCity: string;
}

export interface NovaPoshtaWarehouse {
  Ref: string;
  Description: string;
  ShortAddress: string;
  Number: string;
  TypeOfWarehouse: string;
  CityRef: string;
  CategoryOfWarehouse: string;
}

async function apiRequest(
  modelName: string,
  calledMethod: string,
  methodProperties: Record<string, unknown>
): Promise<unknown[]> {
  const apiKey = process.env.NOVAPOSHTA_API_KEY;
  if (!apiKey) {
    throw new Error("NOVAPOSHTA_API_KEY not configured");
  }

  const body = {
    apiKey,
    modelName,
    calledMethod,
    methodProperties,
  };

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = await res.json();

  if (!json.success) {
    const errors = json.errors?.join("; ") || "Unknown error";
    logger.error("NovaPoshta API error", { modelName, calledMethod, errors });
    throw new Error(`NovaPoshta: ${errors}`);
  }

  return json.data || [];
}

export class NovaPoshtaService {
  /**
   * Search settlements (cities, villages) by name.
   * Returns settlements with Ref, name, area, type.
   */
  static async searchSettlements(query: string): Promise<NovaPoshtaSettlement[]> {
    if (!query || query.length < 2) return [];

    const cacheKey = `settlements:${query.toLowerCase()}`;
    const cached = getCached<NovaPoshtaSettlement[]>(cacheKey);
    if (cached) return cached;

    const data = await apiRequest("Address", "searchSettlements", {
      CityName: query,
      Limit: "20",
    });

    // searchSettlements returns nested structure
    const addresses = (data[0] as { Addresses?: NovaPoshtaSettlement[] })?.Addresses || [];

    const result = addresses.map((a) => ({
      Ref: a.Ref,
      Description: a.Description || "",
      AreaDescription: a.AreaDescription || "",
      RegionsDescription: a.RegionsDescription || "",
      SettlementTypeDescription: a.SettlementTypeDescription || "",
      DeliveryCity: a.DeliveryCity || a.Ref,
    }));

    setCache(cacheKey, result, 30 * 60 * 1000); // 30 min
    return result;
  }

  /**
   * Get warehouses (branches + parcel lockers) for a city.
   */
  static async getWarehouses(
    cityRef: string,
    type?: "branch" | "postomat" | "all"
  ): Promise<NovaPoshtaWarehouse[]> {
    if (!cityRef) return [];

    const cacheKey = `warehouses:${cityRef}:${type || "all"}`;
    const cached = getCached<NovaPoshtaWarehouse[]>(cacheKey);
    if (cached) return cached;

    const props: Record<string, unknown> = {
      CityRef: cityRef,
      Limit: "500",
    };

    // Filter by type
    if (type === "postomat") {
      props.TypeOfWarehouseRef = "f9316480-5f2d-425d-bc2c-ac7cd29decf0"; // Postomat
    } else if (type === "branch") {
      props.CategoryOfWarehouse = "Branch";
    }

    const data = (await apiRequest("Address", "getWarehouses", props)) as NovaPoshtaWarehouse[];

    const result = data.map((w) => ({
      Ref: w.Ref,
      Description: w.Description || "",
      ShortAddress: w.ShortAddress || "",
      Number: w.Number || "",
      TypeOfWarehouse: w.TypeOfWarehouse || "",
      CityRef: w.CityRef || "",
      CategoryOfWarehouse: w.CategoryOfWarehouse || "",
    }));

    setCache(cacheKey, result, 60 * 60 * 1000); // 1 hour
    return result;
  }
}
