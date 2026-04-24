import { createLogger } from "@/shared/logger";

const logger = createLogger("NovaPoshta");

const API_URL = "https://api.novaposhta.ua/v2.0/json/";

// In-memory cache
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
  MainDescription: string;
  Present: string;
}

export interface NovaPoshtaWarehouse {
  Ref: string;
  Description: string;
  ShortAddress: string;
  Number: string;
  TypeOfWarehouse: string;
  CityRef: string;
  CategoryOfWarehouse: string;
  SettlementRef: string;
}

async function apiRequest(
  modelName: string,
  calledMethod: string,
  methodProperties: Record<string, unknown>
): Promise<unknown> {
  const apiKey = process.env.NOVAPOSHTA_API_KEY;
  if (!apiKey) {
    logger.error("NOVAPOSHTA_API_KEY is not set");
    throw new Error("Нова Пошта не налаштована. Зверніться до адміністратора.");
  }

  logger.info("NovaPoshta API call", {
    modelName,
    calledMethod,
    props: Object.keys(methodProperties),
    hasApiKey: !!apiKey,
  });

  const body = {
    apiKey,
    modelName,
    calledMethod,
    methodProperties,
  };

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const json = await res.json();

    logger.info("NovaPoshta API response", {
      modelName,
      calledMethod,
      success: json.success,
      dataLength: Array.isArray(json.data) ? json.data.length : "not-array",
      errors: json.errors?.length ? json.errors : undefined,
      warnings: json.warnings?.length ? json.warnings : undefined,
    });

    if (!json.success) {
      const errors = json.errors?.join("; ") || "Unknown error";
      throw new Error(`NovaPoshta: ${errors}`);
    }

    return json.data;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("NovaPoshta:")) throw error;
    logger.error("NovaPoshta fetch failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error("Нова Пошта тимчасово недоступна. Спробуйте пізніше.");
  }
}

export class NovaPoshtaService {
  /**
   * Search settlements by name using Address/searchSettlements.
   * Returns list with DeliveryCity ref needed for getWarehouses.
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

    // searchSettlements returns: data[0].Addresses[] or data[0].TotalCount
    let addresses: Record<string, string>[] = [];

    if (Array.isArray(data) && data.length > 0) {
      const firstItem = data[0] as Record<string, unknown>;
      if (firstItem && Array.isArray(firstItem.Addresses)) {
        addresses = firstItem.Addresses as Record<string, string>[];
      }
    }

    logger.info("searchSettlements parsed", {
      query,
      rawDataType: typeof data,
      isArray: Array.isArray(data),
      firstItemKeys: Array.isArray(data) && data[0] ? Object.keys(data[0] as object) : [],
      addressCount: addresses.length,
    });

    const result: NovaPoshtaSettlement[] = addresses.map((a) => ({
      Ref: a.Ref || "",
      Description: a.MainDescription || a.Description || "",
      AreaDescription: a.Area || a.AreaDescription || "",
      RegionsDescription: a.Region || a.RegionsDescription || "",
      SettlementTypeDescription: a.SettlementTypeDescription || a.Warehouses || "",
      DeliveryCity: a.DeliveryCity || a.Ref || "",
      MainDescription: a.MainDescription || a.Description || "",
      Present: a.Present || `${a.MainDescription || a.Description || ""}, ${a.Area || ""} обл.`,
    }));

    setCache(cacheKey, result, 15 * 60 * 1000); // 15 min
    return result;
  }

  /**
   * Get warehouses for a city/settlement.
   * Uses SettlementRef (from searchSettlements Ref field).
   */
  static async getWarehouses(
    cityRef: string,
    type?: "branch" | "postomat" | "all"
  ): Promise<NovaPoshtaWarehouse[]> {
    if (!cityRef) return [];

    const cacheKey = `warehouses:${cityRef}:${type || "all"}`;
    const cached = getCached<NovaPoshtaWarehouse[]>(cacheKey);
    if (cached) return cached;

    // Try with SettlementRef first (more precise), fallback to CityRef
    const props: Record<string, unknown> = {
      SettlementRef: cityRef,
    };

    if (type === "postomat") {
      props.TypeOfWarehouseRef = "f9316480-5f2d-425d-bc2c-ac7cd29decf0";
    } else if (type === "branch") {
      props.TypeOfWarehouseRef = "841339c7-591a-42e2-8233-7a0a00f0ed6f"; // Branch
    }

    let rawData = await apiRequest("Address", "getWarehouses", props);

    // If SettlementRef returned nothing, try CityRef
    if (Array.isArray(rawData) && rawData.length === 0) {
      logger.info("No warehouses with SettlementRef, trying CityRef", { cityRef });
      const fallbackProps: Record<string, unknown> = { CityRef: cityRef };
      if (type === "postomat") {
        fallbackProps.TypeOfWarehouseRef = "f9316480-5f2d-425d-bc2c-ac7cd29decf0";
      } else if (type === "branch") {
        fallbackProps.TypeOfWarehouseRef = "841339c7-591a-42e2-8233-7a0a00f0ed6f";
      }
      rawData = await apiRequest("Address", "getWarehouses", fallbackProps);
    }

    const warehouseData = (Array.isArray(rawData) ? rawData : []) as Record<string, string>[];

    logger.info("getWarehouses result", { cityRef, type, count: warehouseData.length });

    const result: NovaPoshtaWarehouse[] = warehouseData.map((w) => ({
      Ref: w.Ref || "",
      Description: w.Description || "",
      ShortAddress: w.ShortAddress || "",
      Number: w.Number || "",
      TypeOfWarehouse: w.TypeOfWarehouse || "",
      CityRef: w.CityRef || "",
      CategoryOfWarehouse: w.CategoryOfWarehouse || "",
      SettlementRef: w.SettlementRef || "",
    }));

    setCache(cacheKey, result, 2 * 60 * 60 * 1000); // 2 hours
    return result;
  }
}
