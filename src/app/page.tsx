"use client"
import DashboardLayout from "@/components/dashboard/dashboard-layout";
import { useAuth } from "@/context/auth-context";
import LoginForm from "@/components/auth/login-form";

export default function Home() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  return <DashboardLayout />;
}
