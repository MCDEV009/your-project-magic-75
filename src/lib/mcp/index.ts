import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listPublicTests from "./tools/list-public-tests";
import listMyAttempts from "./tools/list-my-attempts";
import getWalletBalance from "./tools/get-wallet-balance";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "milliy-sertifikat-mcp",
  title: "Milliy Sertifikat",
  version: "0.1.0",
  instructions:
    "Tools for Milliy Sertifikat mock-test platform. Use list_public_tests to browse published tests, list_my_attempts and get_wallet_balance to read the signed-in user's data.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listPublicTests, listMyAttempts, getWalletBalance],
});