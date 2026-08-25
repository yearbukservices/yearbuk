import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import LoadingSplash from "@/components/LoadingSplash";

interface RootRedirectProps {
  children?: React.ReactNode;
}

export function RootRedirect({ children }: RootRedirectProps) {
  const [, setLocation] = useLocation();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/home");
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) {
    return <LoadingSplash />;
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}

interface GuestOnlyRouteProps {
  children: React.ReactNode;
}

export function GuestOnlyRoute({ children }: GuestOnlyRouteProps) {
  const [, setLocation] = useLocation();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user) {
      setLocation("/");
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) {
    return <LoadingSplash />;
  }

  if (user) {
    return null;
  }

  return <>{children}</>;
}
