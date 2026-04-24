"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useCartStore } from "@/hooks/useCart";
import { formatPrice } from "@/shared/money";
import { normalizePhoneUA, isValidPhoneUA, formatPhoneUA } from "@/shared/phone";
import { DELIVERY_METHODS, COD_PREPAYMENT_AMOUNT } from "@/shared/constants";
import { Spinner } from "@/components/ui/Spinner";
import { MapPin, Search } from "lucide-react";

interface Settlement {
  Ref: string;
  Description: string;
  AreaDescription: string;
  RegionsDescription: string;
  SettlementTypeDescription: string;
  DeliveryCity: string;
  MainDescription: string;
  Present: string;
}

interface Warehouse {
  Ref: string;
  Description: string;
  ShortAddress: string;
  Number: string;
  TypeOfWarehouse: string;
  CategoryOfWarehouse: string;
}

const POPULAR_CITIES = [
  { name: "Київ", query: "Київ" },
  { name: "Львів", query: "Львів" },
  { name: "Харків", query: "Харків" },
  { name: "Одеса", query: "Одеса" },
  { name: "Дніпро", query: "Дніпро" },
  { name: "Бровари", query: "Бровари" },
];

interface PaymentMethodOption {
  key: string;
  title: string;
  description: string | null;
  requiresOnlinePayment: boolean;
}

export function CheckoutForm({ requireTerms = true }: { requireTerms?: boolean }) {
  const { items, totalPrice, clearCart, updateQuantity, removeItem } = useCartStore();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState("");

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState("nova_poshta_branch");
  const [comment, setComment] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Payment methods from admin
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOption[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("");

  // Nova Poshta
  const [cityQuery, setCityQuery] = useState("");
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [selectedCity, setSelectedCity] = useState<Settlement | null>(null);
  const [cityLoading, setCityLoading] = useState(false);
  const [showCityDropdown, setShowCityDropdown] = useState(false);

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseQuery, setWarehouseQuery] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
  const [warehouseLoading, setWarehouseLoading] = useState(false);
  const [showWarehouseDropdown, setShowWarehouseDropdown] = useState(false);
  const [warehouseFilter, setWarehouseFilter] = useState<"all" | "branch" | "postomat">("all");

  // Load payment methods on mount
  useEffect(() => {
    fetch("/api/payment-methods")
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data?.length > 0) {
          setPaymentMethods(d.data);
          setSelectedPaymentMethod(d.data[0].key);
        } else {
          // Fallback
          setPaymentMethods([{ key: "card_online", title: "Оплата карткою онлайн", description: null, requiresOnlinePayment: true }]);
          setSelectedPaymentMethod("card_online");
        }
      })
      .catch(() => {
        setPaymentMethods([{ key: "card_online", title: "Оплата карткою онлайн", description: null, requiresOnlinePayment: true }]);
        setSelectedPaymentMethod("card_online");
      });
  }, []);
  const [courierAddress, setCourierAddress] = useState("");
  const [npError, setNpError] = useState("");

  // Debounced city search
  useEffect(() => {
    if (!cityQuery || cityQuery.length < 2 || selectedCity) return;
    const timer = setTimeout(async () => {
      setCityLoading(true);
      setNpError("");
      try {
        const res = await fetch(`/api/novaposhta/settlements?query=${encodeURIComponent(cityQuery)}`);
        const data = await res.json();
        if (data.success && data.data?.length > 0) {
          setSettlements(data.data);
          setShowCityDropdown(true);
        } else if (!data.success && data.error?.message) {
          setNpError(data.error.message);
          setSettlements([]);
        } else {
          setSettlements([]);
          setShowCityDropdown(true); // show "nothing found"
        }
      } catch {
        setNpError("Не вдалося з'єднатися з Новою Поштою");
        setSettlements([]);
      } finally {
        setCityLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [cityQuery, selectedCity]);

  const loadWarehouses = useCallback(async (ref: string, type: string = "all") => {
    setWarehouseLoading(true);
    setNpError("");
    try {
      // Try DeliveryCity ref first, then settlement Ref
      const res = await fetch(`/api/novaposhta/warehouses?cityRef=${encodeURIComponent(ref)}&type=${type}`);
      const data = await res.json();
      if (data.success) {
        setWarehouses(data.data || []);
      } else if (data.error?.message) {
        setNpError(data.error.message);
        setWarehouses([]);
      }
    } catch {
      setNpError("Не вдалося завантажити відділення");
      setWarehouses([]);
    } finally {
      setWarehouseLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedCity) return;
    // Delay warehouse load to avoid NovaPoshta rate limit after searchSettlements
    const timer = setTimeout(() => {
      const ref = selectedCity.DeliveryCity || selectedCity.Ref;
      loadWarehouses(ref, warehouseFilter);
    }, 800);
    return () => clearTimeout(timer);
  }, [selectedCity, warehouseFilter, loadWarehouses]);

  const selectCity = (s: Settlement) => {
    setSelectedCity(s);
    // Show only city name in input (not full "м. Київ, Київська обл.")
    setCityQuery(s.MainDescription || s.Description);
    setShowCityDropdown(false);
    setSelectedWarehouse(null);
    setWarehouseQuery("");
    setWarehouses([]);
    setNpError("");
    setErrors((p) => ({ ...p, city: "" }));
  };

  const selectPopularCity = async (query: string) => {
    setCityLoading(true);
    setNpError("");
    try {
      const res = await fetch(`/api/novaposhta/settlements?query=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.success && data.data?.length > 0) {
        // selectCity sets selectedCity which prevents debounce from firing again
        selectCity(data.data[0]);
      } else if (data.error?.message) {
        setCityQuery(query);
        setNpError(data.error.message);
      }
    } catch {
      setCityQuery(query);
      setNpError("Не вдалося знайти місто");
    } finally {
      setCityLoading(false);
    }
  };

  const selectWarehouse = (w: Warehouse) => {
    setSelectedWarehouse(w);
    setWarehouseQuery(w.Description);
    setShowWarehouseDropdown(false);
    setErrors((p) => ({ ...p, warehouse: "" }));
  };

  const filteredWarehouses = warehouses.filter((w) =>
    warehouseQuery.length < 2 || w.Description.toLowerCase().includes(warehouseQuery.toLowerCase()) || w.Number.includes(warehouseQuery)
  );

  const handlePhoneBlur = () => {
    if (customerPhone && isValidPhoneUA(customerPhone)) setCustomerPhone(formatPhoneUA(customerPhone));
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!customerName.trim() || customerName.length < 2) e.customerName = "Вкажіть ім'я";
    if (!isValidPhoneUA(customerPhone)) e.customerPhone = "Невірний номер телефону";
    if (!selectedCity) e.city = "Оберіть місто";
    if (deliveryMethod === "nova_poshta_branch" && !selectedWarehouse) e.warehouse = "Оберіть відділення";
    if (deliveryMethod === "nova_poshta_courier" && !courierAddress.trim()) e.courierAddress = "Вкажіть адресу";
    if (requireTerms && !agreedToTerms) e.agreedToTerms = "Потрібна згода з умовами";
    if (items.length === 0) e.items = "Кошик порожній";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate() || submitting) return;
    setSubmitting(true); setGeneralError("");

    try {
      const idempotencyKey = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerPhone: normalizePhoneUA(customerPhone),
          customerEmail: customerEmail.trim() || undefined,
          deliveryMethod,
          deliveryCity: selectedCity?.Description || "",
          deliveryBranchRef: selectedWarehouse?.Ref || undefined,
          deliveryBranchName: selectedWarehouse?.Description || undefined,
          deliveryAddress: deliveryMethod === "nova_poshta_courier" ? courierAddress : undefined,
          comment: comment.trim() || undefined,
          paymentMethod: selectedPaymentMethod || "card_online",
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          idempotencyKey,
          agreedToTerms: true,
        }),
      });

      const data = await response.json();
      if (!data.success) { setGeneralError(data.error?.message || "Помилка"); return; }

      clearCart();

      // Save order to localStorage for "recent orders" feature
      try {
        const recent = JSON.parse(localStorage.getItem("recentOrders") || "[]") as string[];
        if (!recent.includes(data.data.orderNumber)) {
          recent.unshift(data.data.orderNumber);
          localStorage.setItem("recentOrders", JSON.stringify(recent.slice(0, 10)));
        }
      } catch { /* */ }

      if (data.data.requiresOnlinePayment && data.data.payment?.formFields) {
        const paymentData = encodeURIComponent(JSON.stringify({ url: data.data.payment.url, fields: data.data.payment.formFields }));
        window.location.href = `/checkout/pay?data=${paymentData}`;
        return;
      }

      // COD or no payment — go directly to success
      const pmParam = data.data.paymentMethod ? `&pm=${data.data.paymentMethod}` : "";
      window.location.href = `/checkout/success?order=${data.data.orderNumber}${pmParam}`;
    } catch { setGeneralError("Помилка з'єднання."); }
    finally { setSubmitting(false); }
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">Кошик порожній</p>
        <a href="/katalog/" className="mt-4 inline-block text-green-600 hover:underline">Перейти до каталогу</a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {generalError && <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{generalError}</div>}

      {/* Order summary — editable quantities */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Ваше замовлення</h2>
          <a href="/katalog/" className="text-sm text-green-600 hover:underline">+ Додати ще товари</a>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 space-y-4">
          {items.map((item) => {
            const isLastItem = items.length === 1 && item.quantity === 1;

            const handleMinus = () => {
              if (isLastItem) {
                if (confirm("Видалити останній товар з корзини?")) {
                  removeItem(item.productId);
                }
              } else {
                updateQuantity(item.productId, item.quantity - 1);
              }
            };

            const handleRemove = () => {
              if (isLastItem) {
                if (confirm("Видалити останній товар з корзини?")) {
                  removeItem(item.productId);
                }
              } else {
                removeItem(item.productId);
              }
            };

            return (
              <div key={item.productId} className="text-sm">
                {/* Row 1: name + price + remove */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="flex-1 text-gray-900 leading-snug line-clamp-2">{item.name}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="font-medium">{formatPrice(item.price * item.quantity)}</span>
                    <button type="button" onClick={handleRemove}
                      className="text-gray-400 hover:text-red-500 text-lg leading-none" title="Видалити">×</button>
                  </div>
                </div>
                {/* Row 2: quantity controls */}
                <div className="flex items-center gap-1">
                  <button type="button" onClick={handleMinus}
                    className="w-7 h-7 rounded border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100">−</button>
                  <span className="w-8 text-center font-medium tabular-nums">{item.quantity}</span>
                  <button type="button" onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                    className="w-7 h-7 rounded border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100">+</button>
                  <span className="text-xs text-gray-400 ml-2">× {formatPrice(item.price)}</span>
                </div>
              </div>
            );
          })}
          <div className="border-t pt-3 flex justify-between font-semibold">
            <span>Разом</span><span>{formatPrice(totalPrice())}</span>
          </div>
        </div>
      </section>

      {/* 1. Contact */}
      <section>
        <h2 className="text-lg font-semibold mb-4">1. Контактні дані</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input id="customerName" label="Ім'я та прізвище *" value={customerName} onChange={(e) => { setCustomerName(e.target.value); setErrors((p) => ({ ...p, customerName: "" })); }} error={errors.customerName} placeholder="Ім'я Прізвище" />
          <Input id="customerPhone" label="Телефон *" type="tel" value={customerPhone} onChange={(e) => { setCustomerPhone(e.target.value); setErrors((p) => ({ ...p, customerPhone: "" })); }} onBlur={handlePhoneBlur} error={errors.customerPhone} placeholder="+380 XX XXX XX XX" />
          <Input id="customerEmail" label="Email" type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="email@example.com" className="md:col-span-2" />
        </div>
      </section>

      {/* 2. Delivery */}
      <section>
        <h2 className="text-lg font-semibold mb-4">2. Доставка</h2>
        <div className="space-y-2 mb-4">
          {Object.entries(DELIVERY_METHODS).map(([key, label]) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer">
              <input type="radio" name="dm" value={key} checked={deliveryMethod === key} onChange={(e) => setDeliveryMethod(e.target.value)} className="text-green-600" />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>

        {/* Popular cities */}
        <div className="mb-3">
          <p className="text-xs text-gray-500 mb-2">Популярні міста:</p>
          <div className="flex flex-wrap gap-2">
            {POPULAR_CITIES.map((c) => (
              <button key={c.name} type="button" onClick={() => selectPopularCity(c.query)}
                className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${selectedCity?.Description?.includes(c.name) ? "bg-green-600 text-white border-green-600" : "bg-white text-gray-700 border-gray-300 hover:border-green-500"}`}>
                <MapPin className="h-3 w-3 inline mr-1" />{c.name}
              </button>
            ))}
          </div>
        </div>

        {/* City search */}
        <div className="relative mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input type="text" value={cityQuery}
              onChange={(e) => { setCityQuery(e.target.value); setSelectedCity(null); setSelectedWarehouse(null); setErrors((p) => ({ ...p, city: "" })); }}
              onFocus={() => settlements.length > 0 && setShowCityDropdown(true)}
              placeholder="Пошук міста або села..."
              className={`w-full pl-10 pr-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-green-200 ${errors.city ? "border-red-300" : "border-gray-300"}`} />
            {cityLoading && <Spinner className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4" />}
          </div>
          {errors.city && <p className="mt-1 text-xs text-red-600">{errors.city}</p>}
          {npError && <p className="mt-1 text-xs text-orange-600">{npError}</p>}
          {showCityDropdown && !cityLoading && (
            <div className="absolute z-20 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {settlements.length > 0 ? settlements.map((s) => (
                <button key={s.Ref} type="button" onClick={() => selectCity(s)} className="w-full text-left px-3 py-2 hover:bg-green-50 text-sm border-b last:border-0">
                  <span className="font-medium">{s.MainDescription || s.Description}</span>
                  <span className="text-gray-400 text-xs ml-2">{s.SettlementTypeDescription}, {s.AreaDescription} обл.{s.RegionsDescription ? `, ${s.RegionsDescription}` : ""}</span>
                </button>
              )) : (
                <div className="px-3 py-3 text-sm text-gray-500 text-center">Нічого не знайдено</div>
              )}
            </div>
          )}
        </div>

        {/* Warehouse */}
        {selectedCity && deliveryMethod === "nova_poshta_branch" && (
          <div className="relative">
            <div className="flex gap-2 mb-2">
              {(["all", "branch", "postomat"] as const).map((f) => (
                <button key={f} type="button" onClick={() => setWarehouseFilter(f)}
                  className={`px-3 py-1 rounded-full text-xs border ${warehouseFilter === f ? "bg-green-600 text-white border-green-600" : "bg-white text-gray-600 border-gray-300"}`}>
                  {f === "all" ? "Усі" : f === "branch" ? "Відділення" : "Поштомати"}
                </button>
              ))}
            </div>
            <input type="text" value={warehouseQuery}
              onChange={(e) => { setWarehouseQuery(e.target.value); setSelectedWarehouse(null); setShowWarehouseDropdown(true); setErrors((p) => ({ ...p, warehouse: "" })); }}
              onFocus={() => setShowWarehouseDropdown(true)}
              placeholder={warehouseLoading ? "Завантаження..." : "Пошук відділення..."}
              className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-green-200 ${errors.warehouse ? "border-red-300" : "border-gray-300"}`} />
            {errors.warehouse && <p className="mt-1 text-xs text-red-600">{errors.warehouse}</p>}
            {showWarehouseDropdown && !warehouseLoading && filteredWarehouses.length > 0 && (
              <div className="absolute z-20 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {filteredWarehouses.slice(0, 50).map((w) => (
                  <button key={w.Ref} type="button" onClick={() => selectWarehouse(w)} className="w-full text-left px-3 py-2 hover:bg-green-50 text-sm border-b last:border-0">{w.Description}</button>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedCity && deliveryMethod === "nova_poshta_courier" && (
          <Input id="courierAddress" label="Адреса *" value={courierAddress} onChange={(e) => { setCourierAddress(e.target.value); setErrors((p) => ({ ...p, courierAddress: "" })); }} error={errors.courierAddress} placeholder="вул. Симона Петлюри, 16" />
        )}
      </section>

      {/* 3. Payment */}
      <section>
        <h2 className="text-lg font-semibold mb-4">3. Оплата</h2>
        <div className="space-y-3">
          {paymentMethods.map((pm) => {
            const isCod = pm.key.includes("cod");
            const prepayUAH = COD_PREPAYMENT_AMOUNT / 100;
            const total = totalPrice();
            const prepay = isCod ? Math.min(COD_PREPAYMENT_AMOUNT, total) : 0;
            const remaining = isCod ? total - prepay : 0;

            return (
              <label key={pm.key} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedPaymentMethod === pm.key ? "border-green-500 bg-green-50" : "border-gray-200 hover:border-gray-300"}`}>
                <input type="radio" name="paymentMethod" value={pm.key} checked={selectedPaymentMethod === pm.key} onChange={() => setSelectedPaymentMethod(pm.key)} className="mt-0.5 text-green-600" />
                <div className="flex-1">
                  <span className="text-sm font-medium">{pm.title}</span>
                  {pm.description && <p className="text-xs text-gray-500 mt-0.5">{pm.description}</p>}
                  {isCod && selectedPaymentMethod === pm.key && total > 0 && (
                    <div className="mt-2 bg-orange-50 rounded-lg p-2.5 text-xs space-y-1">
                      <div className="flex justify-between"><span>Сума замовлення:</span><span className="font-medium">{formatPrice(total)}</span></div>
                      <div className="flex justify-between text-green-700"><span>Передплата зараз:</span><span className="font-medium">{formatPrice(prepay)}</span></div>
                      {remaining > 0 && <div className="flex justify-between text-orange-700"><span>При отриманні:</span><span className="font-medium">{formatPrice(remaining)}</span></div>}
                    </div>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      </section>

      <section>
        <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-1">Коментар</label>
        <textarea id="comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-200" placeholder="Додаткові побажання..." />
      </section>

      {requireTerms && (
        <div>
          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={agreedToTerms} onChange={(e) => { setAgreedToTerms(e.target.checked); setErrors((p) => ({ ...p, agreedToTerms: "" })); }} className="mt-0.5 text-green-600 rounded" />
            <span className="text-sm text-gray-600">Я погоджуюсь з <a href="/umovy-vykorystannia/" target="_blank" className="text-green-600 hover:underline">умовами використання</a></span>
          </label>
          {errors.agreedToTerms && <p className="mt-1 text-xs text-red-600">{errors.agreedToTerms}</p>}
        </div>
      )}

      <Button type="submit" size="lg" loading={submitting} disabled={submitting} className="w-full">
        {submitting ? "Оформлення..." :
          selectedPaymentMethod.includes("cod")
            ? `Оплатити передплату ${formatPrice(Math.min(COD_PREPAYMENT_AMOUNT, totalPrice()))}`
            : `Оплатити ${formatPrice(totalPrice())}`
        }
      </Button>
    </form>
  );
}
