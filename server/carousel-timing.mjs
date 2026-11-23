// Shared by CMS validation, settings and the public carousel.
export const CAROUSEL_DEFAULT_MS=3000;
export const CAROUSEL_MIN_MS=2000;
export const CAROUSEL_MAX_MS=60000;
export function carouselIntervalMs(value){return Number.isInteger(value)&&value>=CAROUSEL_MIN_MS&&value<=CAROUSEL_MAX_MS?value:CAROUSEL_DEFAULT_MS;}
