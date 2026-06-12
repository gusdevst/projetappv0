# Projet Mobile - Instructions IA

## Objectif du projet

Cette application mobile a pour objectif de passer d’un prototype React Native à une application mobile complète, stable et publiable sur iOS et Android.

L’objectif est :
- d’avoir une architecture propre,
- un code maintenable,
- une expérience utilisateur fluide,
- un 1er MVP rapidement pour faire tester à des beta testeurs privés
- une application prête pour les stores 

Le projet doit être expliqué simplement et étape par étape car le porteur du projet n’est pas développeur mobile. 

---

# Stack technique

## Frontend mobile
- React Native
- Expo si possible
- JavaScript (pas TypeScript pour le moment sauf besoin important)

## Outils
- VS Code
- GitHub
- Claude
- Git

---

# Règles importantes

## Explications

Toujours :
- expliquer simplement,
- détailler les étapes,
- préciser où créer les fichiers,
- expliquer les commandes terminal,
- éviter le jargon inutile.

Quand une modification est proposée :
- toujours préciser le fichier concerné,
- montrer le code complet si possible,
- expliquer ce qui change.

---

# Architecture souhaitée

Le projet doit rester organisé.

Structure souhaitée :

- /screens
- /components
- /services
- /assets
- /navigation
- /hooks
- /utils

Éviter :
- les fichiers trop longs,
- la duplication de logique,
- les dépendances inutiles.

---

# UI / UX

L’application doit avoir :
- un design moderne,
- une interface simple,
- une bonne lisibilité,
- des animations fluides mais légères,
- une expérience proche des apps modernes type startup.

Toujours privilégier :
- simplicité,
- performance,
- clarté.

---

# Qualité de code

Le code doit :
- être propre,
- lisible,
- commenté uniquement si nécessaire,
- éviter les hacks temporaires,
- éviter le code inutile.

Toujours vérifier :
- imports inutilisés,
- erreurs React Native,
- performances,
- compatibilité iOS / Android.

---

# Git et sécurité

Ne jamais :
- supprimer des fichiers critiques sans explication,
- modifier massivement le projet sans prévenir,
- exposer des clés API,
- commiter des secrets.

Avant une grosse modification :
- expliquer l’impact,
- proposer une stratégie simple.

---

# Méthode de travail attendue

Quand une fonctionnalité est demandée :

1. Expliquer le plan
2. Identifier les fichiers à modifier
3. Générer le code
4. Expliquer comment tester
5. Expliquer comment commit Git

Toujours fonctionner étape par étape.

---

# Priorités du projet

Priorité :
1. Application fonctionnelle
2. UX fluide
3. Stabilité
4. Performance
5. Publication stores
6. Optimisation avancée ensuite

---

# Aide attendue de Claude

Claude doit pouvoir :
- corriger les bugs,
- proposer des améliorations UX,
- aider à structurer le projet,
- aider au déploiement,
- aider à la configuration GitHub,
- aider à préparer les stores,
- expliquer les erreurs simplement.
- Suggérer d'aller plus vite en proposant la mise en place d'agent IA pour coder directement avec mon compte CLAUDE.

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
| ------ | ---------- |
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.
