type AnalyticsDayRow = [day: string, views: number];

function formatPacificDate(date: Date): string {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Los_Angeles",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
}

function addCalendarDays(date: string, days: number): string {
    const value = new Date(`${date}T00:00:00Z`);
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
}

/**
 * Validates a video exists and fetches its publish date using Data API.
 */
export async function getYouTubeVideoMetadata(videoId: string, apiKey: string) {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoId}&key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch video metadata");
    const data = await res.json();
    if (!data.items || data.items.length === 0) return null;
    return {
        id: videoId,
        title: data.items[0].snippet.title,
        publishedAt: new Date(data.items[0].snippet.publishedAt),
        channelId: data.items[0].snippet.channelId,
        views: parseInt(data.items[0].statistics.viewCount || "0", 10)
    };
}

/**
 * Fetches historical views for a specific video using the Analytics API.
 * Returns views at Day 1, Day 7, Day 30 if available.
 *
 * Note: YouTube Analytics API returns calendar day data in PT.
 */
export async function getHistoricalVideoViews(videoId: string, publishedAt: Date, accessToken: string) {
    // Determine the date range
    // Start date: the calendar day it was published
    // End date: up to 30 days after publish (or today, whichever is earlier)
    const startDate = formatPacificDate(publishedAt);

    const endDateObj = new Date(`${addCalendarDays(startDate, 29)}T23:59:59Z`);
    const today = new Date();
    const finalEndDate = endDateObj < today ? endDateObj : today;
    const endDate = formatPacificDate(finalEndDate);

    const url = `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate=${startDate}&endDate=${endDate}&metrics=views&dimensions=day&filters=video==${videoId}`;

    const res = await fetch(url, {
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Analytics API error: ${res.status} ${text}`);
    }

    const data = await res.json() as { rows?: AnalyticsDayRow[] };
    const rows = [...(data.rows ?? [])].sort((a, b) => a[0].localeCompare(b[0]));

    const cumulativeThroughDay = (calendarDays: number): number => {
        const cutoff = addCalendarDays(startDate, calendarDays - 1);
        return rows
            .filter(([day]) => day >= startDate && day <= cutoff)
            .reduce((sum, [, views]) => sum + Number(views || 0), 0);
    };

    const currentPacificDate = formatPacificDate(today);
    const completeCalendarDays = Math.max(0, Math.floor(
        (new Date(`${currentPacificDate}T00:00:00Z`).getTime() - new Date(`${startDate}T00:00:00Z`).getTime()) /
        (24 * 60 * 60 * 1000)
    ));

    // These are calendar-day windows in YouTube Analytics' Pacific Time reporting zone.
    return {
        day1: completeCalendarDays >= 1 ? cumulativeThroughDay(1) : null,
        day7: completeCalendarDays >= 7 ? cumulativeThroughDay(7) : null,
        day30: completeCalendarDays >= 30 ? cumulativeThroughDay(30) : null,
    };
}
