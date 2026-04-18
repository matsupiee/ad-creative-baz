import { Card, CardContent, CardHeader, CardTitle } from "@ad-creative-baz/ui/components/card";
import { Skeleton } from "@ad-creative-baz/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

const REGION = "US" as const;
const PERIOD = 30 as const;
const ORDER_BY = "for_you" as const;

function formatCount(value: number | null | undefined) {
  if (value == null) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toString();
}

function HomeComponent() {
  const ads = useQuery(
    orpc.ads.list.queryOptions({
      input: { region: REGION, period: PERIOD, orderBy: ORDER_BY, limit: 20 },
    }),
  );

  return (
    <div className="container mx-auto max-w-5xl px-4 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">TikTok Top Ads Ranking</h1>
        <p className="text-muted-foreground text-sm">
          Region: {REGION} / Period: {PERIOD}d / Sort: {ORDER_BY}
        </p>
      </header>

      {ads.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={`ad-skeleton-${i}`} className="h-64 w-full" />
          ))}
        </div>
      ) : ads.isError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm">
          Failed to load ads: {ads.error.message}
        </div>
      ) : ads.data && ads.data.length > 0 ? (
        <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ads.data.map((ad) => (
            <li key={ad.id}>
              <Card>
                {ad.videoUrl ? (
                  <video
                    src={ad.videoUrl}
                    poster={ad.coverUrl ?? undefined}
                    controls
                    playsInline
                    preload="metadata"
                    className="aspect-[9/16] w-full bg-black object-cover"
                  />
                ) : ad.coverUrl ? (
                  <img
                    src={ad.coverUrl}
                    alt={ad.title ?? "Ad cover"}
                    className="aspect-[9/16] w-full object-cover"
                  />
                ) : (
                  <div className="bg-muted flex aspect-[9/16] w-full items-center justify-center text-muted-foreground text-xs">
                    no preview
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="line-clamp-2">
                    {ad.rank != null ? `#${ad.rank} ` : ""}
                    {ad.title ?? "(untitled)"}
                  </CardTitle>
                  <div className="text-muted-foreground text-xs">
                    {ad.brand ?? "—"}
                    {ad.industry ? ` · ${ad.industry}` : ""}
                  </div>
                </CardHeader>
                <CardContent className="flex gap-4 text-xs">
                  <span>♥ {formatCount(ad.likes)}</span>
                  <span>▶ {formatCount(ad.playCount)}</span>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      ) : (
        <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
          No ads in DB yet. Run the scraper to populate.
        </div>
      )}
    </div>
  );
}
