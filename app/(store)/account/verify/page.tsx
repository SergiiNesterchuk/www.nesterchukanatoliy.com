import { Mail } from "lucide-react";

export default function VerifyPage() {
  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <Mail className="mx-auto h-12 w-12 text-green-600 mb-4" />
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Перевірте пошту</h1>
      <p className="text-gray-500">Ми надіслали посилання для входу на вашу email-адресу. Натисніть посилання в листі.</p>
    </div>
  );
}
