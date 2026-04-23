"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Spinner } from "@/components/ui/Spinner";

export function PaymentRedirect() {
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState("");
  const submitted = useRef(false);

  useEffect(() => {
    if (submitted.current) return;

    const dataParam = searchParams.get("data");
    if (!dataParam) {
      setError("Дані для оплати не знайдені");
      return;
    }

    try {
      const { url, fields } = JSON.parse(decodeURIComponent(dataParam));

      if (!url || !fields) {
        setError("Невалідні дані для оплати");
        return;
      }

      const form = formRef.current;
      if (!form) return;

      form.action = url;
      form.method = "POST";
      form.innerHTML = "";

      for (const [key, value] of Object.entries(fields)) {
        if (Array.isArray(value)) {
          (value as string[]).forEach((v) => {
            const input = document.createElement("input");
            input.type = "hidden";
            input.name = `${key}[]`;
            input.value = String(v);
            form.appendChild(input);
          });
        } else {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = key;
          input.value = String(value);
          form.appendChild(input);
        }
      }

      submitted.current = true;
      form.submit();
    } catch {
      setError("Помилка обробки даних оплати");
    }
  }, [searchParams]);

  if (error) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-red-600 mb-4">{error}</p>
        <a href="/checkout" className="text-green-600 hover:underline">
          Повернутись до оформлення
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <Spinner className="mx-auto mb-4 h-8 w-8" />
      <p className="text-gray-600">Переадресація на сторінку оплати...</p>
      <form ref={formRef} style={{ display: "none" }} />
    </div>
  );
}
