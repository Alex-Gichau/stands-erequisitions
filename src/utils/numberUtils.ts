/**
 * Converts a number into its English words representation.
 * Specifically tailored for Shillings and Cents.
 */

export const numberToWords = (num: number): string => {
  if (num === 0) return "Zero Shillings Only";

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

  word = word.trim() + " Shillings";

  if (decimalPart > 0) {
    word += " and " + convertThreeDigits(decimalPart) + " Cents";
  }

  return word.trim() + " Only";
};
