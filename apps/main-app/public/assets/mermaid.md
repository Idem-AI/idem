```mermaid

 class Utilisateur {
        +String nom
        +String prenom
        +String email
        -String motDePasse
        +bool seConnecter(String email, String motDePasse)
    }
    class Eleve extends Utilisateur {
        +int niveau
        +inscrireFormation(Formation formation) bool
    }
    class Formateur extends Utilisateur {
        +String specialite
        +donnerCours(Cours cours) bool
    }
    class Formation {
        +String titre
        +String description
        +int duree
    }
    class Cours {
        +String nom
        +String contenu
        +int duree
    }
    Utilisateur <|-- Eleve : est un
    Utilisateur <|-- Formateur : est un
    Formation *-- Cours : contient 

```