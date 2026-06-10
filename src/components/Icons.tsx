import { teamColor } from '../theme';
import type { DriverInfo, TeamInfo } from '../types';

/**
 * Generated driver avatar: a stylized helmet silhouette in team color with
 * the driver's 3-letter code. No real likenesses or copyrighted assets.
 */
export function DriverAvatar({
  driver,
  teamId,
  size = 34,
}: {
  driver: DriverInfo;
  teamId: string;
  size?: number;
}) {
  const color = teamColor(teamId);
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" role="img" aria-label={driver.lastName}>
      <circle cx="20" cy="20" r="19" fill="#26263A" stroke={color} strokeWidth="2" />
      {/* helmet silhouette */}
      <path
        d="M10 24 a10 10 0 0 1 20 0 v3 a2 2 0 0 1 -2 2 h-16 a2 2 0 0 1 -2 -2 z"
        fill={color}
        opacity="0.9"
      />
      {/* visor */}
      <rect x="13" y="19" width="11" height="4.5" rx="2.2" fill="#15151E" opacity="0.85" />
      <text
        x="20"
        y="13.5"
        textAnchor="middle"
        fontSize="8.5"
        fontWeight="700"
        fill="#fff"
        fontFamily="inherit"
      >
        {driver.code}
      </text>
    </svg>
  );
}

/** Generated team icon: angled speed-block with the team's initials. */
export function TeamIcon({ team, size = 16 }: { team: TeamInfo; size?: number }) {
  const color = teamColor(team.id);
  const initials = team.name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" role="img" aria-label={team.name}>
      <path d="M5 2 h13 l-3 16 h-13 z" fill={color} opacity="0.25" />
      <path d="M5 2 h13 l-3 16 h-13 z" fill="none" stroke={color} strokeWidth="1.5" />
      <text
        x="10"
        y="14"
        textAnchor="middle"
        fontSize="8"
        fontWeight="700"
        fill={color}
        fontFamily="inherit"
      >
        {initials}
      </text>
    </svg>
  );
}
