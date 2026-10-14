/**
 * Le contrat des composants du template, tel que les agents le lisent.
 *
 * Un agent n'a pas besoin du code d'un bouton pour s'en servir : il lui faut
 * son import, ses props, ses variantes et un exemple. C'est tout ce qui part
 * dans les prompts — quelques lignes par composant — et seulement pour les
 * composants que le site utilise.
 *
 * `exports` sert aussi à la vérification : un import d'un nom qui n'existe pas
 * est refusé avant d'atteindre l'aperçu.
 */

export interface ComponentContract {
  /** Nom du module dans `@/components/ui/`. */
  module: string;
  exports: string[];
  /** Ce que fait le composant et comment l'appeler, en deux à cinq lignes. */
  usage: string;
  /** Toujours décrit aux agents, quel que soit le site. */
  core?: boolean;
}

export const CATALOG: ComponentContract[] = [
  {
    module: 'button',
    exports: ['Button', 'buttonVariants'],
    core: true,
    usage: `<Button>Texte</Button> — variant: primary | secondary | outline | ghost | accent | link | destructive (défaut : celle du thème) ; size: sm | md | lg | icon.
Lien d'action : <Button asChild><a href="/contact">Nous écrire</a></Button>. Icône : <Button size="icon" aria-label="Menu"><Menu /></Button>.`,
  },
  {
    module: 'heading',
    exports: ['Heading', 'headingVariants'],
    core: true,
    usage: `<Heading level={1} size="display">…</Heading> — level 1-6 donne la balise ; size: display | h1 | h2 | h3 | h4 | lead (défaut : selon level). Police, graisse, casse : celles du thème.`,
  },
  {
    module: 'text',
    exports: ['Text', 'textVariants'],
    core: true,
    usage: `<Text variant="lead">…</Text> — variant: lead | body | muted | small | eyebrow ; as: p | span | div | strong | small.
"eyebrow" = la petite ligne au-dessus d'un titre.`,
  },
  {
    module: 'container',
    exports: ['Container'],
    core: true,
    usage: `<Container>…</Container> — largeur de contenu et marges latérales du thème. <Container wide> : pleine largeur avec marges.`,
  },
  {
    module: 'section',
    exports: ['Section'],
    core: true,
    usage: `<Section id="ancre" className="bg-muted">…</Section> — un <section> qui porte DÉJÀ l'espacement vertical du thème : n'ajoute aucun py-*/pt-*/pb-* ni sur lui ni sur son conteneur direct (pour un autre rythme, prends une balise <section> simple). Le fond et la disposition sont à toi.`,
  },
  {
    module: 'card',
    exports: ['Card', 'CardHeader', 'CardTitle', 'CardDescription', 'CardContent', 'CardFooter', 'cardVariants'],
    core: true,
    usage: `<Card><CardHeader><CardTitle>…</CardTitle><CardDescription>…</CardDescription></CardHeader><CardContent>…</CardContent><CardFooter>…</CardFooter></Card>
variant: outline | flat | elevated | filled (défaut : celle du thème). Bordure, rayon, ombre et marges : celles du thème.`,
  },
  {
    module: 'badge',
    exports: ['Badge', 'badgeVariants'],
    core: true,
    usage: `<Badge>Nouveau</Badge> — variant: soft | solid | outline | secondary.`,
  },
  {
    module: 'media',
    exports: ['Media'],
    core: true,
    usage: `<Media asset={media['cle']} className="aspect-[4/3] rounded-card" priority /> — affiche un visuel de @/site/media (photo, dessin, vidéo, motif). Donne-lui un ratio (aspect-*) ou une hauteur. N'affiche rien si l'asset n'existe pas.`,
  },
  {
    module: 'separator',
    exports: ['Separator'],
    core: true,
    usage: `<Separator /> ou <Separator orientation="vertical" className="h-6" />.`,
  },
  {
    module: 'accordion',
    exports: ['Accordion', 'AccordionItem', 'AccordionTrigger', 'AccordionContent'],
    usage: `<Accordion type="single" collapsible><AccordionItem value="q1"><AccordionTrigger>Question</AccordionTrigger><AccordionContent>Réponse</AccordionContent></AccordionItem></Accordion>`,
  },
  {
    module: 'tabs',
    exports: ['Tabs', 'TabsList', 'TabsTrigger', 'TabsContent'],
    usage: `<Tabs defaultValue="a"><TabsList><TabsTrigger value="a">A</TabsTrigger></TabsList><TabsContent value="a">…</TabsContent></Tabs>`,
  },
  {
    module: 'sheet',
    exports: ['Sheet', 'SheetTrigger', 'SheetClose', 'SheetContent', 'SheetHeader', 'SheetTitle', 'SheetDescription'],
    usage: `Menu mobile : <Sheet><SheetTrigger asChild><Button size="icon" variant="ghost" aria-label="Menu"><Menu /></Button></SheetTrigger><SheetContent side="right"><SheetTitle>…</SheetTitle>…</SheetContent></Sheet>. Un lien qui ferme : <SheetClose asChild><a href="…">…</a></SheetClose>.`,
  },
  {
    module: 'dialog',
    exports: ['Dialog', 'DialogTrigger', 'DialogClose', 'DialogContent', 'DialogHeader', 'DialogFooter', 'DialogTitle', 'DialogDescription'],
    usage: `<Dialog><DialogTrigger asChild><Button>Ouvrir</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>…</DialogTitle><DialogDescription>…</DialogDescription></DialogHeader>…</DialogContent></Dialog>`,
  },
  {
    module: 'dropdown-menu',
    exports: ['DropdownMenu', 'DropdownMenuTrigger', 'DropdownMenuGroup', 'DropdownMenuContent', 'DropdownMenuItem', 'DropdownMenuLabel', 'DropdownMenuSeparator'],
    usage: `<DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost">…</Button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem asChild><a href="…">…</a></DropdownMenuItem></DropdownMenuContent></DropdownMenu>`,
  },
  {
    module: 'tooltip',
    exports: ['Tooltip', 'TooltipTrigger', 'TooltipContent', 'TooltipProvider'],
    usage: `<TooltipProvider><Tooltip><TooltipTrigger asChild>…</TooltipTrigger><TooltipContent>…</TooltipContent></Tooltip></TooltipProvider>`,
  },
  {
    module: 'popover',
    exports: ['Popover', 'PopoverTrigger', 'PopoverContent'],
    usage: `<Popover><PopoverTrigger asChild><Button variant="outline">…</Button></PopoverTrigger><PopoverContent>…</PopoverContent></Popover>`,
  },
  {
    module: 'alert',
    exports: ['Alert', 'AlertTitle', 'AlertDescription'],
    usage: `<Alert variant="info"><Info /><AlertTitle>…</AlertTitle><AlertDescription>…</AlertDescription></Alert> — variant: default | info | destructive.`,
  },
  {
    module: 'avatar',
    exports: ['Avatar', 'AvatarImage', 'AvatarFallback'],
    usage: `<Avatar className="size-14"><AvatarImage src={photo} alt={nom} /><AvatarFallback>AB</AvatarFallback></Avatar>`,
  },
  {
    module: 'table',
    exports: ['Table', 'TableHeader', 'TableBody', 'TableRow', 'TableHead', 'TableCell', 'TableCaption'],
    usage: `<Table><TableHeader><TableRow><TableHead>…</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell>…</TableCell></TableRow></TableBody></Table>`,
  },
  {
    module: 'input',
    exports: ['Input', 'fieldClasses', 'FIELD_STYLES'],
    usage: `<Input id="email" type="email" placeholder="…" /> — style du champ (contour, rempli, souligné) : celui du thème.`,
  },
  { module: 'textarea', exports: ['Textarea'], usage: `<Textarea id="message" rows={5} />` },
  { module: 'label', exports: ['Label'], usage: `<Label htmlFor="email">Adresse e-mail</Label>` },
  {
    module: 'form-message',
    exports: ['FormMessage'],
    usage: `<FormMessage tone="hint | error | success" id="email-aide">…</FormMessage>`,
  },
  {
    module: 'select',
    exports: ['Select', 'SelectGroup', 'SelectValue', 'SelectTrigger', 'SelectContent', 'SelectItem'],
    usage: `<Select><SelectTrigger aria-label="…"><SelectValue placeholder="…" /></SelectTrigger><SelectContent><SelectItem value="a">A</SelectItem></SelectContent></Select>`,
  },
  { module: 'checkbox', exports: ['Checkbox'], usage: `<Checkbox id="ok" /> <Label htmlFor="ok">…</Label>` },
  {
    module: 'radio-group',
    exports: ['RadioGroup', 'RadioGroupItem'],
    usage: `<RadioGroup defaultValue="a"><RadioGroupItem value="a" id="a" /><Label htmlFor="a">…</Label></RadioGroup>`,
  },
  { module: 'switch', exports: ['Switch'], usage: `<Switch id="s" aria-label="…" />` },
];

export const CATALOG_MODULES = new Set(CATALOG.map((entry) => entry.module));

export const catalogEntry = (module: string): ComponentContract | undefined =>
  CATALOG.find((entry) => entry.module === module);

/** Les modules optionnels, tels que l'architecte peut les demander. */
export const OPTIONAL_MODULES = CATALOG.filter((entry) => !entry.core).map((entry) => entry.module);

/** Le contrat des composants retenus pour un site : les modules de base, plus ceux demandés. */
export function renderContract(modules: Iterable<string>): string {
  const wanted = new Set(modules);
  return CATALOG.filter((entry) => entry.core || wanted.has(entry.module))
    .map((entry) => `### @/components/ui/${entry.module} → { ${entry.exports.filter((name) => /^[A-Z]/.test(name)).join(', ')} }\n${entry.usage}`)
    .join('\n\n');
}
