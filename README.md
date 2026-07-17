# Registro de Peso

App web (Google Apps Script) para registrar y visualizar el peso de Iván, Isa,
Yami, Yoshi y Spike, usando como base de datos la Google Sheet:

`1ZYoBPSLDR3CuYrv_6bkFDoMCLxjlAIkqIYYCn8sP4JI`

Cada perfil tiene un dashboard con: peso actual, cambio en los últimos 7/30
días, progreso hacia el objetivo (peso, % grasa corporal, masa magra, edad
metabólica y grasa visceral para Iván e Isa), un gráfico de evolución con
línea de objetivo, y el historial de registros. Un botón "+ Nuevo registro"
permite cargar mediciones sin tocar la planilla.

## Archivos

- `Code.gs` — backend: lee/escribe la Sheet, calcula estadísticas.
- `Index.html`, `Stylesheet.html`, `JavaScript.html` — frontend (SPA sin
  frameworks, un solo archivo HTML servido por `HtmlService`).
- `appsscript.json` — manifest del proyecto.

## Cómo desplegarla

Esto requiere tu cuenta de Google (no puedo desplegarlo yo desde acá). Dos
opciones:

### Opción A — Manual, desde script.google.com (más simple)

1. Andá a https://script.google.com/ → **Nuevo proyecto**.
2. Borrá el `Code.gs` vacío y pegá el contenido de `Code.gs` de este repo.
3. Creá 3 archivos HTML (**Archivo → Nuevo → Html**) llamados exactamente
   `Index`, `Stylesheet` y `JavaScript`, y pegá el contenido correspondiente.
4. En **Configuración del proyecto** (ícono engranaje) → activá
   "Mostrar archivo de manifiesto `appsscript.json`", abrilo y reemplazá su
   contenido por el de este repo.
5. **Implementar → Nueva implementación → tipo: Aplicación web**.
   - Ejecutar como: **Yo (tu cuenta)**.
   - Quién tiene acceso: ver nota de privacidad más abajo.
6. Autorizá los permisos (acceso a la Sheet) la primera vez.
7. Copiá la URL de la app web — esa es la app.

### Opción B — Con `clasp` (CLI)

```bash
npm install -g @google/clasp
clasp login
clasp create --type webapp --title "Registro de Peso" --rootDir .
# clasp genera un scriptId nuevo en .clasp.json; o si ya creaste el proyecto
# a mano en el paso A, copiá su scriptId a .clasp.json en vez de "create".
clasp push
clasp deploy
```

## Nota de privacidad importante

El manifest (`appsscript.json`) trae `"access": "ANYONE_ANONYMOUS"`, es decir:
cualquiera que tenga el link de la app puede verla y cargar registros **sin
iniciar sesión** — así se evita cualquier pantalla de login, tal como se
pidió. La URL que genera Apps Script es larga y no indexada, pero no es una
verdadera barrera de seguridad si el link se filtra.

Si preferís requerir una cuenta de Google (sin agregar ninguna pantalla de
login dentro de la app — Google se encarga antes de mostrarla), cambiá en
`appsscript.json`:

```json
"access": "ANYONE"
```

y volvé a desplegar. Con `ANYONE` cualquier cuenta de Google puede entrar;
si además querés limitarlo a tu familia, `DOMAIN` solo funciona con Google
Workspace (no con cuentas @gmail.com sueltas).

## Estructura de la Sheet que usa la app

- **Iván / Isa** (personas): fila 1 = objetivo (`Peso, %grasa, Masa magra,
  Edad, Grasa visceral`), fila 2 = encabezados, fila 3 en adelante = datos.
- **Yami / Yoshi / Spike** (mascotas): solo `Fecha, Peso`, sin encabezado,
  desde la fila 1.

La app respeta esa estructura tal cual está en tu planilla actual — no la
modifica ni le agrega columnas. Los nuevos registros se agregan al final de
cada hoja.
