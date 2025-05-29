"use client";

import React from "react";
import { SessionProvider } from "next-auth/react";
import useCartSidebar from "@/hooks/use-cart-sidebar";
import CartSidebar from "./cart-sidebar";
import { ThemeProvider } from "./theme-provider";
import { Toaster } from "../ui/toaster";
import AppInitializer from "./app-initializer";
import { ClientSetting } from "@/types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Create a single QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // Cache queries for 5 minutes
      retry: 2, // Retry failed queries twice
      refetchOnWindowFocus: false, // Avoid refetching on window focus
    },
  },
});

export default function ClientProviders({
  setting,
  children,
}: {
  setting: ClientSetting;
  children: React.ReactNode;
}) {
  const visible = useCartSidebar();

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <AppInitializer setting={setting}>
          <ThemeProvider
            attribute="class"
            defaultTheme={setting.common.defaultTheme.toLocaleLowerCase()}
          >
            {visible ? (
              <div className="flex min-h-screen">
                <div className="flex-1 overflow-hidden">{children}</div>
                <CartSidebar />
              </div>
            ) : (
              <div>{children}</div>
            )}
            <Toaster />
          </ThemeProvider>
        </AppInitializer>
      </QueryClientProvider>
    </SessionProvider>
  );
}