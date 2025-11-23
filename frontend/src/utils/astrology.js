const signs = [
  { name: 'Capricorno', icon: '♑', start: [12, 22], end: [1, 19] },
  { name: 'Acquario', icon: '♒', start: [1, 20], end: [2, 18] },
  { name: 'Pesci', icon: '♓', start: [2, 19], end: [3, 20] },
  { name: 'Ariete', icon: '♈', start: [3, 21], end: [4, 19] },
  { name: 'Toro', icon: '♉', start: [4, 20], end: [5, 20] },
  { name: 'Gemelli', icon: '♊', start: [5, 21], end: [6, 20] },
  { name: 'Cancro', icon: '♋', start: [6, 21], end: [7, 22] },
  { name: 'Leone', icon: '♌', start: [7, 23], end: [8, 22] },
  { name: 'Vergine', icon: '♍', start: [8, 23], end: [9, 22] },
  { name: 'Bilancia', icon: '♎', start: [9, 23], end: [10, 22] },
  { name: 'Scorpione', icon: '♏', start: [10, 23], end: [11, 21] },
  { name: 'Sagittario', icon: '♐', start: [11, 22], end: [12, 21] }
];

const getDayOfYear = (date) => {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};

export const getZodiacSign = (birthDate) => {
  if (!birthDate) return null;
  const date = new Date(birthDate);
  if (Number.isNaN(date.getTime())) return null;

  const month = date.getMonth() + 1;
  const day = date.getDate();

  for (const sign of signs) {
    const [startMonth, startDay] = sign.start;
    const [endMonth, endDay] = sign.end;

    if (startMonth === endMonth) {
      if (month === startMonth && day >= startDay && day <= endDay) return sign;
    } else if ((month === startMonth && day >= startDay) || (month === endMonth && day <= endDay)) {
      return sign;
    }
  }
  return null;
};

export const getAscendantSign = (birthDate, birthTime, birthPlace) => {
  if (!birthDate || !birthTime || !birthPlace) return null;
  const date = new Date(`${birthDate}T${birthTime}`);
  if (Number.isNaN(date.getTime())) return null;

  // Basic approximation: use birth time adjusted by timezone offset as reported by the browser.
  // Requiring a birth place ensures the ascendant is only shown when the user provides
  // the context typically needed for a realistic calculation.
  const minutes = date.getHours() * 60 + date.getMinutes();
  const timezoneAdjustedMinutes = minutes + date.getTimezoneOffset();
  const dayOfYear = getDayOfYear(date);
  const segment = Math.floor(((timezoneAdjustedMinutes / 120) + dayOfYear) % 12);
  return signs[segment];
};

export const zodiacSigns = signs;
