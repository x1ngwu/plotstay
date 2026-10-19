import catalogue from './travel-copy.json';
import {bilingual} from './i18n';
export const travelCopy = catalogue as Record<string, {en:string;'zh-CN':string}>;
export function copyText(key:string, locale:string) {
  const entry=travelCopy[key];
  if(!entry) throw new Error(`Unknown approved copy: ${key}`);
  return entry[locale==='zh-CN'?'zh-CN':'en'];
}
// Explicit legacy bindings preserve component and database keys. Creative text is world scoped.
const functional:Record<string,string>={
 'Search places, titles or tags':'functional.Search names, places or tags',
 'Anywhere in this world':'functional.All destinations','Date':'functional.Travel date',
 'Return / checkout':'functional.Return / check-out date','Rooms':'functional.Number of rooms',
 'Quantity':'functional.Service quantity','Any':'functional.Not yet decided',
 'Dates and quantities are trip preferences; availability is not checked yet.':'navigation.search-note',
 'Check-in':'booking.specialized.check-in','Checkout':'booking.specialized.check-out',
 ' (expired)':'booking.specialized.session-started',
 'Edit trip':'booking.flow.edit-itinerary','Back to listing':'receipt.action.return-listing',
 'Review trip & price':'booking.review.cta','Confirm & issue document':'booking.confirm.cta',
 'Travellers':'booking.experience.travellers','Service quantity':'booking.specialized.service-quantity',
 'Choose a session':'booking.experience.session-placeholder','Choose a time':'booking.experience.session-placeholder',
 'Session · UTC':'booking.experience.session','Simulation session · UTC':'booking.experience.session','Date · UTC':'booking.experience.date',
 'Per room, per night · 1–30 nights · UTC calendar dates.':'booking.specialized.stay-pricing',
 'Per person, per session · all times UTC.':'booking.experience.pricing-note',
 'Per service · quantity does not extend the session; travellers do not add a charge · UTC.':'booking.specialized.service-pricing',
 'Enable JavaScript to review and save a fictional booking.':'booking.flow.javascript-required',
 'I understand this is a fictional trip with no real charge.':'platform.notices.confirmation',
 'No bank card, real name or contact details. Your visitor credential stays in this browser for 180 days.':'platform.notices.recovery',
 'No inventory guarantee; these trips are fictional. Start within the next 365 days.':'booking.date-range-note',
 'Price breakdown':'booking.review.breakdown','Fictional total':'booking.review.total',
 'Save document image':'receipt.action.save-image','Copy listing link':'receipt.action.copy-listing',
 'Copy my document link':'receipt.action.copy-document','Reload document':'receipt.action.reload',
 'Book another trip':'receipt.action.book-again','Continue exploring':'receipt.action.return-desk',
 'Checking your visitor credential and loading your document…':'receipt.loading',
 'Document links work only in the browser holding your original visitor cookie. Clearing it, expiry or changing devices prevents recovery by number. Save the image; use your browser’s save or share action if needed.':'receipt.link-access-note',
 'Enable JavaScript to retrieve your document with your visitor cookie.':'receipt.javascript-required',
 'This is an early test document without a complete trip snapshot.':'receipt.legacy-document',
 'This document is unavailable. Use the browser holding your original visitor cookie; a number or link cannot grant access to someone else’s record.':'receipt.access-unavailable',
 'Automatic copying failed. Copy the link below manually.':'receipt.feedback.copy-failed',
 'Your document image is ready. Check browser downloads or use your device’s save image action.':'receipt.feedback.image-ready',
 'Image download failed; your booking is still saved. Retry or take a screenshot of this document.':'receipt.feedback.download-failed',
 'The connection was interrupted. Please try again.':'booking.recovery.network',
 'Too many requests. Wait a moment and retry.':'booking.recovery.rate-limited',
 'Issuing your document…':'booking.recovery.issuing',
 ' The result is not yet confirmed. Retrying recovers the same document without creating a duplicate.':'booking.recovery.outcome-pending',
 'An unresolved request was found. Retry this booking to recover its document.':'booking.recovery.pending-found',
 'Your browser cannot save booking recovery information. Allow site storage and retry; no booking has been submitted.':'booking.recovery.storage',
 'The original visitor cookie is missing. Allow cookies and retry in the original browser. Do not retry an unresolved request with a new identity.':'booking.recovery.session-required',
 'This request is already linked to another booking. Restore the original request or return to the listing to deliberately start a new booking.':'booking.flow.request-conflict',
 'Check the dates, session, travellers and quantities.':'booking.flow.invalid-input',
 'The trip does not match the listing. Return to its detail page and start again.':'booking.flow.invalid-trip',
 'Review your trip beside or below this form. Your booking is saved only after confirmation.':'booking.flow.review-reminder',
 ' Reload this page to retry.':'booking.flow.reload-to-retry',
 'These dates are no longer valid. Start within the next 365 days; stays must be 1–30 nights.':'booking.error.invalid-dates',
};
const lathe:Record<string,string>={
 'Where to?':'navigation.search-label','Back to discovery':'directory.back',
 'Find your next story.':'directory.title','Explore experiences nearby':'home.categories.title',
 'Explore every home, experience and service':'home.directory.cta',
 'No stories match this search yet.':'navigation.no-results',
 'JOURNEY DESK':'booking.start.eyebrow','Put your next stop in the story':'booking.start.title',
 'Choose your trip, review the fictional price and collect your travel document.':'booking.start.intro',
 'Trip details':'booking.particulars.title','A new stop in your story':'receipt.title',
 'TRAVEL ARCHIVE':'receipt.eyebrow',
 'There are too many travellers for these rooms. Add rooms or reduce the number of travellers.':'booking.error.capacity-exceeded',
 'This session is unavailable or its duration has not been published. Choose an available session or browse another listing.':'booking.error.session-unavailable',
 'This listing has been withdrawn or is unavailable. No new booking was created. Please keep exploring.':'booking.error.not-bookable',
 'The listing or price has changed. No booking was created. Please review a fresh quote.':'booking.error.quote-changed',
 'Pricing for this listing is not ready. Please browse another listing.':'booking.error.price-unavailable',
};
export function travelBilingual(locale:string,worldSlug?:string) {
 const plain=bilingual(locale);
 return (zh:string,en:string)=>{
  const key=(worldSlug==='lathe-worlds'?lathe[en]:undefined)??functional[en]??(travelCopy['functional.'+en]?'functional.'+en:undefined);
  return key?copyText(key,locale):plain(zh,en);
 };
}
