import type { PaymentProviderInterface } from "./PaymentProviderInterface";
import { WayForPayAdapter } from "./WayForPayAdapter";

const providers: Record<string, () => PaymentProviderInterface> = {
  wayforpay: () => new WayForPayAdapter(),
};

export function getPaymentProvider(
  name: string = "wayforpay"
): PaymentProviderInterface {
  const factory = providers[name];
  if (!factory) {
    throw new Error(`Unknown payment provider: ${name}`);
  }
  return factory();
}
