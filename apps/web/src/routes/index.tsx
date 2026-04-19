import {
  AD_LIST_PERIODS,
  AD_LIST_REGIONS,
  type AdListPeriod,
  type AdListRegion,
  adListPeriodSchema,
  adListRegionSchema,
} from "@ad-creative-baz/api/routers/ads";
import { buttonVariants } from "@ad-creative-baz/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@ad-creative-baz/ui/components/card";
import { Skeleton } from "@ad-creative-baz/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { orpc } from "@/utils/orpc";

const DEFAULT_REGION: AdListRegion = "US";
const DEFAULT_PERIOD: AdListPeriod = 7;

const searchSchema = z.object({
  region: adListRegionSchema.catch(DEFAULT_REGION).default(DEFAULT_REGION),
  period: adListPeriodSchema.catch(DEFAULT_PERIOD).default(DEFAULT_PERIOD),
});

export const Route = createFileRoute("/")({
  component: HomeComponent,
  validateSearch: searchSchema,
});

function formatCount(value: number | null | undefined) {
  if (value == null) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toString();
}

function HomeComponent() {
  const { region, period } = Route.useSearch();

  const ads = useQuery(
    orpc.ads.list.queryOptions({
      input: { region, period, orderBy: "for_you", limit: 20 },
    }),
  );

  return (
    <div className="container mx-auto max-w-5xl px-4 py-6">
      <header className="mb-6 space-y-3">
        <div>
          <h1 className="text-2xl font-semibold">TikTok Top Ads Ranking</h1>
          <p className="text-muted-foreground text-sm">
            Region: {region} / Period: {period}d / Sort: likes × freshness (half-life 7d)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {AD_LIST_REGIONS.map((r) => (
            <Link
              key={r}
              to="/"
              search={(prev: z.infer<typeof searchSchema>) => ({ ...prev, region: r })}
              className={buttonVariants({
                size: "sm",
                variant: r === region ? "default" : "outline",
              })}
            >
              {r}
            </Link>
          ))}
          <span className="mx-1 h-5 border-l" aria-hidden />
          {AD_LIST_PERIODS.map((p) => (
            <Link
              key={p}
              to="/"
              search={(prev: z.infer<typeof searchSchema>) => ({ ...prev, period: p })}
              className={buttonVariants({
                size: "sm",
                variant: p === period ? "default" : "outline",
              })}
            >
              {p}d
            </Link>
          ))}
        </div>
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
          {ads.data.map((ad, idx) => (
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
                    #{idx + 1} {ad.title ?? "(untitled)"}
                  </CardTitle>
                  <div className="text-muted-foreground text-xs">
                    {ad.brand ?? "—"}
                    {ad.industry ? ` · ${ad.industry}` : ""}
                  </div>
                </CardHeader>
                <CardContent className="flex gap-4 text-xs">
                  <span>♥ {formatCount(ad.likes)}</span>
                  <span>▶ {formatCount(ad.playCount)}</span>
                  {ad.rank != null ? (
                    <span className="text-muted-foreground">TikTok #{ad.rank}</span>
                  ) : null}
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
