import { LogoutButton } from "@/components/auth/logout-button";

export default function AccountPage() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">Account</h1>
      <LogoutButton />
    </main>
  );
}
