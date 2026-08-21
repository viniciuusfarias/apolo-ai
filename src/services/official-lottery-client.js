export async function loadOfficialLotteryData() {
  const [powerball, megaMillions, health] = await Promise.all([
    fetch('/api/lottery/results?game=Powerball&limit=250').then(response => response.ok ? response.json() : Promise.reject(response)),
    fetch('/api/lottery/results?game=Mega%20Millions&limit=250').then(response => response.ok ? response.json() : Promise.reject(response)),
    fetch('/api/data-source/health').then(response => response.json()).catch(() => null)
  ]);
  return { draws: [...powerball.draws, ...megaMillions.draws].sort((a, b) => b.draw_date.localeCompare(a.draw_date)), health, byGame: { Powerball: powerball, 'Mega Millions': megaMillions } };
}
