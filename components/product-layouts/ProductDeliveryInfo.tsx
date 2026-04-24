export function ProductDeliveryInfo() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-2">🚚 Доставка</h3>
        <p className="text-gray-600">Новою Поштою по всій Україні. Термін: 1-3 робочих дні.</p>
      </div>
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-2">💳 Оплата</h3>
        <p className="text-gray-600">Карткою онлайн або накладений платіж із передплатою.</p>
      </div>
    </div>
  );
}
