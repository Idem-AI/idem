# Vilevile

La police de marque IDEM. C'est [Jura](https://github.com/ossobuffo/jura) — SIL OFL 1.1 —
retouchée sur cinq points, auto-hébergée, et exposée en CSS sous le nom `Vilevile`.
Elle porte aussi les icônes du produit.

La typographie servie vit dans `packages/shared-styles/fonts/` ; ce dossier-ci
n'en contient que la fabrique.

**`packages/shared-styles/fonts/` — la typographie**

| Fichier | Rôle |
| --- | --- |
| `fonts.css` | Les `@font-face`, **générés**. Importés par `../styles.css`. |
| `icons.css` | Les classes `.pi-*`, **générées**. Importées par `../styles.css`. |
| `vilevile-latin.woff2` | 31 Ko — chargé par défaut (français, anglais) |
| `vilevile-latin-ext.woff2` | 34 Ko — chargé seulement si la page contient du latin étendu, une lettre africaine ou du grec |
| `vilevile-icons.woff2` | 38 Ko — chargé seulement si la page affiche une icône |
| `vilevile-var.ttf` | 155 Ko — **pas** servi au navigateur : maquettes (Figma, Illustrator), installation système |
| `OFL.txt` | La licence. Elle doit voyager avec les `.woff2`. |

**`packages/shared-styles/tools/font/` — la fabrique**

| Fichier | Rôle |
| --- | --- |
| `build-fonts.py` | La fabrication. Les trois boutons de réglage sont en tête de fichier. |
| `african.py` | La construction des lettres africaines |
| `icons.py` | L'intégration des icônes PrimeIcons |
| `restyle.py` | Le redessin des icônes dans la main d'IDEM |
| `motifs.py` | Le répertoire de motifs qui a fixé la direction — **non branché** |
| `specimen.py` | Le contrôle : épreuve composée avec HarfBuzz + mesures d'impact |
| `src/Jura[wght].ttf` | La source amont, telle que publiée par Google Fonts |

## Ce qui change par rapport à Jura

### 1. L'axe des graisses va jusqu'à 900

Jura s'arrête à 700. Le code appelait déjà `font-black` à 64 endroits et
`font-extrabold` à 9 : le navigateur ne pouvait qu'y répondre par un faux-gras
synthétique. Il y a maintenant un vrai Black.

Jura est un variable font à deux masters (300 et 700) dont toutes les tuiles `gvar`
tiennent sur une seule région, `(start=0, peak=1, end=1)`. Multiplier ses deltas par
`K` revient donc exactement à prolonger la droite qui joint le Light au Bold — pas une
approximation, la même construction géométrique poussée plus loin.

Le plafond a été mesuré, pas choisi à l'œil : au-delà d'un dessin équivalent à
« Jura 1100 », l'anneau du `å` se referme et `œ`, `æ`, `‰` s'empâtent. À 1000, la plus
petite contreforme du Black conserve 23 % de l'aire qu'elle a dans le Bold d'origine,
et aucune n'est fermée. `python3 specimen.py` réaffiche ce contrôle.

### 2. Toute l'échelle est décalée vers le gras

Jura est une police claire : son 400 est mince, son 700 pèse à peine un semi-gras.
L'axe est donc **amputé par le bas** — tout ce qui est plus fin que `DESIGN_FLOOR`
disparaît — puis ré-étiqueté 300..900. Chaque graisse demandée par le CSS reçoit un
dessin nettement plus épais, sans que l'échelle cesse d'être affine (pas de marche, et
aucune table `avar` nécessaire) :

| CSS demande | Jura dessine | Fût, en ‰ de l'em |
| --- | --- | --- |
| 300 Light | 450 | 58 |
| 400 Regular | 542 | 68 |
| 500 Medium | 633 | 77 |
| 600 SemiBold | 725 | 87 |
| 700 Bold | 817 | 97 |
| 800 ExtraBold | 908 | 107 |
| 900 Black | 1000 | 116 |

`DESIGN_FLOOR` est **le** bouton de graisse : le monter épaissit tout le jeu d'un coup.

### 3. L'approche est dans la police

Elle était posée par `* { letter-spacing: -0.07em }` dans `styles.css`. Elle vaut
maintenant -0.09 em et elle est retranchée des chasses (`hmtx`), à l'identique de ce
que fait `letter-spacing` — l'espace est retiré *après* le glyphe, sans le déplacer, ce
qui évite de toucher aux décalages des composites (`é`, `à`…). Elle s'applique aussi à
l'espace-mot, exactement comme le faisait la règle CSS.

**Plus rien dans le produit ne pose d'approche** — ni règle `letter-spacing`, ni
utilitaire `tracking-*` de Tailwind. Le texte la tient de la police, partout. En
reposer une s'**ajouterait** à celle des chasses au lieu de la remplacer.

Seules exceptions, hors du périmètre de Vilevile : les logos en SVG, où l'approche
fait partie du dessin de la marque ; les e-mails, composés en police système ; et le
moteur de documents d'`apps/api`, qui compose dans la police de CHAQUE projet.

Effet de bord agréable : les polices d'icônes ligaturées ne sont plus resserrées au
passage par le sélecteur universel.

### 4. Elle porte les icônes

Une police d'icônes est une police comme une autre : des dessins rangés dans la zone
à usage privé d'Unicode. Rien n'obligeait à en charger une deuxième. Les 314 dessins
de **PrimeIcons 7** sont donc dans Vilevile, à leurs codes d'origine.

Le produit n'a plus qu'une famille. `font-family: 'Vilevile'` dessine le texte ET les
icônes ; il n'y a plus de `@font-face` séparé, plus de `primeicons.woff2` à servir,
plus de règle `!important` pour rattraper la famille dans les composants. Une icône
hérite de la couleur et du corps de son texte comme n'importe quel caractère.

**Et elles sont redessinées dans notre main.** Le vocabulaire graphique ouest-africain
— tampons adinkra, bogolan, nsibidi — ne dessine pas au trait fin : il pose des masses.
PrimeIcons est à l'opposé, un filet de 1,5 unité sur une boîte de 24. `restyle.py`
applique donc à chaque icône une **dilatation morphologique par disque** : c'est
exactement l'outil du tampon, la matrice qui mord le papier un peu au-delà de son bord.
Le trait s'épaissit, les angles saillants s'arrondissent, la topologie reste intacte.

Ce qui change, c'est la MAIN, pas le mot : une corbeille reste une corbeille. La lecture
d'une icône est une convention, et la casser rendrait le produit inutilisable.

**La mesure protège la structure.** Grossir referme les petites contreformes et soude
les éléments voisins — trois points d'ellipse deviendraient une barre. Pour chaque
icône, le grossissement part de `GROW_PX` et redescend tant que la dilatation change le
nombre de taches d'encre ou le nombre de trous. Cinquante-deux icônes ont ainsi été
servies moins épaisses, et le journal de fabrication les nomme.

**Le code existant ne bouge pas.** `icons.css` reprend les classes de PrimeIcons à
l'identique — seule la famille change — donc `<i class="pi pi-user"></i>` fonctionne
tel quel, `.pi-fw` et `.pi-spin` compris.

**Les logos de marques ne sont pas touchés.** GitHub, PayPal, Microsoft, TikTok et les
vingt autres sont des marques déposées : leur dessin ne nous appartient pas, et toutes
les chartes de marque interdisent de l'altérer. La liste est explicite dans
`restyle.py`. Elles paraissent donc plus fines que le reste du jeu — c'est le prix, et
il est juste.

Les icônes partent dans leur propre tranche `unicode-range`. Une page qui n'en affiche
aucune ne télécharge rien de plus qu'avant.

**Ce que ça ne fait pas :** l'épaisseur des icônes ne suit pas l'axe de graisse. Les
sources de PrimeIcons sont des contours pleins — le trait y est déjà vectorisé, il n'y
a pas de `stroke-width` à faire varier. Une icône garde donc son épaisseur à côté d'un
texte en Black. C'est la limite du jeu d'icônes, pas celle de la police.

### 5. Elle sait écrire les langues camerounaises

C'est la partie « typographie africaine », et c'est la seule qui n'enlève ni ne
déplace rien : on n'ajoute que des caractères.

Sur les dix-neuf lettres de l'**Alphabet Général des Langues Camerounaises**, Jura en
ignorait quatorze. Un texte en ewondo, en duala, en fulfuldé ou en bamiléké en sortait
troué de rectangles vides. Vilevile porte l'AGLC au complet, plus six lettres de
l'Alphabet de Référence Africain :

```
A B Ɓ C D Ɗ E Ɛ Ə F G H I Ɨ J K L M N Ŋ Ɲ O Ɔ P R S T U Ʉ V W Y Z
a b ɓ c d ɗ e ɛ ǝ f g h i ɨ j k l m n ŋ ɲ o ɔ p r s t u ʉ v w y z
                                      plus  ɑ  ɣ  ɵ Ɵ
```

Chaque lettre est **construite à partir des formes de Jura**, jamais dessinée à côté
d'elles — c'est ce qui garantit qu'elle reste dans le style et qu'elle grossit avec
l'axe :

- **ɛ, ɣ, ɑ** étaient déjà là sous un autre nom. L'epsilon grec de Jura *est* un
  epsilon ouvert latin, son gamma un gamma latin, son « a » à un seul étage un alpha.
  Une entrée `cmap` suffit : zéro glyphe, zéro octet.
- **ɔ Ɔ Ɛ** sont des miroirs de `c`, `C` et du chiffre `3`.
- **ɨ Ɨ ʉ Ʉ ɵ Ɵ** sont la lettre plus le trait d'union, mis à la bonne longueur. Le
  trait d'union porte l'épaisseur horizontale de la police : la barre s'épaissit donc
  avec la graisse toute seule.
- **ɓ Ɓ ɗ Ɗ** sont la lettre plus un crochet — un quart d'anneau raccordé au sommet du
  fût, tourné vers la gauche comme dans toutes les polices de référence.
- **ɲ Ɲ** sont la lettre plus une queue : un fût droit sous la ligne de base, exactement
  comme Jura dessine déjà celle du `ŋ`.

Les deux seules pièces dessinées — le crochet et la queue — sont paramétrées par
l'épaisseur du trait. Elles sont générées deux fois, au plus clair et au plus gras, et
la différence donne les deltas `gvar` exacts : elles grossissent avec l'axe comme le
reste de la police, sans approximation.

**Les tons se posent.** Les langues camerounaises sont tonales ; sans ancre, un accent
retomberait au pied de la lettre. Chaque lettre construite reçoit l'ancre de son
donneur, et deux glyphes que Jura portait déjà sans ancre — `Ə` et `ɣ` — en reçoivent
une au passage. Vérifié caractère par caractère avec HarfBuzz : `ɛ́ ɛ̀ ɛ̂ ɛ̌`, `ɔ́ ɔ̀ ɔ̂ ɔ̌`,
`ʉ́ ɨ̀ ə̂ ŋ̌` — les vingt-deux lettres, les quatre tons.

## Refabriquer

```sh
pip install fonttools brotli
cd packages/shared-styles/tools/font
python3 build-fonts.py            # réécrit les woff2, la ttf et fonts.css
pip install uharfbuzz pillow numpy
python3 specimen.py               # épreuve + mesures d'impact
```

Les boutons de réglage sont en tête de `build-fonts.py` :

| Réglage | Effet | Conséquence hors de ce dossier |
| --- | --- | --- |
| `DESIGN_FLOOR` | graisse générale | aucune |
| `GROW_PX` (`icons.py`) | épaisseur des icônes | aucune |
| `DESIGN_CEIL` | poids du Black | aucune ; plafonné par la mesure |
| `TRACKING_EM` | approche | aucune, tant que le CSS n'en déclare pas |

`fonts.css` est généré : ne pas l'éditer à la main.

L'application `chart` (mermaid-live-editor) ne consomme pas `@idem/shared-styles` :
elle porte sa propre copie des deux `.woff2` dans `static/fonts/` et ses `@font-face`
dans `src/app.html`. Après une refabrication, recopier les fichiers.

## Impact mesuré sur les gabarits

Plus gras veut dire plus large, mais l'approche portée de -0.07 à -0.09 em compense
presque exactement. Face à l'ancien rendu (Jura de Google + `letter-spacing: -0.07em`) :

| | Light | Regular | Medium | SemiBold | Bold |
| --- | --- | --- | --- | --- | --- |
| largeur du texte | +1,4 % | +0,9 % | +0,6 % | +0,2 % | −0,1 % |

Autrement dit : la page ne bouge pas. Au-delà de 700 la comparaison n'a plus de sens —
il n'y avait pas de dessin en face, seulement du faux-gras.

## Sous-ensemble

Sont conservés le latin complet (Ext-A, Ext-B et Ext-Additional compris — ils portent
les lettres africaines), la ponctuation, les devises (₣, ₦, ₵), les opérateurs
mathématiques et le grec de base. Sont écartés le cyrillique, le grec polytonique et
le kayah li : 381 glyphes sur 1115. Les plages sont dans `KEEP_RANGES`.

La coupure `latin` / `latin-ext` suit celle de Google Fonts : une page en français ou
en anglais ne télécharge que `vilevile-latin.woff2`. Les lettres africaines sont dans
`latin-ext`, donc elles ne coûtent rien tant qu'on ne les affiche pas.

## Licence

Jura est publiée sous la [SIL Open Font License 1.1](./OFL.txt), Copyright 2019 The Jura
Project Authors, par Daniel Johnson, Alexei Vanyashin et Mirko Velimirovic. Aucun nom de
police réservé n'est déclaré dans son en-tête ; la version modifiée porte néanmoins un
nom distinct, et les modifications sont consignées dans la notice de copyright de la
police elle-même.

L'OFL est virale : Vilevile reste sous OFL 1.1, `OFL.txt` doit voyager avec les
`.woff2`, et elle ne peut pas être vendue seule.
