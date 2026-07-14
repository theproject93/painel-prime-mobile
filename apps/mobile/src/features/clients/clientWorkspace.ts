export type PapermarkRecentView = {
  viewedAt: string | null;
  viewerEmail: string | null;
  durationSeconds: number;
};

export type PapermarkTopPage = {
  pageNumber: number;
  views: number;
  durationSeconds: number;
};

export type PapermarkInsights = {
  totalViews: number;
  totalDurationSeconds: number;
  score: number;
  lastViewedAt: string | null;
  lastViewerEmail: string | null;
  recentViews: PapermarkRecentView[];
  topPages: PapermarkTopPage[];
};

function finiteNonNegative(value: unknown) {
  const number = typeof value === 'number' ? value : Number.NaN;
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function nullableString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function normalizePapermarkInsights(raw: unknown, rawScore: unknown): PapermarkInsights {
  const row = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const recentViews = Array.isArray(row.recentViews) ? row.recentViews : [];
  const topPages = Array.isArray(row.topPages) ? row.topPages : [];
  return {
    totalViews: finiteNonNegative(row.totalViews),
    totalDurationSeconds: finiteNonNegative(row.totalDurationSeconds),
    score: Math.min(100, finiteNonNegative(rawScore)),
    lastViewedAt: nullableString(row.lastViewedAt),
    lastViewerEmail: nullableString(row.lastViewerEmail),
    recentViews: recentViews.flatMap((value) => {
      if (!value || typeof value !== 'object') return [];
      const item = value as Record<string, unknown>;
      return [{
        viewedAt: nullableString(item.viewedAt),
        viewerEmail: nullableString(item.viewerEmail),
        durationSeconds: finiteNonNegative(item.durationSeconds),
      }];
    }),
    topPages: topPages.flatMap((value) => {
      if (!value || typeof value !== 'object') return [];
      const item = value as Record<string, unknown>;
      return [{
        pageNumber: Math.max(1, Math.floor(finiteNonNegative(item.pageNumber ?? item.page) || 1)),
        views: finiteNonNegative(item.views),
        durationSeconds: finiteNonNegative(item.durationSeconds),
      }];
    }),
  };
}

export function papermarkEngagementScore(raw: unknown) {
  const row = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const totalViews = finiteNonNegative(row.totalViews);
  const uniqueViewers = finiteNonNegative(row.uniqueViewers);
  const totalDurationSeconds = finiteNonNegative(row.totalDurationSeconds);
  const lastSessionDurationSeconds = finiteNonNegative(row.lastSessionDurationSeconds);
  const topPages = Array.isArray(row.topPages) ? row.topPages.length : 0;
  return Math.min(100, totalViews * 18 + uniqueViewers * 16 + Math.floor(totalDurationSeconds / 30) * 6 + Math.floor(lastSessionDurationSeconds / 30) * 8 + topPages * 4);
}

export function safeExternalHttpUrl(value: unknown) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}
