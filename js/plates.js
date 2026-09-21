// Plate math + the colors real gym plates use, so the visual reads at a glance.
const PLATE_SIZES = {
  lbs: [45, 35, 25, 10, 5, 2.5],
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
};

const PLATE_COLORS = {
  lbs: { 45: "#e5484d", 35: "#f5a623", 25: "#4caf50", 10: "#f2f3f5", 5: "#20242a", 2.5: "#9aa1ab" },
  kg: { 25: "#e5484d", 20: "#2b6cff", 15: "#f5a623", 10: "#4caf50", 5: "#f2f3f5", 2.5: "#20242a", 1.25: "#9aa1ab" },
};

const DEFAULT_BAR_WEIGHT = { lbs: 45, kg: 20 };
const BAR_WEIGHT_OPTIONS = { lbs: [45, 35, 15], kg: [20, 15, 10] };

function calculatePlates(targetWeight, barWeight, u) {
  const sizes = PLATE_SIZES[u] || PLATE_SIZES.lbs;
  let perSide = (Number(targetWeight) - Number(barWeight)) / 2;
  if (!(perSide > 0)) return { plates: [], remaining: 0 };
  const plates = [];
  sizes.forEach((size) => {
    let count = 0;
    while (perSide + 1e-6 >= size) {
      perSide -= size;
      count++;
    }
    if (count > 0) plates.push({ size, count });
  });
  return { plates, remaining: Math.max(0, perSide) };
}
