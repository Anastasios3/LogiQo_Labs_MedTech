import { redirect } from "next/navigation";

// Auth0 handles the actual login flow via the route handler.
// This page redirects directly to the Auth0 universal login.
export default function LoginPage() {
  redirect("/api/auth/login");
}
