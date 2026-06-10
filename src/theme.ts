/**
 * Color scheme consistent with the f1.com / F1 TV look:
 * dark navy background, F1 red accent, official-style team colors.
 * No copyrighted assets are used — icons are generated SVGs.
 */

export const UI = {
  bg: '#15151E',
  panel: '#1F1F2B',
  panelBorder: '#2E2E3E',
  red: '#E10600',
  text: '#FFFFFF',
  textDim: '#9B9BAB',
  grid: '#2A2A38',
};

/** Team colors by Ergast constructorId (current era values, f1.com-style). */
const TEAM_COLORS: Record<string, string> = {
  mclaren: '#FF8000',
  ferrari: '#E80020',
  red_bull: '#3671C6',
  mercedes: '#27F4D2',
  aston_martin: '#229971',
  alpine: '#00A1E8',
  williams: '#64C4FF',
  rb: '#6692FF',
  sauber: '#52E252',
  haas: '#B6BABD',
  // recent historical teams
  alphatauri: '#5E8FAA',
  alfa: '#C92D4B',
  racing_point: '#F596C8',
  force_india: '#F596C8',
  renault: '#FFF500',
  toro_rosso: '#469BFF',
  lotus_f1: '#B8A036',
  caterham: '#048646',
  marussia: '#6E0000',
  manor: '#323232',
  hrt: '#A38964',
  virgin: '#C8102E',
  // 2026 entries
  audi: '#00E701',
  cadillac: '#B79A5F',
  // motorcycle constructors
  ducati: '#CC0000',
  ktm: '#FF6600',
  yamaha: '#0046BE',
  aprilia: '#440099',
  suzuki: '#1C5BA6',
  kalex: '#C7B26B',
  boscoscuro: '#1E9E4F',
  cfmoto: '#00A4E4',
  husqvarna: '#273A60',
  gasgas: '#CB0D25',
  mv_agusta: '#D72638',
  gilera: '#7A1F1F',
  derbi: '#111111',
  // classic teams
  lotus: '#0B5B3C',
  brabham: '#00665E',
  tyrrell: '#001489',
  brm: '#6B8E23',
  cooper: '#003E29',
  matra: '#1E50C8',
  vanwall: '#004225',
  maserati: '#C42E38',
  benetton: '#00A550',
  jordan: '#F9C909',
  minardi: '#FFD500',
  arrows: '#FF8200',
  jaguar: '#0A5C2F',
  bar: '#D5D5D5',
  stewart: '#FFFFFF',
  prost: '#03033F',
  ligier: '#1466C8',
  brawn: '#CDFB0A',
  toyota: '#EB0A1E',
  honda: '#DF051C',
  bmw_sauber: '#0066B2',
  super_aguri: '#E60012',
};

const FALLBACK_PALETTE = [
  '#E10600', '#00A1E8', '#FF8000', '#27F4D2', '#52E252', '#6692FF',
  '#F596C8', '#FFF500', '#B6BABD', '#229971', '#64C4FF', '#C92D4B',
];

export function teamColor(teamId: string): string {
  const color = TEAM_COLORS[teamId];
  if (color) return color;
  let hash = 0;
  for (let i = 0; i < teamId.length; i++) hash = (hash * 31 + teamId.charCodeAt(i)) | 0;
  return FALLBACK_PALETTE[Math.abs(hash) % FALLBACK_PALETTE.length];
}

/**
 * Drivers of the same team share a color; the 2nd (and further) car gets a
 * dash pattern so lines stay distinguishable, like official F1 graphics.
 */
export function dashFor(indexInTeam: number): string | undefined {
  if (indexInTeam === 0) return undefined;
  if (indexInTeam === 1) return '7 4';
  return '2 4';
}
