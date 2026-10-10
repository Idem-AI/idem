/**
 * Les textes de l'éditeur partagé (IDEM, iVision), en un seul endroit.
 *
 * Le paquet ne dépend pas des fichiers de traduction de chaque appli : un texte ajouté à
 * l'éditeur s'ajoute ICI, une fois, et vaut dans les deux produits. La langue, elle, est celle
 * de l'appli (ngx-translate), lue par le pipe `idemEditorT`.
 */
export type EditorDictionary = { [key: string]: string | EditorDictionary };

export const EDITOR_I18N: Record<'fr' | 'en', EditorDictionary> = {
  fr: {
  "canvasLabel": "Aperçu du document",
  "inspector": "Propriétés",
  "loading": "Chargement du document…",
  "toolbar": {
    "back": "Retour",
    "subtitle": "Double-cliquez un texte pour le modifier",
    "undo": "Annuler",
    "redo": "Rétablir",
    "zoomOut": "Dézoomer",
    "zoomIn": "Zoomer",
    "save": "Enregistrer",
    "saving": "Enregistrement…",
    "saved": "Enregistré",
    "saveError": "Échec de l'enregistrement",
    "unsaved": "Modifications non enregistrées",
    "upToDate": "À jour",
    "pages": "Pages du document"
  },
  "layers": {
    "title": "Pages du document",
    "pages": "Pages",
    "close": "Fermer les pages"
  },
  "emptySelection": {
    "title": "Aucun élément sélectionné",
    "subtitle": "Cliquez un élément pour modifier ses propriétés, ou double-cliquez un texte pour l'éditer directement."
  },
  "props": {
    "heading": "Propriétés",
    "textColor": "Couleur du texte",
    "bgColor": "Fond",
    "clearBg": "Retirer le fond",
    "fontSize": "Taille",
    "fontWeight": "Graisse",
    "align": "Alignement",
    "opacity": "Opacité",
    "position": "Position",
    "freePosition": "Placement libre",
    "flowPosition": "Revenir au flux",
    "x": "X",
    "y": "Y",
    "dragHint": "Faites aussi glisser la poignée bleue sur le canevas pour positionner l’élément.",
    "size": "Dimensions et contour",
    "width": "Largeur",
    "height": "Hauteur",
    "radius": "Rayon",
    "border": "Bordure",
    "borderColor": "Couleur de bordure",
    "layers": "Calques",
    "layer": "Niveau de calque",
    "bringToFront": "Au premier plan",
    "sendToBack": "À l’arrière-plan",
    "bringForward": "Avancer",
    "sendBackward": "Reculer",
    "arrange": "Disposition",
    "moveUp": "Monter",
    "moveDown": "Descendre",
    "delete": "Supprimer l'élément"
  },
  "chart": {
    "heading": "Graphique",
    "type": "Type",
    "types": {
      "bar": "Barres",
      "line": "Courbes",
      "pie": "Camembert",
      "doughnut": "Anneau",
      "radar": "Radar",
      "polarArea": "Aire polaire"
    },
    "legend": "Légende",
    "showLegend": "Afficher",
    "title": "Titre du graphique",
    "labels": "Libellés",
    "sliceColor": "Couleur du secteur",
    "removeLabel": "Retirer le libellé",
    "datasets": "Séries",
    "seriesColor": "Couleur de la série",
    "seriesName": "Nom de la série",
    "removeSeries": "Retirer la série",
    "value": "Valeur"
  },
  "ai": {
    "title": "Édition par IA",
    "placeholder": "Décrivez la modification à apporter à cette section…",
    "working": "Modification en cours…",
    "apply": "Appliquer avec l'IA",
    "hint": "L'IA tient compte de tout le contexte du projet pour modifier la section."
  },
  "error": {
    "back": "Retour",
    "noProject": {
      "title": "Aucun projet sélectionné",
      "subtitle": "Sélectionnez d'abord un projet pour éditer ses documents."
    },
    "load": {
      "title": "Chargement impossible",
      "subtitle": "Le document n'a pas pu être chargé. Réessayez depuis la page d'où vous l'avez ouvert."
    }
  },
  "attrs": {
    "heading": "Attributs",
    "name": "Nom",
    "value": "Valeur",
    "add": "Ajouter",
    "remove": "Retirer l'attribut"
  },
  "inspectorClose": "Fermer les propriétés",
  "zoom": {
    "menu": "Zoom : {{value}} %",
    "fitWidth": "Ajuster à la largeur"
  },
  "preview": {
    "close": "Fermer",
    "loading": "Chargement du visuel…",
    "failed": "Ce visuel ne peut pas être affiché.",
    "canvasLabel": "Aperçu du visuel",
    "menuLabel": "Que faire de cet élément",
    "edit": "Modifier",
    "hint": "Passez la souris sur le visuel, puis cliquez sur ce que vous voulez changer.",
    "kinds": {
      "text": "Ce texte",
      "image": "Cette image",
      "block": "Ce bloc"
    }
  }
},
  en: {
  "canvasLabel": "Document preview",
  "inspector": "Properties",
  "loading": "Loading document…",
  "toolbar": {
    "back": "Back",
    "subtitle": "Double-click any text to edit it",
    "undo": "Undo",
    "redo": "Redo",
    "zoomOut": "Zoom out",
    "zoomIn": "Zoom in",
    "save": "Save",
    "saving": "Saving…",
    "saved": "Saved",
    "saveError": "Save failed",
    "unsaved": "Unsaved changes",
    "upToDate": "Up to date",
    "pages": "Document pages"
  },
  "layers": {
    "title": "Document pages",
    "pages": "Pages",
    "close": "Close pages"
  },
  "emptySelection": {
    "title": "No element selected",
    "subtitle": "Click an element to edit its properties, or double-click text to edit it in place."
  },
  "props": {
    "heading": "Properties",
    "textColor": "Text color",
    "bgColor": "Background",
    "clearBg": "Clear background",
    "fontSize": "Size",
    "fontWeight": "Weight",
    "align": "Alignment",
    "opacity": "Opacity",
    "position": "Position",
    "freePosition": "Free placement",
    "flowPosition": "Return to flow",
    "x": "X",
    "y": "Y",
    "dragHint": "You can also drag the blue handle on the canvas to position the element.",
    "size": "Size and border",
    "width": "Width",
    "height": "Height",
    "radius": "Radius",
    "border": "Border",
    "borderColor": "Border color",
    "layers": "Layers",
    "layer": "Layer level",
    "bringToFront": "Bring to front",
    "sendToBack": "Send to back",
    "bringForward": "Bring forward",
    "sendBackward": "Send backward",
    "arrange": "Arrange",
    "moveUp": "Move up",
    "moveDown": "Move down",
    "delete": "Delete element"
  },
  "chart": {
    "heading": "Chart",
    "type": "Type",
    "types": {
      "bar": "Bar",
      "line": "Line",
      "pie": "Pie",
      "doughnut": "Doughnut",
      "radar": "Radar",
      "polarArea": "Polar area"
    },
    "legend": "Legend",
    "showLegend": "Show",
    "title": "Chart title",
    "labels": "Labels",
    "sliceColor": "Slice color",
    "removeLabel": "Remove label",
    "datasets": "Series",
    "seriesColor": "Series color",
    "seriesName": "Series name",
    "removeSeries": "Remove series",
    "value": "Value"
  },
  "ai": {
    "title": "AI editing",
    "placeholder": "Describe the change you want for this section…",
    "working": "Editing…",
    "apply": "Apply with AI",
    "hint": "The AI uses the whole project context to edit this section."
  },
  "error": {
    "back": "Back",
    "noProject": {
      "title": "No project selected",
      "subtitle": "Select a project first to edit its documents."
    },
    "load": {
      "title": "Could not load",
      "subtitle": "The document failed to load. Try again from the page you opened it from."
    }
  },
  "attrs": {
    "heading": "Attributes",
    "name": "Name",
    "value": "Value",
    "add": "Add",
    "remove": "Remove attribute"
  },
  "inspectorClose": "Close properties",
  "zoom": {
    "menu": "Zoom: {{value}}%",
    "fitWidth": "Fit to width"
  },
  "preview": {
    "close": "Close",
    "loading": "Loading the visual…",
    "failed": "This visual cannot be displayed.",
    "canvasLabel": "Visual preview",
    "menuLabel": "What to do with this element",
    "edit": "Edit",
    "hint": "Hover the visual, then click whatever you want to change.",
    "kinds": {
      "text": "This text",
      "image": "This image",
      "block": "This block"
    }
  }
},
};
