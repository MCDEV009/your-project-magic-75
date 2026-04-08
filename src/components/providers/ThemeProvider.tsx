 import { ThemeProvider as NextThemesProvider } from "next-themes";
 import type { ReactNode } from "react";
 
 interface ThemeProviderProps {
   children: ReactNode;
   defaultTheme?: string;
   storageKey?: string;
 }
 
 export function ThemeProvider({ children, defaultTheme = "system", storageKey = "milliy-theme" }: ThemeProviderProps) {
   return (
     <NextThemesProvider
       attribute="class"
       defaultTheme={defaultTheme}
       storageKey={storageKey}
       enableSystem
       disableTransitionOnChange={false}
     >
       {children}
     </NextThemesProvider>
   );
 }