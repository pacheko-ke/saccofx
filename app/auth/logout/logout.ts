


  import { useRouter } from "next/navigation"; 
  import { useState } from "react";

// logout out user
 export function useLogout() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/auth/login");
      router.refresh(); // clears any cached client state tied to the session
    } catch (err) {
      console.error("Logout failed:", err);
    } finally {
      setLoading(false);
    }
  }
 
  return { logout, loading };
}