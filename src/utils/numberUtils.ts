/**
 * Converts a number into its English words representation.
 * Supports KES (Shillings & Cents), USD (Dollars & Cents), EUR (Euros & Cents), GBP (Pounds & Pence).
 */

export const numberToWords = (num: number, currency: string = "KES"): string => {
  const currencyLabels: Record<string, { major: string; minor: string }> = {
    KES: { major: "Shillings", minor: "Cents" },
    USD: { major: "Dollars", minor: "Cents" },
    EUR: { major: "Euros", minor: "Cents" },
    GBP: { major: "Pounds", minor: "Pence" },
  };

  const labels = currencyLabels[currency?.toUpperCase()] || { major: currency || "Shillings", minor: "Cents" };

  if (num === 0) return `Zero ${labels.major} Only`;

  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];

  const convertThreeDigits = (n: number): string => {
    let str = "";
    if (n >= 100) {
      str += ones[Math.floor(n / 100)] + " Hundred ";
      n %= 100;
    }
    if (n >= 10 && n <= 19) {
      str += teens[n - 10];
    } else {
      str += tens[Math.floor(n / 10)] + " ";
      str += ones[n % 10];
    }
    return str.trim();
  };

  let word = "";
  let integerPart = Math.floor(Math.abs(num));
  let decimalPart = Math.round((Math.abs(num) - integerPart) * 100);

  if (integerPart >= 1000000) {
    word += convertThreeDigits(Math.floor(integerPart / 1000000)) + " Million ";
    integerPart %= 1000000;
  }
  if (integerPart >= 1000) {
    word += convertThreeDigits(Math.floor(integerPart / 1000)) + " Thousand ";
    integerPart %= 1000;
  }
  if (integerPart > 0) {
    word += convertThreeDigits(integerPart);
  }

  word = word.trim() + " " + labels.major;

  if (decimalPart > 0) {
    word += " and " + convertThreeDigits(decimalPart) + " " + labels.minor;
  }

  return word.trim() + " Only";
};

