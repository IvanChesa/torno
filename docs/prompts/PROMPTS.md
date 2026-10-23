# Prompts para Claude Code

Abre Claude Code en la carpeta `torno` (en la terminal, `claude`; o la pestaña Code de la app). Modelo **Opus 5.5**, modo auto y el esfuerzo de la tabla, puesto **antes** de pegar el prompt. Una sesión nueva por bloque.
El ciclo, las paradas y las decisiones ya tomadas están en `CLAUDE.md`: los prompts solo dicen qué bloque toca.

| Bloque | Fases (ramas) | Esfuerzo | Antes de empezar (Iván) |
|---|---|---|---|
| 0 | 0 (`fase-0-cimientos`) | `/effort max` | ✅ |
| A | 1 (`fase-1-nucleo-audio`) y 2 (`fase-2-motor-navegador`) | `/effort max` | — |
| B | 3 (`fase-3-sonidos`) y 4 (`fase-4-staging`) | `/effort max` | GitHub, staging, secrets e iPhone (si no, la fase 4 se aplaza) |
| C | 5 (`fase-5-modelo-3d`) y 6 (`fase-6-interaccion`) | `/effort max` | Pruebas de la fase 4 en Android e iPhone |
| D | 7 (`fase-7-web-producto`) | `/effort high` | — |
| E | 8 (`fase-8-pulido`) | `/effort max` | iPhone; decisión sobre `@lhci/cli` |
| F | 9 (`fase-9-lanzamiento`) | `/effort high` | Subdominio de producción, FTP, secrets y licencia |

## Empezar el proyecto
```
Lee CLAUDE.md y docs/PLAN.md entero y ejecuta el BLOQUE 0 en modo autónomo.
```

## Aplicar la revisión de un bloque y seguir
```
Aplica docs/revisiones/bloque-<X>.md (decisiones de Iván: <… o «ninguna»>) y ejecuta el BLOQUE <Y> en modo autónomo.
```

## Tras la parada de la fase 5.a
```
Diseño <aprobado | aprobado con estos cambios: …>. Sigue con la 5.b y el resto del bloque C.
```

## Retomar en una sesión nueva
```
Retoma el BLOQUE <X> en modo autónomo desde DIARIO.md, el informe en curso y git.
```

## Si algo se tuerce
```
Para y explícame en pocas líneas qué falla y qué opciones ves. No borres ni reviertas nada.
```
