/// <reference types="astro/client" />
declare namespace App {
  interface Locals {
    locales: import('@plotstay/contracts').Locale[];
    locale?: import('@plotstay/contracts').Locale;
    localeFailure?: boolean;
    detailCopy?: Record<string,Record<string,string>>;
  }
}
