/**
 * Les pays d'Afrique de la carte (Natural Earth 1:110m, identifiants ISO 3166-1 numériques)
 * et les noms par lesquels un texte les désigne : français, anglais, grandes villes.
 *
 * La carte ne met en valeur QUE les pays nommés dans les textes de la scène : jamais un pays
 * deviné.
 */

/** Identifiant ISO numérique → noms (le premier est le nom affiché). */
export const AFRICA: Record<string, string[]> = {
  '012': ['Algérie', 'Algeria', 'Alger', 'Algiers', 'Oran'],
  '024': ['Angola', 'Luanda'],
  '072': ['Botswana', 'Gaborone'],
  '108': ['Burundi', 'Bujumbura', 'Gitega'],
  '120': ['Cameroun', 'Cameroon', 'Douala', 'Yaoundé', 'Yaounde'],
  '140': ['Centrafrique', 'République centrafricaine', 'Central African Republic', 'Bangui'],
  '148': ['Tchad', 'Chad', "N'Djamena", 'Ndjamena'],
  '178': ['Congo', 'Congo-Brazzaville', 'République du Congo', 'Republic of the Congo', 'Brazzaville', 'Pointe-Noire'],
  '180': ['RD Congo', 'RDC', 'République démocratique du Congo', 'Congo-Kinshasa', 'DR Congo', 'DRC', 'Democratic Republic of the Congo', 'Kinshasa', 'Lubumbashi'],
  '204': ['Bénin', 'Benin', 'Cotonou', 'Porto-Novo'],
  '226': ['Guinée équatoriale', 'Equatorial Guinea', 'Malabo'],
  '231': ['Éthiopie', 'Ethiopia', 'Addis-Abeba', 'Addis Ababa'],
  '232': ['Érythrée', 'Eritrea', 'Asmara'],
  '262': ['Djibouti'],
  '266': ['Gabon', 'Libreville'],
  '270': ['Gambie', 'Gambia', 'Banjul'],
  '288': ['Ghana', 'Accra', 'Kumasi'],
  '324': ['Guinée', 'Guinea', 'Conakry'],
  '384': ["Côte d'Ivoire", 'Cote d Ivoire', 'Ivory Coast', 'Abidjan', 'Yamoussoukro', 'Bouaké', 'Bouake', 'Cocody', 'Yopougon'],
  '404': ['Kenya', 'Nairobi', 'Mombasa'],
  '426': ['Lesotho', 'Maseru'],
  '430': ['Liberia', 'Libéria', 'Monrovia'],
  '434': ['Libye', 'Libya', 'Tripoli'],
  '450': ['Madagascar', 'Antananarivo'],
  '454': ['Malawi', 'Lilongwe'],
  '466': ['Mali', 'Bamako'],
  '478': ['Mauritanie', 'Mauritania', 'Nouakchott'],
  '504': ['Maroc', 'Morocco', 'Casablanca', 'Rabat', 'Marrakech', 'Tanger'],
  '508': ['Mozambique', 'Maputo'],
  '516': ['Namibie', 'Namibia', 'Windhoek'],
  '562': ['Niger', 'Niamey'],
  '566': ['Nigeria', 'Nigéria', 'Lagos', 'Abuja', 'Kano'],
  '624': ['Guinée-Bissau', 'Guinea-Bissau', 'Bissau'],
  '646': ['Rwanda', 'Kigali'],
  '686': ['Sénégal', 'Senegal', 'Dakar', 'Thiès', 'Saint-Louis'],
  '694': ['Sierra Leone', 'Freetown'],
  '706': ['Somalie', 'Somalia', 'Mogadiscio', 'Mogadishu'],
  '710': ['Afrique du Sud', 'South Africa', 'Johannesburg', 'Le Cap', 'Cape Town', 'Pretoria', 'Durban'],
  '716': ['Zimbabwe', 'Harare'],
  '728': ['Soudan du Sud', 'South Sudan', 'Djouba', 'Juba'],
  '729': ['Soudan', 'Sudan', 'Khartoum'],
  '732': ['Sahara occidental', 'Western Sahara'],
  '748': ['Eswatini', 'Swaziland', 'Mbabane'],
  '768': ['Togo', 'Lomé', 'Lome'],
  '788': ['Tunisie', 'Tunisia', 'Tunis', 'Sfax'],
  '800': ['Ouganda', 'Uganda', 'Kampala'],
  '818': ['Égypte', 'Egypt', 'Le Caire', 'Cairo', 'Alexandrie', 'Alexandria'],
  '834': ['Tanzanie', 'Tanzania', 'Dar es Salaam', 'Dodoma', 'Zanzibar'],
  '854': ['Burkina Faso', 'Burkina', 'Ouagadougou', 'Bobo-Dioulasso'],
  '894': ['Zambie', 'Zambia', 'Lusaka'],
  Somaliland: ['Somaliland', 'Hargeisa'],
};

const norm = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’'`]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Tous les noms, du plus long au plus court : « RD Congo » est lu avant « Congo », « Guinée-Bissau » avant « Guinée ». */
const NAMES = Object.entries(AFRICA)
  .flatMap(([id, names]) => names.map((name) => ({ id, key: ` ${norm(name)} ` })))
  .sort((a, b) => b.key.length - a.key.length);

/** Les pays nommés dans un texte (identifiants de la carte), dans l'ordre où ils apparaissent. */
export function countriesIn(text?: string | null): string[] {
  let rest = ` ${norm(String(text || ''))} `;
  const found: { id: string; at: number }[] = [];
  for (const { id, key } of NAMES) {
    let at = rest.indexOf(key);
    while (at >= 0) {
      if (!found.some((f) => f.id === id)) found.push({ id, at });
      // Le nom lu est effacé : « Congo » ne se relit pas dans « RD Congo ».
      rest = rest.slice(0, at) + ' '.repeat(key.length - 1) + rest.slice(at + key.length - 1);
      at = rest.indexOf(key);
    }
  }
  return found.sort((a, b) => a.at - b.at).map((f) => f.id);
}

/** Le nom affiché d'un pays de la carte. */
export const countryName = (id: string) => AFRICA[id]?.[0] || id;
