import { requireRole } from "@/lib/auth";

export const runtime = "nodejs";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("CUSTOMER");
  return <>{children}</>;
}
