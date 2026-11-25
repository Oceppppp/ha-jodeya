// Contoh file JavaScript siap upload ke Ha Jodeya (diproses 100% tanpa eval())
export const ramalanPermintaan = {
  moduleId: 'forecasting',
  title: '01 · Ramalan Permintaan JS Import',
  periodLabels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun'],
  values: [115, 124, 133, 141, 152, 160],
  autoOptimize: true,
  horizon: 6,
};

export default {
  module: 'mps',
  title: '02 · Jadwal Induk MPS JS Import',
  productName: 'Kompresor Seri K-90',
  beginningInventory: 80,
  safetyStock: 20,
  demandTimeFence: 1,
  planningTimeFence: 3,
  lotSizing: 'FOQ',
  lotSize: 200,
  stdHoursPerUnit: 0.7,
  forecasts: [168, 176, 185, 193, 201, 210],
  customerOrders: [175, 140, 110, 75, 40, 15],
  availableCapacity: [160, 160, 160, 160, 160, 130],
};
