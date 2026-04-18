import { createAuth } from "@ad-creative-baz/auth";

export async function createContext({ req }: { req: Request }) {
  const session = await createAuth().api.getSession({
    headers: req.headers,
  });
  return {
    auth: null,
    session,
    headers: req.headers,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
