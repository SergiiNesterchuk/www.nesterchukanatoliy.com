import { IntegrationLogRepository } from "@/repositories/IntegrationLogRepository";
import { IntegrationError } from "@/shared/errors";
import { createLogger } from "@/shared/logger";

const logger = createLogger("KeyCRMClient");

export class KeyCRMClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = process.env.KEYCRM_BASE_URL || "https://openapi.keycrm.app/v1";
    this.apiKey = process.env.KEYCRM_API_KEY || "";
  }

  async request<T>(
    method: string,
    endpoint: string,
    body?: unknown,
    entityType?: string,
    entityId?: string
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const startTime = Date.now();

    try {
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const durationMs = Date.now() - startTime;
      const responseText = await response.text();

      // Log the request
      await IntegrationLogRepository.create({
        integration: "keycrm",
        direction: "outbound",
        method,
        endpoint,
        entityType,
        entityId,
        requestBody: body ? JSON.stringify(body).substring(0, 5000) : undefined,
        responseBody: responseText.substring(0, 5000),
        responseStatus: response.status,
        durationMs,
      });

      if (!response.ok) {
        logger.error("KeyCRM API error", {
          endpoint,
          status: response.status,
          response: responseText.substring(0, 500),
        });
        throw new IntegrationError(
          "KeyCRM",
          `API returned ${response.status}: ${responseText.substring(0, 200)}`,
          { status: response.status }
        );
      }

      return JSON.parse(responseText) as T;
    } catch (error) {
      if (error instanceof IntegrationError) throw error;

      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      await IntegrationLogRepository.create({
        integration: "keycrm",
        direction: "outbound",
        method,
        endpoint,
        entityType,
        entityId,
        errorMessage,
        durationMs,
      });

      throw new IntegrationError("KeyCRM", errorMessage);
    }
  }
}
