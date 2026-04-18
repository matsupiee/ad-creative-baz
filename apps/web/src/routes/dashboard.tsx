import { Button } from "@ad-creative-baz/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@ad-creative-baz/ui/components/card";
import { Link, createFileRoute, redirect } from "@tanstack/react-router";

import { getUser } from "@/functions/get-user";

export const Route = createFileRoute("/dashboard")({
  component: RouteComponent,
  beforeLoad: async () => {
    const session = await getUser();
    return { session };
  },
  loader: async ({ context }) => {
    if (!context.session) {
      throw redirect({ to: "/login" });
    }
  },
});

function RouteComponent() {
  const { session } = Route.useRouteContext();

  return (
    <div className="container mx-auto max-w-3xl px-4 py-6">
      <Card>
        <CardHeader>
          <CardTitle>Welcome, {session?.user.name}</CardTitle>
          <p className="text-muted-foreground text-sm">{session?.user.email}</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm">
            ランキングはトップページで公開中。台本ページは次フェーズで追加予定です。
          </p>
          <Link to="/">
            <Button variant="default">View Ranking</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
