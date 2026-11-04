// app/page.tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/permissions";

/** The app has no landing page: visitors see the public guide, and members their documents. */
export default async function HomePage() {
  const user = await getCurrentUser();
  redirect(user ? "/docs" : "/p/guide");
}
