const poolData = JSON.parse(open('../pool.json'));

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function pickProduct(hotRatio = 0.85) {
  if (Math.random() < hotRatio) {
    return pick(poolData.hotProducts);
  }
  return pick(poolData.coldProducts);
}

export function pickUser() {
  return pick(poolData.users);
}

export function pickSearchTerm() {
  return pick(poolData.searchTerms);
}

export { poolData };