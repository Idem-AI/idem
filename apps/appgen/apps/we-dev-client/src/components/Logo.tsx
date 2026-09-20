import { BrandMark } from './Brand';

/**
 * Ancien composant décoratif (dégradé bleu/violet + icône `Code` de lucide).
 * Il n'avait aucun rapport avec l'identité du produit ; il affiche désormais
 * le symbole iCode. Conservé sous ce nom pour ne pas casser ses appelants.
 */
export const Logo = () => <BrandMark size={72} />;

export default Logo;
