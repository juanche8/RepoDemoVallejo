# Operación de Meta Ads

La integración utiliza un único `META_ACCESS_TOKEN` del lado servidor y acceso de solo lectura. Todas las solicitudes a Meta son `GET`; la aplicación no administra campañas ni solicita `ads_management`.

## Renovación del token

La renovación continúa siendo manual. Cuando Meta informa que el token venció o dejó de ser válido, el servidor devuelve el estado seguro `reauthorization_required` y la interfaz muestra “Meta Ads requiere reconexión”. Los errores de autenticación y permisos no se guardan en caché.

Procedimiento operativo:

1. Generar un token válido con permiso `ads_read` y acceso a las dos cuentas configuradas.
2. Reemplazar `META_ACCESS_TOKEN` en `.env.local` sin registrarlo ni compartirlo.
3. Reiniciar el servidor para recargar el entorno.
4. Verificar Sportotal y Vallejo por separado en “Paid Media”.

No deben copiarse tokens, encabezados `Authorization` ni respuestas completas de autenticación en logs, tickets o documentación.

## Estados de conexión

- `connected`: Meta respondió correctamente.
- `reauthorization_required`: el token debe renovarse manualmente.
- `permission_error`: falta permiso de lectura.
- `account_error`: la cuenta seleccionada no es accesible.
- `rate_limited`: Meta aplicó una limitación temporal.
- `unavailable`: la API está temporalmente indisponible o devolvió una respuesta inválida.

Cada estado se resuelve por ecommerce. Un error de Sportotal no se reutiliza ni se guarda como estado de Vallejo, y viceversa.
