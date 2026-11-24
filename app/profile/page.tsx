// Server side of My Profile: the user's details arrive with the page (same API as the browser).
import { serverApi } from "@/lib/serverApi";
import ProfileView, { type ProfileUser } from "./ProfileView";

export default async function ProfilePage() {
  const me = await serverApi<ProfileUser>("/api/users/me");
  return <ProfileView initial={me && typeof me === "object" && "email" in me ? me : null} />;
}
