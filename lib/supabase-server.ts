import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookieParaGravar = { name: string; value: string; options: CookieOptions };

export function criarClienteServidor() {
  const jar = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (lista: CookieParaGravar[]) => {
          try {
            lista.forEach(({ name, value, options }) => jar.set(name, value, options));
          } catch {
            // Chamado de um Server Component: o middleware cuida da renovação.
          }
        },
      },
    }
  );
}
