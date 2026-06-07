export default async function handler(req, res) {
    // Set headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=600');

    // Parse query
    const urlParams = new URL(req.url, `http://${req.headers.host}`);
    let query = urlParams.searchParams.get('q') || '';
    query = query.trim();

    // Set a fun default query related to Tim Payne, Selección Argentina, or streamers of Argentine sports
    if (!query) {
        const DEFAULT_QUERIES = [
            "Tim Payne seleccion argentina shorts",
            "Davoo Xeneize seleccion argentina shorts",
            "La Cobra seleccion argentina shorts",
            "streamers futbol argentino shorts",
            "anecdotas seleccion argentina shorts"
        ];
        query = DEFAULT_QUERIES[Math.floor(Math.random() * DEFAULT_QUERIES.length)];
    } else {
        const queryLower = query.toLowerCase();
        const hasWorldCupKeyword = ['mundial', 'copa del mundo', 'world cup', 'worldcup', 'fifa', 'qatar', 'russia', 'brasil', 'sudafrica', '2026', '2022', '2018', '2014', '2010', 'seleccion', 'tim payne', 'davoo', 'cobra', 'futbol', 'goles'].some(k => queryLower.includes(k));
        if (!hasWorldCupKeyword) {
            query = `${query} futbol`;
        }
    }

    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

    try {
        const response = await fetch(searchUrl, {
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
        let videos = [];

        // Parse ytInitialData script block to filter out FIFA channel content
        const match = html.match(/ytInitialData\s*=\s*({.+?});/);
        if (match) {
            try {
                const data = JSON.parse(match[1]);
                
                // Recursive helper to extract all videoRenderer objects
                const findVideoRenderers = (obj) => {
                    let results = [];
                    const traverse = (current) => {
                        if (!current || typeof current !== 'object') return;
                        if (current.videoRenderer) {
                            results.push(current.videoRenderer);
                        } else {
                            for (const key in current) {
                                if (current.hasOwnProperty(key)) {
                                    traverse(current[key]);
                                }
                            }
                        }
                    };
                    traverse(obj);
                    return results;
                };

                const renderers = findVideoRenderers(data);
                for (const r of renderers) {
                    if (r && r.videoId) {
                        const title = r.title?.runs?.[0]?.text || '';
                        const channel = r.ownerText?.runs?.[0]?.text || r.shortBylineText?.runs?.[0]?.text || '';
                        videos.push({
                            id: r.videoId,
                            title: title,
                            channel: channel
                        });
                    }
                }
            } catch (e) {
                console.warn("Failed to parse ytInitialData JSON:", e);
            }
        }

        if (videos.length > 0) {
            // Filter out videos from the official FIFA channel or containing FIFA in channel/title
            const filteredVideos = videos.filter(v => {
                const channelLower = v.channel.toLowerCase();
                const titleLower = v.title.toLowerCase();
                if (channelLower.includes('fifa') || titleLower.includes('fifa official') || titleLower.includes('official fifa')) {
                    return false;
                }
                return true;
            });
            ids = filteredVideos.map(v => v.id);
        } else {
            // Fallback to regex matches on raw HTML
            const videoIdMatches = [...html.matchAll(/"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/g)];
            ids = [...new Set(videoIdMatches.map(m => m[1]))];
        }

        // Take up to 30 candidates and filter out non-embeddable ones via oEmbed
        const candidates = ids.slice(0, 30);
        const embeddable = await filterEmbeddable(candidates, 12);

        return res.status(200).json({
            success: true,
            data: embeddable
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

/**
 * Checks YouTube oEmbed to determine if a video allows embedding.
 * If oEmbed returns 200 → embeddable. If 401/403 → blocked by owner.
 * Runs checks in parallel batches to keep response time low.
 * Returns up to `maxResults` embeddable IDs.
 */
async function filterEmbeddable(ids, maxResults = 12) {
    const embeddable = [];

    // Process in parallel batches of 5
    const batchSize = 5;
    for (let i = 0; i < ids.length && embeddable.length < maxResults; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        const results = await Promise.all(
            batch.map(async (id) => {
                try {
                    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`;
                    const r = await fetch(oembedUrl, { method: 'GET' });
                    // 200 = embeddable, anything else (401, 403) = blocked
                    return r.ok ? id : null;
                } catch {
                    return null;
                }
            })
        );
        for (const id of results) {
            if (id && embeddable.length < maxResults) embeddable.push(id);
        }
    }

    return embeddable;
}
