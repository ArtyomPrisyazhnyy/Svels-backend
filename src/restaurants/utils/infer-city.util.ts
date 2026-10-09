/** Достаёт город из свободной строки адреса (г. Минск, Минск, …). */
export function inferCityFromAddress(address: string): string {
  const trimmed = address.trim();
  const named = trimmed.match(
    /(?:г(?:ород)?\.?\s+)([А-ЯЁA-Z][А-Яа-яЁёA-Za-z-]+)/,
  );
  if (named?.[1]) {
    return named[1];
  }

  const firstPart = trimmed.split(',')[0]?.trim() ?? '';
  if (firstPart.length >= 2 && firstPart.length <= 40) {
    return firstPart.replace(/^г(?:ород)?\.?\s+/i, '');
  }

  return 'Город не указан';
}

export function formatLocationLine(city: string, address: string): string {
  const cityNorm = city.trim();
  const addressNorm = address.trim();
  if (!cityNorm) {
    return addressNorm;
  }
  if (addressNorm.toLowerCase().includes(cityNorm.toLowerCase())) {
    return addressNorm;
  }
  return `${cityNorm}, ${addressNorm}`;
}
