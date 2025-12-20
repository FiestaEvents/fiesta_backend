export const formatCurrency = (amount, currency = 'TND', showSymbol = true) => {
  const number = Number(amount);
  
  if (isNaN(number)) {
    return '0.00';
  }
  
  // Format for Tunisian style: 2.600,00
  const formattedNumber = number.toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  
  // Add currency symbol if requested
  if (showSymbol && currency) {
    const symbols = {
      'TND': 'DT',
      'USD': '$',
      'EUR': '€',
      'GBP': '£'
    };
    
    const symbol = symbols[currency] || currency;
    return `${formattedNumber} ${symbol}`;
  }
  
  return formattedNumber;
};