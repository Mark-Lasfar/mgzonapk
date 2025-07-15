import CurrencyConverter from 'currency-converter-lt';

const converter = new CurrencyConverter();

export async function convertPrice(amount: number, fromCurrency: string, toCurrency: string): Promise<number> {
  try {
    return await converter.from(fromCurrency).to(toCurrency).amount(amount).convert();
  } catch (error) {
    console.error('Currency conversion error:', error);
    throw new Error('Failed to convert currency');
  }
}