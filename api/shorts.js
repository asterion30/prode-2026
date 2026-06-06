export default async function handler(req, res) {
    // Set headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=600');

    // Parse query
    const urlParams = new URL(req.url, `http://${req.headers.host}`);
    let query = urlParams.searchParams.get('q') || 'mundial 2026 shorts';
    query = query.trim();

    // Restrict query to World Cup content
    const queryLower = query.toLowerCase();
    const hasWorldCupKeyword = ['mundial', 'copa del mundo', 'copa del m', 'world cup', 'worldcup', 'fifa', 'qatar', 'russia', 'brasil', 'sudafrica', '2026', '2022', '2018', '2014', '2010'].some(k => queryLower.includes(k));
    if (!hasWorldCupKeyword) {
        query = `${query} mundial`;
    }

    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
                'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
            }
        });

        if (!response.ok) {
            throw new Error(`YouTube responded with status ${response.status}`);
        }

        const html = await response.text();
        let ids = [];

        // Try parsing ytInitialData script block
        const match = html.match(/ytInitialData\s*=\s*({.+?});/);
        if (match) {
            const jsonStr = match[1];
            const videoIdMatches = [...jsonStr.matchAll(/"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/g)];
            ids = [...new Set(videoIdMatches.map(m => m[1]))];
        } else {
            // Fallback: search for videoId in raw HTML
            const videoIdMatches = [...html.matchAll(/"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/g)];
            ids = [...new Set(videoIdMatches.map(m => m[1]))];
        }

        // Return up to 15 unique video IDs
        return res.status(200).json({
            success: true,
            data: ids.slice(0, 15)
        });
    } catch (error) {
        console.error('Error fetching YouTube shorts:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch trending shorts',
            details: error.message
        });
    }
}
