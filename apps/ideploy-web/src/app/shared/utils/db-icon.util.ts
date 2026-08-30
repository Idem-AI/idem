import { DatabaseType } from '../models/ideploy.models';

/**
 * Brand icon (inline SVG, ported from the legacy engine picker's own markup
 * so the shapes stay accurate) plus a short, real description for each
 * supported database engine — used by the "new database" card grid.
 */
export interface DbEngine {
  type: DatabaseType;
  name: string;
  description: string;
  color: string;
  /** Raw SVG markup — trusted (hand-authored below, never user input), bound via [innerHTML]. */
  svg: string;
}

export const DB_ENGINES: DbEngine[] = [
  {
    type: 'postgresql',
    name: 'PostgreSQL',
    description: 'Open-source object-relational database, built for reliability and complex queries.',
    color: '#336791',
    svg: `<svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg"><path fill="#336791" d="M93.809 92.112c.785-6.533.55-7.492 5.416-6.433l1.235.109c3.742.17 8.637-.602 11.513-1.938 6.191-2.873 9.861-7.668 3.758-6.409-13.924 2.873-14.892-1.842-14.892-1.842 14.75-21.899 20.937-49.678 15.627-56.51C101.305 3.16 78.201 11.91 77.798 12.127l-.135.026c-2.751-.573-5.833-.913-9.291-.968-6.301-.104-11.082 1.652-14.714 4.402 0 0-44.726-18.41-42.636 23.17.442 8.851 12.69 66.98 27.31 49.417 5.334-6.415 10.489-11.837 10.489-11.837 2.559 1.701 5.622 2.567 8.834 2.255l.249-.212c-.078.796-.044 1.575.1 2.498-3.758 4.203-2.656 4.944-10.172 6.492-7.604 1.566-3.136 4.358-.221 5.089 3.538.884 11.712 2.139 17.252-5.604l-.219.882c1.478 1.179 1.375 8.484 1.583 13.703.209 5.219.558 10.086 1.622 12.955 1.064 2.867 2.317 10.261 12.201 8.14 8.253-1.773 14.574-4.319 15.147-28.001"/><path fill="#fff" d="M75.557 125.9c-8.672 0-14.375-3.39-17.83-6.632-2.612-2.464-3.641-5.631-4.262-7.527l-.267-.792c-1.244-3.363-1.667-8.2-1.916-14.428a245.35 245.35 0 01-.093-2.923c-.021-.747-.047-1.683-.084-2.665a18.777 18.777 0 01-4.964 1.569c-3.078.527-6.392.356-9.844-.508-2.435-.609-4.967-1.872-6.407-3.819-4.205 3.685-8.215 3.183-10.398 2.455-3.859-1.286-7.309-4.897-10.543-11.046-2.311-4.377-4.546-10.083-6.64-16.953-3.655-11.966-5.973-24.574-6.175-28.702-.648-12.956 2.837-22.222 10.357-27.554 11.871-8.387 29.851-3.456 36.41-1.219 4.404-2.655 9.589-3.949 15.444-3.856 3.144.051 6.138.328 8.927.823 2.9-.912 8.632-2.222 15.19-2.143 12.087.144 22.11 4.858 28.975 13.629 4.898 6.255 2.474 19.391.596 26.685-2.644 10.234-7.278 21.119-12.96 30.598 1.545.011 3.785-.175 6.967-.832 6.284-1.298 8.119 2.073 8.613 3.578 1.997 6.047-6.68 10.625-9.387 11.877-3.469 1.61-9.121 2.593-13.755 2.378l-.201-.013-1.218-.107-.12 1.014-.115.87-.092.697c-.127 1.087-.156 2.134-.185 3.263l-.022.778c-.095 3.849-.186 7.514-1.025 12.073-1.196 6.557-4.327 11.162-9.567 14.079-3.303 1.832-7.09 2.81-10.935 2.81z" opacity="0"/></svg>`,
  },
  {
    type: 'mysql',
    name: 'MySQL',
    description: 'The world’s most widely deployed open-source relational database.',
    color: '#00758f',
    svg: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#00758F" d="M12 3C7.06 3 3 5.24 3 8s4.06 5 9 5 9-2.24 9-5-4.06-5-9-5zm0 10c-4.94 0-9-1.79-9-4v3c0 2.21 4.06 4 9 4s9-1.79 9-4v-3c0 2.21-4.06 4-9 4zm0 5c-4.94 0-9-1.79-9-4v3c0 2.21 4.06 4 9 4s9-1.79 9-4v-3c0 2.21-4.06 4-9 4z"/></svg>`,
  },
  {
    type: 'mariadb',
    name: 'MariaDB',
    description: 'Community-developed MySQL fork, drop-in compatible with extra storage engines.',
    color: '#c0765a',
    svg: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#C0765A" d="M22.844 2.012c-.615-.025-1.277.12-1.764.608l-.088.1c-.57.62-1.094 1.005-1.78 1.38-.7.38-1.592.685-2.88.93-5.113.975-7.405 5.273-9.534 9.398L7.054 14c-1.148-.584-2.174-.666-3.09-.514-.913.152-1.72.535-2.42.924l-.394.228.416.194c1.048.49 1.787 1.062 2.246 1.598a4.3 4.3 0 01.555.873c-.264.45-.527.9-.752 1.353-.505 1.033-.793 2.086-.387 3.18l.047.123.127.036c2.416.656 3.816-.13 5.296-.986 1.02-.586 2.084-1.196 3.467-1.537a11.85 11.85 0 013.656-.284c.886.052 1.83.185 2.775.394.478.106.852.254 1.16.438.308.184.547.405.703.662.306.51.322 1.13.098 1.925l-.107.388.39-.102c3.29-.855 5.798-3.338 5.8-10.768l.002-1.068c0-4.43-.023-6.44-1.018-8.246-.453-.822-1.025-1.29-1.64-1.314z"/></svg>`,
  },
  {
    type: 'mongodb',
    name: 'MongoDB',
    description: 'Document-oriented NoSQL database, storing data as flexible, JSON-like records.',
    color: '#13aa52',
    svg: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#13AA52" d="M17.193 9.555c-1.264-5.58-4.252-7.414-4.573-8.115-.28-.394-.53-.954-.735-1.44-.036.495-.055.685-.523 1.184-.723.566-4.438 3.682-4.74 10.02-.282 5.912 4.27 9.435 4.888 9.884l.07.05A73.49 73.49 0 0111.91 24h.481c.114-1.032.284-2.056.51-3.07.417-.296.604-.463.85-.693a11.342 11.342 0 003.639-8.464c.01-.814-.103-1.662-.197-2.218zm-5.336 8.195s0-8.291.275-8.29c.213 0 .49 10.695.49 10.695-.381-.045-.765-1.76-.765-2.405z"/></svg>`,
  },
  {
    type: 'redis',
    name: 'Redis',
    description: 'In-memory key-value store used as a cache, message broker, and queue.',
    color: '#dc382d',
    svg: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#DC382D" d="M10.97 3.704L8.347 5.01l2.625 1.305 2.623-1.305zm-3.5 1.74L5 6.75l2.62 1.305 2.624-1.305zm7 0l-2.47 1.305 2.47 1.305 2.625-1.305zm-10.5 1.74L1.5 8.49l2.62 1.304L6.74 8.49zm7 0l-2.47 1.304 2.47 1.305 2.625-1.305zm7 0l-2.47 1.304 2.47 1.305 2.624-1.305zm-13 2.653v2.61l2.62 1.305V9.933zm6.5 0v2.61l2.62 1.305V9.933zm6.5 0v2.61l2.62 1.305V9.933zM4.47 10.62L1.5 12.105l2.97 1.478v-2.963zm6.5 0l-2.97 1.485 2.97 1.478V10.62zm6.5 0l-2.97 1.485 2.97 1.478V10.62zM12 14.29l-10.5 5.2 10.5 3.21 10.5-3.21zm0 1.3l7.7 3.9-7.7 2.35-7.7-2.35z"/></svg>`,
  },
  {
    type: 'keydb',
    name: 'KeyDB',
    description: 'Multithreaded, high-performance fork of Redis, drop-in compatible.',
    color: '#f5c518',
    svg: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#F5C518" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
  {
    type: 'dragonfly',
    name: 'Dragonfly',
    description: 'Modern in-memory store, Redis/Memcached-compatible with far higher throughput.',
    color: '#ff6b35',
    svg: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2c-1.5 0-3 .5-4 1.5L3 8c-1 1-1.5 2.5-1.5 4s.5 3 1.5 4l5 4.5c1 1 2.5 1.5 4 1.5s3-.5 4-1.5l5-4.5c1-1 1.5-2.5 1.5-4s-.5-3-1.5-4L16 3.5C15 2.5 13.5 2 12 2z" stroke="#FF6B35" stroke-width="1.5" fill="rgba(255,107,53,0.15)" stroke-linecap="round"/><circle cx="12" cy="12" r="3" fill="#FF6B35"/></svg>`,
  },
  {
    type: 'clickhouse',
    name: 'ClickHouse',
    description: 'Column-oriented database built for real-time analytical queries at scale.',
    color: '#faff69',
    svg: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#FAFF69" stroke="#000" stroke-width="0.5" d="M21.333 10.667H20V13.333H21.333V10.667ZM18.667 10.667H17.333V13.333H18.667V10.667ZM16 10.667H14.667V13.333H16V10.667ZM13.333 10.667H12V13.333H13.333V10.667ZM10.667 8H9.333V16H10.667V8ZM8 10.667H6.667V13.333H8V10.667ZM5.333 10.667H4V13.333H5.333V10.667ZM2.667 10.667H1.333V13.333H2.667V10.667Z"/></svg>`,
  },
];

export function dbEngine(type: DatabaseType): DbEngine {
  return DB_ENGINES.find((e) => e.type === type) ?? DB_ENGINES[0];
}
