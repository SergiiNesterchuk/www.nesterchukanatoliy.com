"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useCartStore } from "@/hooks/useCart";
import { formatPrice } from "@/shared/money";
import { DELIVERY_METHODS, PAYMENT_METHODS } from "@/shared/constants";

export function CheckoutForm() {
  const router = useRouter();
  const { items, totalPrice, clearCart } = useCartStore();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState("");

  const [form, setForm] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    deliveryMethod: "nova_poshta_branch",
    deliveryCity: "",
    deliveryBranchName: "",
    deliveryAddress: "",
    comment: "",
    agreedToTerms: false,
  });

  const updateField = (field: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!form.customerName.trim() || form.customerName.length < 2)
      newErrors.customerName = "Вкажіть ім'я (мін. 2 символи)";
    if (!form.customerPhone.match(/^[\d\s\+\-\(\)]{10,20}$/))
      newErrors.customerPhone = "Вкажіть коректний номер телефону";
    if (!form.deliveryCity.trim())
      newErrors.deliveryCity = "Вкажіть місто";
    if (form.deliveryMethod === "nova_poshta_branch" && !form.deliveryBranchName.trim())
      newErrors.deliveryBranchName = "Вкажіть відділення";
    if (form.deliveryMethod === "nova_poshta_courier" && !form.deliveryAddress.trim())
      newErrors.deliveryAddress = "Вкажіть адресу";
    if (!form.agreedToTerms)
      newErrors.agreedToTerms = "Потрібна згода з умовами";
    if (items.length === 0)
      newErrors.items = "Кошик порожній";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || submitting) return;

    setSubmitting(true);
    setGeneralError("");

    try {
      const idempotencyKey = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          paymentMethod: "card_online",
          items: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
          })),
          idempotencyKey,
          agreedToTerms: true,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setGeneralError(data.error?.message || "Помилка оформлення замовлення");
        return;
      }

      clearCart();

      // If payment provider returned form fields — auto-submit to WayForPay
      if (data.data.payment?.formFields) {
        const form = document.createElement("form");
        form.method = "POST";
        form.action = data.data.payment.url;
        const fields = data.data.payment.formFields as Record<string, string | string[]>;
        for (const [key, value] of Object.entries(fields)) {
          if (Array.isArray(value)) {
            value.forEach((v) => {
              const input = document.createElement("input");
              input.type = "hidden";
              input.name = `${key}[]`;
              input.value = v;
              form.appendChild(input);
            });
          } else {
            const input = document.createElement("input");
            input.type = "hidden";
            input.name = key;
            input.value = value;
            form.appendChild(input);
          }
        }
        document.body.appendChild(form);
        form.submit();
        return;
      }

      // No payment — redirect to success
      router.push(`/checkout/success?order=${data.data.orderNumber}`);
    } catch {
      setGeneralError("Помилка з'єднання. Спробуйте ще раз.");
    } finally {
      setSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">Кошик порожній</p>
        <a href="/katalog/" className="mt-4 inline-block text-green-600 hover:underline">
          Перейти до каталогу
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {generalError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          {generalError}
        </div>
      )}

      {/* Order summary */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Ваше замовлення</h2>
        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          {items.map((item) => (
            <div key={item.productId} className="flex justify-between text-sm">
              <span>
                {item.name} &times; {item.quantity}
              </span>
              <span className="font-medium">{formatPrice(item.price * item.quantity)}</span>
            </div>
          ))}
          <div className="border-t pt-2 flex justify-between font-semibold">
            <span>Разом</span>
            <span>{formatPrice(totalPrice())}</span>
          </div>
        </div>
      </section>

      {/* Contact info */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Контактні дані</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            id="customerName"
            label="Ім'я та прізвище *"
            value={form.customerName}
            onChange={(e) => updateField("customerName", e.target.value)}
            error={errors.customerName}
            placeholder="Анатолій Нестерчук"
          />
          <Input
            id="customerPhone"
            label="Телефон *"
            type="tel"
            value={form.customerPhone}
            onChange={(e) => updateField("customerPhone", e.target.value)}
            error={errors.customerPhone}
            placeholder="+380 93 000 3008"
          />
          <Input
            id="customerEmail"
            label="Email"
            type="email"
            value={form.customerEmail}
            onChange={(e) => updateField("customerEmail", e.target.value)}
            error={errors.customerEmail}
            placeholder="email@example.com"
            className="md:col-span-2"
          />
        </div>
      </section>

      {/* Delivery */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Доставка</h2>
        <div className="space-y-3">
          {Object.entries(DELIVERY_METHODS).map(([key, label]) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="deliveryMethod"
                value={key}
                checked={form.deliveryMethod === key}
                onChange={(e) => updateField("deliveryMethod", e.target.value)}
                className="text-green-600 focus:ring-green-500"
              />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            id="deliveryCity"
            label="Місто *"
            value={form.deliveryCity}
            onChange={(e) => updateField("deliveryCity", e.target.value)}
            error={errors.deliveryCity}
            placeholder="Бровари"
          />
          {form.deliveryMethod === "nova_poshta_branch" && (
            <Input
              id="deliveryBranchName"
              label="Відділення Нової Пошти *"
              value={form.deliveryBranchName}
              onChange={(e) => updateField("deliveryBranchName", e.target.value)}
              error={errors.deliveryBranchName}
              placeholder="Відділення №1"
            />
          )}
          {form.deliveryMethod === "nova_poshta_courier" && (
            <Input
              id="deliveryAddress"
              label="Адреса доставки *"
              value={form.deliveryAddress}
              onChange={(e) => updateField("deliveryAddress", e.target.value)}
              error={errors.deliveryAddress}
              placeholder="вул. Симона Петлюри, 16"
            />
          )}
        </div>
      </section>

      {/* Payment */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Оплата</h2>
        {Object.entries(PAYMENT_METHODS).map(([key, label]) => (
          <label key={key} className="flex items-center gap-3 cursor-pointer">
            <input type="radio" checked readOnly className="text-green-600" />
            <span className="text-sm">{label}</span>
          </label>
        ))}
      </section>

      {/* Comment */}
      <section>
        <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-1">
          Коментар до замовлення
        </label>
        <textarea
          id="comment"
          value={form.comment}
          onChange={(e) => updateField("comment", e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-500"
          placeholder="Додаткові побажання..."
        />
      </section>

      {/* Terms */}
      <div>
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.agreedToTerms}
            onChange={(e) => updateField("agreedToTerms", e.target.checked)}
            className="mt-0.5 text-green-600 focus:ring-green-500 rounded"
          />
          <span className="text-sm text-gray-600">
            Я погоджуюсь з{" "}
            <a href="/umovy-vykorystannia/" target="_blank" className="text-green-600 hover:underline">
              умовами використання
            </a>
          </span>
        </label>
        {errors.agreedToTerms && (
          <p className="mt-1 text-xs text-red-600">{errors.agreedToTerms}</p>
        )}
      </div>

      <Button type="submit" size="lg" loading={submitting} disabled={submitting} className="w-full">
        {submitting ? "Оформлення..." : `Оплатити ${formatPrice(totalPrice())}`}
      </Button>
    </form>
  );
}
