 import { Moon, Sun } from "lucide-react";
 import { useTheme } from "next-themes";
 import { Button } from "@/components/ui/button";
 import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuTrigger,
 } from "@/components/ui/dropdown-menu";
 import { useLanguage } from "@/hooks/useLanguage";
 
 export function ThemeToggle() {
   const { setTheme, theme } = useTheme();
   const { t } = useLanguage();
 
   return (
     <DropdownMenu>
       <DropdownMenuTrigger asChild>
         <Button variant="outline" size="icon" className="relative">
           <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
           <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
           <span className="sr-only">{t('toggleTheme')}</span>
         </Button>
       </DropdownMenuTrigger>
       <DropdownMenuContent align="end">
         <DropdownMenuItem onClick={() => setTheme("light")} className="gap-2">
           <Sun className="h-4 w-4" />
           {t('lightMode')}
         </DropdownMenuItem>
         <DropdownMenuItem onClick={() => setTheme("dark")} className="gap-2">
           <Moon className="h-4 w-4" />
           {t('darkMode')}
         </DropdownMenuItem>
         <DropdownMenuItem onClick={() => setTheme("system")} className="gap-2">
           <span className="h-4 w-4 flex items-center justify-center text-xs">💻</span>
           {t('systemMode')}
         </DropdownMenuItem>
       </DropdownMenuContent>
     </DropdownMenu>
   );
 }