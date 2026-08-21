export function buildStatistics(draws, range) {
  const frequency = Array.from({ length: range + 1 }, () => 0);
  const lastSeen = Array.from({ length: range + 1 }, () => null);
  draws.forEach((draw, drawIndex) => draw.white_numbers.forEach(number => {
    frequency[number] += 1;
    if (lastSeen[number] === null) lastSeen[number] = drawIndex;
  }));
  return { frequency, lastSeen, drawCount: draws.length };
}

export function combinationScore(numbers, statistics, range) {
  const sorted = [...numbers].sort((a, b) => a - b);
  const lowHigh = sorted.filter(number => number <= range / 2).length;
  const odd = sorted.filter(number => number % 2).length;
  const sum = sorted.reduce((total, number) => total + number, 0);
  const spread = sorted.at(-1) - sorted[0];
  const consecutive = sorted.filter((number, index) => index && number === sorted[index - 1] + 1).length;
  const averageFrequency = sorted.reduce((total, number) => total + statistics.frequency[number], 0) / Math.max(sorted.length, 1);
  const expectedFrequency = (statistics.drawCount * 5) / range;
  const components = {
    low_high: Math.max(0, 18 - Math.abs(lowHigh - 2.5) * 7),
    odd_even: Math.max(0, 18 - Math.abs(odd - 2.5) * 7),
    sum: sum >= range * 1.45 && sum <= range * 3.55 ? 16 : 8,
    spread: spread >= range * 0.45 ? 14 : 7,
    consecutive: consecutive ? 6 : 12,
    frequency: Math.max(0, Math.min(22, 22 - Math.abs(averageFrequency - expectedFrequency) * 5))
  };
  return { score: Math.round(Object.values(components).reduce((total, value) => total + value, 0)), components, period: statistics.drawCount };
}

export function generateFromStatistics({ range, specialMax, statistics, strategy = 'Equilibrada', count = 1 }) {
  const pool = Array.from({ length: range }, (_, index) => index + 1);
  const weight = number => {
    if (strategy === 'Frequência recente') return Math.max(1, statistics.frequency[number]);
    if (strategy === 'Há mais tempo sem aparecer') return Math.max(1, statistics.lastSeen[number] ?? statistics.drawCount);
    return 1;
  };
  const choose = values => {
    const available = [...values]; const selected = [];
    while (selected.length < 5) {
      const total = available.reduce((sum, number) => sum + weight(number), 0);
      let cursor = crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32 * total;
      const index = available.findIndex(number => (cursor -= weight(number)) <= 0);
      selected.push(available.splice(Math.max(index, 0), 1)[0]);
    }
    return selected.sort((a, b) => a - b);
  };
  return Array.from({ length: count }, () => {
    const nums = choose(pool);
    const special = crypto.getRandomValues(new Uint32Array(1))[0] % specialMax + 1;
    return { nums, special, ...combinationScore(nums, statistics, range), strategy };
  });
}
