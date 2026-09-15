# 📊 Radar Ecommerce

Herramienta interna de Grupo Vallejo para analizar conversión, producto, categorías, Paid Media y, próximamente, medios de pago. Las fuentes pendientes se identifican explícitamente en cada módulo.

![Next.js](https://img.shields.io/badge/Next.js-15-0B2F55?logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-164E8A?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-2F6FAE?logo=tailwindcss&logoColor=white)
![Recharts](https://img.shields.io/badge/Recharts-Visualización-16875D)
![Supabase](https://img.shields.io/badge/Supabase-Preparado-16875D?logo=supabase&logoColor=white)

## 🚀 Ejecutar localmente

Requiere Node.js 22.13 o superior y pnpm.

```bash
pnpm install
pnpm dev
```

Abrir `http://localhost:3000`.

## ✅ Validaciones

```bash
pnpm exec tsc --noEmit --incremental false
pnpm lint
pnpm test
pnpm build
```

## 🧪 Capas simuladas

- Catálogo de 90 productos y sus SKU: `lib/mock-data.ts`.
- Métricas agregadas de sesiones y eventos diarios de producto: `lib/mock-data.ts`.
- Meta Ads y Google Ads: `lib/paid-media-data.ts`.
- Estado y horarios de sincronización: `components/layout/InstitutionalHeader.tsx`.
- Clientes futuros sin conexión activa: `lib/integrations/ga4`, `lib/integrations/vtex` y `lib/supabase`.

## 🧩 Modelo Product / SKU

`Product` representa el modelo comercial: `productId`, nombre, modelo, marca, macrocategoría, categoría, subcategoría y ecommerce. No contiene canal, provincia, precio ni stock.

Los selectores guardan `productId` como valor interno y muestran el nombre únicamente como etiqueta. Las relaciones y filtros nunca dependen solo del nombre visible.

`SKU` representa una variante vendible y se vincula por `productId`: `skuId`, color, talle, precio actual, precio de lista, costo opcional y stock. Un producto posee entre dos y cuatro SKU simulados.

`DailyMetric` contiene fecha, ecommerce, `commercialChannel`, `acquisitionChannel`, provincia, dispositivo y los campos opcionales `source`, `medium` y `campaign`. `productId` es opcional para distinguir filas agregadas de sesiones de filas de eventos de producto.

El canal comercial usa Ecommerce, Marketplace o Tienda física asistida. El canal de adquisición usa Paid Social, Paid Search, Organic Search, Direct, Email o Referral. La plataforma publicitaria se modela aparte como Meta Ads o Google Ads.

## 🔄 Sesiones y embudos

- Embudo general: `sesiones → vistas de producto → carrito → checkout → compra`.
- Embudo de producto: `vistas de producto → carrito → checkout → compra`.
- Volumen que no avanzó: `volumen de la etapa anterior − volumen de la etapa actual`.
- Tasa de abandono: `volumen que no avanzó / volumen de la etapa anterior × 100`.
- Las sesiones se almacenan una sola vez por ecommerce, fecha, dispositivo, canal, provincia y campaña, en filas sin `productId`.
- Las filas con `productId` tienen `sessions = 0`; por eso no se suman sesiones de productos para construir el total del ecommerce.
- Estas sesiones simuladas son agregados por dimensiones: no representan usuarios ni sesiones reales deduplicadas.
- Al integrar GA4 serán reemplazadas por las sesiones oficiales informadas por GA4.

## ➕ Aditividad

Son aditivas dentro de dimensiones compatibles: sesiones agregadas, vistas, carritos, checkouts, compras, unidades, ingresos, impresiones, clics, landing page views e inversión.

`reach` no es aditivo entre campañas, anuncios ni plataformas. Solo se muestra y se usa para calcular frecuencia cuando la fuente entrega alcance ya agregado para el alcance exacto consultado. En cualquier agrupación formada por varias filas, Radar Ecommerce muestra “No aditivo” y no calcula frecuencia.

## 📦 Stock

El stock mostrado es el stock actual simulado y no representa el stock que existía en cada fecha histórica. El tipo `InventorySnapshot` deja preparado el futuro historial por fecha, ecommerce y SKU, separando stock disponible, reservado y total. Todavía no se conecta VTEX.

## 📅 Comparaciones

- Para un día: día anterior, período anterior equivalente o sin comparación.
- Para períodos de 2 a 7 días: período anterior equivalente, mismos días de la semana anterior o sin comparación.
- “Mismos días de la semana anterior” desplaza exactamente ambos extremos 7 días y conserva la longitud del rango.
- Para períodos mayores a 7 días, esa opción se oculta porque un desplazamiento de siete días produciría superposición.
- Los rangos comparados nunca se superponen con el período actual.

## 🛠️ Pendientes antes de conectar datos reales

- Definir eventos y parámetros oficiales de GA4 para cada ecommerce.
- Acordar identidad de sesión, atribución, zona horaria y ventanas de conversión.
- Mapear catálogo, SKU, precios y stock de VTEX.
- Obtener alcance agregado desde las APIs publicitarias para cada nivel de consulta.
- Conciliar compras e ingresos entre GA4 y VTEX.
- Implementar cargas incrementales, deduplicación, reintentos y observabilidad.
- Diseñar persistencia y políticas de acceso en Supabase.
