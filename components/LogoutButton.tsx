"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SecondaryButton } from "./ui/button";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST"
      });
    } catch {
      // ignore
    } finally {
      setLoading(false);
      router.push("/login");
    }
  }

  return (
    <SecondaryButton onClick={handleLogout} disabled={loading}>
      {loading ? "正在退出..." : "退出登录"}
    </SecondaryButton>
  );
}

