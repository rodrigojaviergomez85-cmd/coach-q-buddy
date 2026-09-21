import { createContext, useContext } from "react";
import type { QueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type Role = "coordinador" | "senior" | "admin";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  active: boolean;
  created_at: string;
}

interface ProfileContextValue {
  profile: Profile;
  isAdmin: boolean;
  isSenior: boolean;
  canSeeAll: boolean;
}

export const ProfileContext = createContext<ProfileContextValue | null>(null);

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used inside the authenticated layout");
  return ctx;
}

export async function signOutCleanly(queryClient: QueryClient) {
  await queryClient.cancelQueries();
  queryClient.clear();
  await supabase.auth.signOut();
}
