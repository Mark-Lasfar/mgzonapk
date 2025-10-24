"use client";

import React from "react";
import { SessionProvider, useSession } from "next-auth/react";
import useCartSidebar from "@/hooks/use-cart-sidebar";
import CartSidebar from "./cart-sidebar";
import { ThemeProvider } from "./theme-provider";
import { Toaster } from "../ui/toaster";
import AppInitializer from "./app-initializer";
import { ClientSetting } from "@/types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApolloProvider } from "@apollo/client/react";
import { createApolloClient } from "@/lib/apollo-client"; 

// Create a single QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 2,
      refetchOnWindowFocus: false,
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
      <ApolloWrapper>
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
      </ApolloWrapper>
    </SessionProvider>
  );
}

// ✅ Wrapper لإضافة ApolloClient حسب التوكن
function ApolloWrapper({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const token = session?.user?.token;
  const client = React.useMemo(() => createApolloClient(token), [token]);

  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}
