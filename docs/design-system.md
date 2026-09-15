# Sistema de diseño — Radar Ecommerce / Grupo Vallejo

Radar Ecommerce utiliza una estética institucional, ejecutiva y luminosa. La interfaz prioriza claridad, densidad controlada y uso disciplinado del azul.

## Paleta

| Token | Valor | Uso |
|---|---:|---|
| `--gv-blue` | `#164E8A` | Acción primaria y navegación activa |
| `--gv-blue-dark` | `#0B2F55` | Títulos y cifras principales |
| `--gv-blue-medium` | `#2F6FAE` | Gráficos y acentos secundarios |
| `--gv-blue-light` | `#EAF3FB` | Hover y selección secundaria |
| `--gv-blue-faint` | `#F5F9FD` | Encabezados y fondos sutiles |
| `--gv-white` | `#FFFFFF` | Superficies |
| `--gv-background` | `#F6F8FB` | Fondo general |
| `--gv-border` | `#DCE4EC` | Bordes |
| `--gv-text-muted` | `#5D6B78` | Texto secundario |
| `--gv-text` | `#17212B` | Texto principal |
| `--gv-positive` | `#16875D` | Saludable |
| `--gv-alert` | `#C63D47` | Crítico |
| `--gv-warning` | `#D58A18` | Atención |

Los valores se centralizan en `app/globals.css`; no se incorporan hexadecimales en componentes.

## Tipografía y jerarquía

Montserrat es la única familia visible, con pesos 400, 500, 600 y 700. Los títulos de página usan 24–34 px; los títulos de sección 16–20 px; cifras principales 21–30 px; texto corriente 11–14 px; labels y tablas 8–11 px.

## Componentes

- **Botón primario:** azul principal y texto blanco.
- **Botón secundario:** fondo blanco, borde y texto azul.
- **Tarjeta:** fondo blanco, borde suave, radio moderado y sombra mínima.
- **Tabla:** encabezado azul muy claro, primera columna fija, números a la derecha y desplazamiento horizontal.
- **Gráfico:** series en azul principal, medio, oscuro y claro; estados semánticos reservados.
- **Estados:** Oportunidad en azul, Atención en ámbar, Crítico en rojo y Saludable en verde. Siempre incluyen texto, no dependen solo del color.

## Reglas

1. Mantener contraste, foco visible y navegación por teclado.
2. Evitar degradados intensos y grandes superficies semánticas.
3. Usar fondos blancos o azul muy claro.
4. En móvil, plegar filtros y permitir scroll en tablas.
5. Usar verde, rojo y ámbar únicamente para comunicar estados.
