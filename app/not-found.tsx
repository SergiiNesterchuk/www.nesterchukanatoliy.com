import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-300">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-gray-900">Сторінку не знайдено</h2>
        <p className="mt-2 text-gray-500">Сторінка, яку ви шукаєте, не існує або була переміщена.</p>
        <Link
          href="/"
          className="mt-6 inline-block px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
        >
          На головну
        </Link>
      </div>
    </div>
  );
}
