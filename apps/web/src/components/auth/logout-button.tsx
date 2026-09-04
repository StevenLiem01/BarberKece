"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/v1/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });

      if (response.ok) {
        router.push("/sign-in");
        router.refresh(); // Ensure server components re-evaluate session state
      } else {
        console.error("Logout failed:", await response.text());
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Unexpected error during logout:", error);
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={isLoading}
      className="px-4 py-2 bg-neutral-900 text-white rounded hover:bg-neutral-800 disabled:opacity-50 transition-colors"
    >
      {isLoading ? "Logging out..." : "Log out"}
    </button>
  );
}
