import { Button } from "@ad-creative-baz/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@ad-creative-baz/ui/components/card";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";

import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";
import { getUser } from "@/functions/get-user";

// Allowlist prevents open-redirect via ?redirect=//evil.com; invalid values fall back to default
const REDIRECT_ALLOWLIST = ["/dashboard", "/"] as const;

const searchSchema = z.object({
  tab: z.enum(["signin", "signup"]).catch("signin").default("signin"),
  redirect: z.enum(REDIRECT_ALLOWLIST).catch("/dashboard").default("/dashboard"),
});

export const Route = createFileRoute("/login")({
  component: RouteComponent,
  validateSearch: searchSchema,
  beforeLoad: async ({ search }) => {
    const session = await getUser();
    if (session) {
      throw redirect({ to: search.redirect });
    }
  },
});

function RouteComponent() {
  const { tab: initialTab, redirect: redirectTo } = Route.useSearch();
  const [tab, setTab] = useState<"signin" | "signup">(initialTab);

  return (
    <div className="mx-auto mt-10 w-full max-w-md px-4">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold">ad-creative-baz</h1>
        <p className="text-muted-foreground text-sm">TikTok の人気広告と台本をランキングで追う</p>
      </div>

      <Card>
        <CardHeader>
          <div className="grid grid-cols-2 gap-2" role="tablist">
            <Button
              variant={tab === "signin" ? "default" : "outline"}
              onClick={() => setTab("signin")}
              role="tab"
              aria-selected={tab === "signin"}
            >
              Sign In
            </Button>
            <Button
              variant={tab === "signup" ? "default" : "outline"}
              onClick={() => setTab("signup")}
              role="tab"
              aria-selected={tab === "signup"}
            >
              Sign Up
            </Button>
          </div>
          <CardTitle className="sr-only">{tab === "signin" ? "Sign in" : "Sign up"}</CardTitle>
        </CardHeader>
        <CardContent>
          {tab === "signin" ? (
            <SignInForm redirectTo={redirectTo} />
          ) : (
            <SignUpForm redirectTo={redirectTo} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
