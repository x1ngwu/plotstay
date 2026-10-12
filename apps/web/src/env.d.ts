/// <reference types="astro/client" />
interface Window {
  __plotstayWorkspace?: {
    request(path: string, consumer: string, init?: RequestInit): Promise<Response>;
    clear(): void;
  };
}
declare namespace App {
  interface Locals {
    locales: import('@plotstay/contracts').Locale[];
    locale?: import('@plotstay/contracts').Locale;
    localeFailure?: boolean;
    detailCopy?: Record<string,Record<string,string>>;
  }
}
