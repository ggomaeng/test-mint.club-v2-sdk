import { formatUnits, parseUnits } from 'viem';

export function commify(x?: number | string | null) {
  if (x === null || x === undefined) return '';
  else if (x === 0) return '0';

  const parts = x.toString().split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
}

export function uncommify(str?: string | number | null) {
  if (!str) return '';
  if (typeof str === 'number') return str.toString().replace(/,/g, '');
  return str.replace(/,/g, '');
}

export function handleScientificNotation(num?: number | string | null) {
  if (num === undefined || num === null) return '';

  const str = num?.toString();
  if (str?.includes('e')) {
    const [coefficient, exponent] = str.split('e');
    const decimalCount = countDecimals(Number(coefficient));
    const exponentValue = parseInt(exponent, 10);
    if (exponentValue >= 0) {
      const result = Number(num).toLocaleString();
      return result;
    } else {
      const result = Number(num).toFixed(Math.abs(exponentValue) + decimalCount);
      return result;
    }
  }
  return str;
}

export function countLeadingZeros(num?: number | string) {
  const stringValue = handleScientificNotation(num?.toString());
  if (!stringValue || !stringValue?.includes('.')) return 0;
  const [, decimalPart] = stringValue.split('.');
  // Count the leading zeros in the decimal part
  const leadingZeros = decimalPart ? decimalPart.match(/^0*/)?.[0]?.length : 0;
  return leadingZeros;
}

export function getValueAfterLeadingZeros(num?: number) {
  const numStr = handleScientificNotation(num?.toString());

  if (!numStr) return;

  const matches = /\.0*([1-9]\d*)$/.exec(numStr);
  if (matches && matches[1]) {
    return parseInt(matches[1], 10);
  }
  return num;
}

export function countDecimals(value: number | string) {
  const numStr = handleScientificNotation(value?.toString());
  return numStr?.split('.')?.[1]?.length || 0;
}

export function toFixed(value: number, t: number) {
  return Number(Number(value).toFixed(t));
}

export function wei(num: number | string, decimals = 18) {
  const stringified = handleScientificNotation(num.toString());
  return parseUnits(stringified, decimals);
}

export function toNumber(num: bigint | undefined, decimals: number | undefined) {
  if (!num || decimals === undefined) return 0;
  return Number(formatUnits(num, decimals));
}

export function shortenNumber(num: number | string, prefix = '') {
  num = Number(num?.toString().replaceAll(',', ''));

  if (num >= 1_000_000_000_000) {
    return `${prefix}${toFixed(num / 1_000_000_000_000, 2)}T`;
  } else if (num >= 1_000_000_000) {
    return `${prefix}${toFixed(num / 1_000_000_000, 2)}B`;
  } else if (num >= 1_000_000) {
    return `${prefix}${toFixed(num / 1_000_000, 2)}M`;
  } else if (num >= 1_000) {
    return `${prefix}${toFixed(num / 1_000, 2)}K`;
  } else if (num === 0) {
    return `${prefix}0`;
  } else if (num <= 0.000001) {
    return `< ${prefix}0.000001`;
  }
  return (
    prefix +
    num.toLocaleString('en-US', {
      maximumFractionDigits: 6,
    })
  );
}

export function applyDecimals(num?: string | number | null) {
  if (!num) return '0';
  const toNum = Number(num);

  let decimalPlaces;

  if (toNum >= 100_000) {
    decimalPlaces = 0;
  } else if (toNum >= 1_000) {
    decimalPlaces = 2;
  } else if (toNum >= 10) {
    decimalPlaces = 3;
  } else if (toNum >= 1) {
    decimalPlaces = 4;
  } else if (toNum >= 0.1) {
    decimalPlaces = 5;
  } else if (toNum >= 0.01) {
    decimalPlaces = 6;
  }

  if (decimalPlaces === undefined) {
    return handleScientificNotation(toNum.toString());
  }

  return handleScientificNotation(
    toNum.toLocaleString('en-US', {
      maximumFractionDigits: decimalPlaces,
    }),
  );
}

export function precisionRound(number: number, precision: number) {
  const factor = Math.pow(10, precision);
  return Math.round(number * factor) / factor;
}
