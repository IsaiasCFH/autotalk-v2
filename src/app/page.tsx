// app/page.tsx — Página raíz "/"
//
// Solo redirige. El middleware ya protege las rutas,
// pero si alguien va a "/" redirigimos al inbox.
// redirect() de Next.js es server-side (más rápido que useRouter en cliente).

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function RootPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  redirect("/inbox");
}
