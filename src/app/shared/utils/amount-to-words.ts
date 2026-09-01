import { Lang } from '../../core/services/translation.service';
import { Currency } from '../../core/models/listing.model';

const CURRENCY_NOUNS: Record<Lang, Record<Currency, [singular: string, plural: string]>> = {
  en: {
    USD: ['dollar', 'dollars'],
    MXN: ['peso', 'pesos']
  },
  es: {
    USD: ['dólar', 'dólares'],
    MXN: ['peso', 'pesos']
  }
};

const ONES_EN = [
  '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'
];
const TENS_EN = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

const ONES_ES = [
  '', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez',
  'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte'
];
const TENS_ES = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const HUNDREDS_ES = [
  '', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos',
  'seiscientos', 'setecientos', 'ochocientos', 'novecientos'
];

function twoDigitsEn(n: number): string {
  if (n < 20) return ONES_EN[n];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return ones === 0 ? TENS_EN[tens] : `${TENS_EN[tens]}-${ONES_EN[ones]}`;
}

function threeDigitsEn(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds > 0) parts.push(`${ONES_EN[hundreds]} hundred`);
  if (rest > 0) parts.push(twoDigitsEn(rest));
  return parts.join(' ');
}

function integerToWordsEn(n: number): string {
  if (n === 0) return 'zero';

  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;

  const parts: string[] = [];
  if (millions > 0) parts.push(`${threeDigitsEn(millions)} million`);
  if (thousands > 0) parts.push(`${threeDigitsEn(thousands)} thousand`);
  if (rest > 0) parts.push(threeDigitsEn(rest));

  return parts.join(' ');
}

function twoDigitsEs(n: number): string {
  if (n <= 20) return ONES_ES[n];
  if (n < 30) return 'veinti' + ONES_ES[n - 20];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return ones === 0 ? TENS_ES[tens] : `${TENS_ES[tens]} y ${ONES_ES[ones]}`;
}

function threeDigitsEs(n: number): string {
  if (n === 100) return 'cien';
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds > 0) parts.push(HUNDREDS_ES[hundreds]);
  if (rest > 0) parts.push(twoDigitsEs(rest));
  return parts.join(' ');
}

function apocopeUno(text: string): string {
  const words = text.split(' ');
  const last = words[words.length - 1];
  if (last === 'uno') {
    words[words.length - 1] = 'un';
  } else if (last === 'veintiuno') {
    words[words.length - 1] = 'veintiún';
  }
  return words.join(' ');
}

function integerToWordsEs(n: number): string {
  if (n === 0) return 'cero';

  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;

  const parts: string[] = [];
  if (millions > 0) {
    parts.push(millions === 1 ? 'un millón' : `${apocopeUno(threeDigitsEs(millions))} millones`);
  }
  if (thousands > 0) {
    parts.push(thousands === 1 ? 'mil' : `${apocopeUno(threeDigitsEs(thousands))} mil`);
  }
  if (rest > 0) {
    parts.push(threeDigitsEs(rest));
  }

  return apocopeUno(parts.join(' '));
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function amountToWords(amount: number, lang: Lang, currency: Currency): string {
  const safeAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  const integerPart = Math.floor(safeAmount);
  const cents = Math.round((safeAmount - integerPart) * 100);
  const centsStr = cents.toString().padStart(2, '0');
  const [singular, plural] = CURRENCY_NOUNS[lang][currency];
  const noun = integerPart === 1 ? singular : plural;

  if (lang === 'es') {
    const words = integerToWordsEs(integerPart);
    return `${capitalize(words)} ${noun} con ${centsStr}/100`;
  }

  const words = integerToWordsEn(integerPart);
  return `${capitalize(words)} ${noun} and ${centsStr}/100`;
}
