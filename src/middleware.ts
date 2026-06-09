import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();
  const { pathname } = request.nextUrl;

  if (!session && pathname !== "/login") {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (session && pathname === "/login") {
    const role = session.user?.user_metadata?.role ?? "staff";
    return NextResponse.redirect(new URL(role === "admin" ? "/admin" : "/staff", request.url));
  }
  if (session && pathname.startsWith("/admin")) {
    const role = session.user?.user_metadata?.role ?? "staff";
    if (role !== "admin") return NextResponse.redirect(new URL("/staff", request.url));
  }
  if (session && pathname === "/") {
    const role = session.user?.user_metadata?.role ?? "staff";
    return NextResponse.redirect(new URL(role === "admin" ? "/admin" : "/staff", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};