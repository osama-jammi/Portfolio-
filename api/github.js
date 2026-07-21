// Vercel Serverless Function - Proxy pour GitHub Contributions

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');

    const username = req.query.user || 'osama-jammi';

    // Source 1: github-contributions.vercel.app (returns ready-to-use format)
    try {
        const response = await fetch(`https://github-contributions.vercel.app/api/v1/${username}`);
        if (response.ok) {
            const data = await response.json();
            if (data.years && data.contributions) {
                return res.status(200).json(data);
            }
        }
    } catch (e) {
        console.error('Source 1 failed:', e.message);
    }

    // Source 2: jogruber API - contributions is a FLAT array, not keyed by year
    try {
        const response = await fetch(`https://github-contributions-api.jogruber.de/v4/${username}?y=last`);
        if (response.ok) {
            const data = await response.json();

            // jogruber v4 format: { total: { "2024": 123 }, contributions: [ {date, count, level}, ... ] }
            const contributions = [];
            const yearsMap = {};

            if (Array.isArray(data.contributions)) {
                // Flat array format
                for (const day of data.contributions) {
                    const year = day.date.substring(0, 4);
                    contributions.push({
                        date: day.date,
                        count: day.count,
                        intensity: day.level
                    });
                    if (!yearsMap[year]) {
                        yearsMap[year] = { year, total: 0 };
                    }
                    yearsMap[year].total += day.count;
                }
            } else if (typeof data.contributions === 'object') {
                // Object keyed by year: { "2024": [ {date, count, level}, ... ] }
                for (const [year, yearData] of Object.entries(data.contributions)) {
                    if (!Array.isArray(yearData)) continue;
                    let yearTotal = 0;
                    for (const day of yearData) {
                        yearTotal += day.count;
                        contributions.push({
                            date: day.date,
                            count: day.count,
                            intensity: day.level
                        });
                    }
                    yearsMap[year] = { year, total: yearTotal };
                }
            }

            // Use total from API if available
            if (data.total && typeof data.total === 'object') {
                for (const [year, total] of Object.entries(data.total)) {
                    if (yearsMap[year]) {
                        yearsMap[year].total = total;
                    } else {
                        yearsMap[year] = { year, total };
                    }
                }
            }

            const years = Object.values(yearsMap).sort((a, b) => b.year.localeCompare(a.year));

            return res.status(200).json({ years, contributions });
        }
    } catch (e) {
        console.error('Source 2 failed:', e.message);
    }

    return res.status(502).json({ error: 'Failed to fetch GitHub contributions from all sources' });
}
