// Server side of Admin → Users: users and productions arrive with the page (same API and checks
// as the browser, so non-admins get nothing here just as they would from the API).
import { serverApi } from "@/lib/serverApi";
import UsersView, { type User, type Production } from "./UsersView";

export default async function AdminUsersPage() {
  const [users, productions] = await Promise.all([serverApi<User[]>("/api/users"), serverApi<Production[]>("/api/productions")]);
  return <UsersView initial={Array.isArray(users) && Array.isArray(productions) ? { users, productions } : null} />;
}
