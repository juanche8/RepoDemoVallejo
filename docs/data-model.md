# Modelo de datos de Radar Ecommerce

## Entidades

- `Product`: identidad y taxonomía comercial.
- `SKU`: variante vendible, precio, costo y stock; relación muchos-a-uno con Product.
- `DailyMetric`: tráfico agregado o eventos de producto según exista `productId`.
- `PaidMediaMetric`: observaciones de plataformas, GA4 y VTEX para análisis publicitario.
- `InventorySnapshot`: contrato futuro de stock histórico con `date`, `ecommerce`, `skuId`, `availableStock`, `reservedStock` y `totalStock`.

## Grano de sesiones

Las sesiones se simulan al nivel `ecommerce + fecha + dispositivo + canal + provincia + source + medium + campaign`. No se asignan a Product ni SKU. Los eventos de producto usan filas separadas con `sessions = 0`.

Estos agregados deterministas no representan deduplicación real de usuarios o sesiones. Serán reemplazados por las sesiones oficiales de GA4 cuando se conecte la fuente.

## Métricas de producto

Una fila con `productId` cumple `productViews >= addToCarts >= beginCheckouts >= purchases`. El análisis de producto comienza en `productViews`.

La selección de producto utiliza `productId` como clave interna y conserva `name` exclusivamente como etiqueta visible, siempre dentro del ecommerce correspondiente.

Volumen que no avanzó se define como `volumen de la etapa anterior − volumen de la etapa actual`. El porcentaje asociado se denomina Tasa de abandono.

## Alcance publicitario

`reach` es no aditivo. `frequency = impressions / reach` se calcula únicamente cuando `reachIsAggregated` es verdadero y la consulta contiene una única observación agregada para su alcance exacto. Las diferencias menores entre landing page views y sesiones GA4 se conservan como diferencias de medición, no como errores de validación.

## Persistencia de integraciones

La migración de Supabase prepara cuatro tablas sin reemplazar las existentes:

- `analytics_sync_status`: registra por fuente, cuenta y ecommerce el último intento, la última sincronización exitosa, el rango procesado, el estado, la cantidad de registros y el error controlado cuando corresponda.
- `ga4_daily`: métricas diarias de GA4 por propiedad, ecommerce, adquisición y dispositivo.
- `google_ads_daily`: estructura mínima diaria por cliente y campaña.
- `meta_ads_daily`: estructura mínima diaria por cuenta, campaña, conjunto y anuncio. Su alcance (`reach`) es no aditivo.

Las tablas diarias poseen restricciones `UNIQUE` sobre fecha y dimensiones. Las dimensiones opcionales que participan de esas claves se almacenarán normalizadas y nunca como `NULL`. Esto permite que los servicios posteriores utilicen `UPSERT` y que reprocesar el mismo rango sea idempotente.

## Estrategia incremental

Una ejecución incremental combina los días nuevos con una ventana reciente que absorbe ajustes de atribución: 3 días para GA4 y 7 días para Google Ads y Meta Ads. Las ventanas se configuran mediante variables de entorno y sus valores predeterminados están centralizados en `lib/sync/config.ts`.

La primera carga exige una fecha inicial explícita; el sistema no inventa un histórico. El modo `forceReprocess` exige fecha desde y hasta, utiliza exactamente ese rango y no aplica la ventana incremental. En ambos modos, la persistencia futura deberá hacerse mediante `UPSERT` y actualizar `analytics_sync_status` al finalizar cada intento.

## Normalización inicial de GA4

El cliente servidor consulta un único reporte por rango con adquisición y dispositivo, y pagina únicamente cuando `rowCount` supera las filas recibidas. La normalización usa los nombres de los headers devueltos por GA4, no posiciones fijas.

Las fechas de GA4 se convierten de `YYYYMMDD` a `YYYY-MM-DD`. Dimensiones vacías se guardan como `(not set)` y dispositivos vacíos como `unknown`. Los valores explícitos de tráfico directo se conservan como `(direct)` para source y `(none)` para medium. Las métricas se convierten explícitamente a enteros o decimales no negativos; un valor inválido genera un error controlado en lugar de `NaN`.

## Persistencia y estado de GA4

El flujo implementado es: cálculo del rango, estado `running`, consulta y normalización GA4, UPSERT secuencial por lotes y estado `success`. La fecha inicial de una primera carga debe declararse mediante `GA4_INITIAL_SYNC_DATE`; nunca se infiere un histórico. El tamaño de lote se configura con `GA4_UPSERT_BATCH_SIZE` y utiliza 500 filas como fallback seguro.

Cada UPSERT usa la clave compuesta de dimensiones de `ga4_daily`, actualiza métricas y `updated_at`, y no realiza `DELETE`. `analytics_sync_status.last_successful_date` conserva el último `date_to` confirmado y permite calcular el siguiente rango incremental aunque un intento posterior falle. El modo force utiliza exactamente las fechas solicitadas.

Los lotes se escriben secuencialmente. Si uno falla, los siguientes no se procesan, el estado queda en `failed`, `last_successful_sync` no cambia y `records_processed` conserva únicamente la cantidad confirmada antes del fallo. Supabase REST no garantiza una transacción única entre lotes; los lotes parciales se corrigen de forma segura en el siguiente reproceso gracias a la idempotencia del UPSERT.

Los umbrales de discrepancia están centralizados en `lib/paid-media-rules.ts`: tasa link click a landing inferior a 70%, diferencia porcentual landing/sesión superior a 20% y sesiones cero cuando existen inversión y clics.

## Stock actual e histórico

El stock utilizado por los datos simulados es una fotografía actual. No debe interpretarse como stock histórico del día asociado a una métrica. `InventorySnapshot` prepara el contrato para importar snapshots reales desde VTEX sin conectar todavía la API.
