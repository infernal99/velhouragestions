import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/env";

const PUBLIC_PATHS = ["/login", "/recuperar", "/auth", "/invitacion", "/configuracion-pendiente"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isSupabaseConfigured) {
    if (pathname === "/configuracion-pendiente") return NextResponse.next();
    return NextResponse.redirect(new URL("/configuracion-pendiente", request.url));
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Optimistic check only (refreshes the session cookie). Real authorization
  // happens in every page/action via requireContext() and in RLS.
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub ?? null;

  if (!userId && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }

  if (userId && (pathname === "/login")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}
