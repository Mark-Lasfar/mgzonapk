
import { auth } from "@/auth"; 
export async function getCurrentUser() {
  const session = await auth();
  return session?.user || null;
}

export async function getCurrentUserWithTimestamp() {
  const user = await getCurrentUser();
  return {
    user: user?.name || "unknown",
    timestamp: new Date().toISOString(),
  };
}
