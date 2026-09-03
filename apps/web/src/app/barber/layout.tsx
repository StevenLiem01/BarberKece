import { requireRole } from "@/lib/auth";

export const runtime = "nodejs";

export default async function BarberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("BARBER");
  return <>{children}</>;
}
