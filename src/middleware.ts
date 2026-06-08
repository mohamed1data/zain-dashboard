import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  // Not logged in → redirect to login
  if (!user && pathname !== "/login") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Logged in but on login page → redirect to correct dashboard
  if (user && pathname === "/login") {
    const role = user.user_metadata?.role ?? "staff";
    return NextResponse.redirect(
      new URL(role === "admin" ? "/admin" : "/staff", request.url)
    );
  }

  // Staff trying to access admin → redirect to staff
  if (user && pathname.startsWith("/admin")) {
    const role = user.user_metadata?.role ?? "staff";
    if (role !== "admin") {
      return NextResponse.redirect(new URL("/staff", request.url));
    }
  }

  // Root → redirect based on role
  if (user && pathname === "/") {
    const role = user.user_metadata?.role ?? "staff";
    return NextResponse.redirect(
      new URL(role === "admin" ? "/admin" : "/staff", request.url)
    );
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
