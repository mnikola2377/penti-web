const nf = (digits: number) =>
  new Intl.NumberFormat("cs-CZ", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

export function czNum(value: number, digits = 1): string {
  return nf(digits).format(value);
}

export function czMeters(value: number | null | undefined, digits = 2): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${czNum(value, digits)} m`;
}

export function isoWithOffset(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  const local = shifted.toISOString().slice(0, 19);
  return `${local}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}
