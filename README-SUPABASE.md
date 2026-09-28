# Luma + Supabase

## 1. Crear el proyecto
1. Crea un proyecto en Supabase.
2. Abre SQL Editor y ejecuta `supabase.sql`.
3. En Settings > API Keys copia la URL del proyecto y la **Publishable key**.
4. Pega ambos valores en `supabase-config.js`.
5. En Authentication > Users crea un usuario para el panel de administración.

## 2. Archivos
- `index.html`: inicio.
- `quienes-somos.html`: quiénes somos.
- `contacto.html`: contacto.
- `styles.css`: estilos.
- `script.js`: carrito + registro de visitas.
- `supabase-config.js`: configuración pública del proyecto.
- `admin.html`: panel privado de registros.
- `admin.js`: login y lectura del panel.
- `supabase.sql`: tabla y políticas RLS.

## 3. Seguridad
Usa únicamente la Publishable key en el navegador. **Nunca** pongas una Secret key/service_role en `supabase-config.js`. La tabla tiene RLS activado: los visitantes pueden insertar registros, pero solo usuarios autenticados pueden leerlos.

## 4. Sobre las salidas
El navegador intenta registrar `salida` al abandonar una página mediante `pagehide` y `fetch(..., {keepalive:true})`. No es posible garantizar al 100% una señal de salida (por ejemplo, si el dispositivo pierde conexión o se apaga).

Documentación oficial: https://supabase.com/docs/reference/javascript/installing
