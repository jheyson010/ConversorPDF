# DocFlow

Editor y conversor de documentos con login, historial por usuario y herramientas PDF en Node.

## Ejecutar

```bash
npm install
npm start
```

Abre:

```text
http://localhost:3100
```

Pruebas:

```bash
npm test
```

Inicializar/verificar base de datos:

```bash
npm run db:init
```

## Funcional ahora

- Ingreso con Google o email.
- Sesion por cookie.
- Historial privado por usuario.
- Subida multiple de archivos hasta 50 MB.
- PDF: editar texto, ordenar paginas, unir, dividir, rotar, comprimir, proteger, firmar y marca de agua.
- Imagen a PDF con JPG/PNG.
- PDF a Word editable o Word visual.
- Word, Excel y PPT a PDF con conversion local basica.
- Descarga de resultados.
- Base local en `data/docflow.sqlite` o TiDB Cloud/MySQL usando variables de entorno.
- En Vercel, los archivos se guardan en TiDB (`documents.content`) y se reconstruyen temporalmente en `/tmp`.

## Google

Configura `GOOGLE_CLIENT_ID` o `REACT_APP_GOOGLE_CLIENT_ID` en `.env`.

En Google Cloud Console, agrega el origen autorizado de JavaScript:

```text
http://localhost:3100
```

Si usas otro puerto o dominio, registra tambien ese origen exacto.

## Base de datos

Por defecto usa `sql.js` y persiste en `data/docflow.sqlite`.

Para usar TiDB Cloud o MySQL, configura una de estas opciones en `.env` o en tu plataforma de despliegue:

```env
DATABASE_URL=mysql://USER:PASSWORD@HOST:4000/DATABASE
```

o:

```env
TIDB_HOST=tu-host.tidbcloud.com
TIDB_PORT=4000
TIDB_USER=tu_usuario
TIDB_PASSWORD=tu_password
TIDB_DATABASE=docflow
DOCFLOW_STORE_FILES_IN_DB=true
TIDB_CA_PATH=C:\ruta\isrgrootx1.pem
DB_SSL_REJECT_UNAUTHORIZED=true
```

La base remota guarda usuarios, sesiones, historial, documentos y operaciones. En Vercel tambien guarda el contenido binario del archivo en `documents.content`, porque el disco serverless no es persistente.

## Deploy en Vercel

1. Importa el repo en Vercel.
2. Configura estas variables en **Project Settings -> Environment Variables**:

```env
TIDB_HOST=tu-host.tidbcloud.com
TIDB_PORT=4000
TIDB_USER=tu_usuario
TIDB_PASSWORD=tu_password
TIDB_DATABASE=docflow
DOCFLOW_STORE_FILES_IN_DB=true
GOOGLE_CLIENT_ID=tu_google_client_id
REACT_APP_GOOGLE_CLIENT_ID=tu_google_client_id
```

3. Usa el build command del repo: `npm run build:workspace`.
4. El archivo `vercel.json` publica `public/` y enruta `/api/*` a Express serverless.
5. Despues del deploy, agrega el dominio de Vercel como origen autorizado en Google Cloud Console.

Si TiDB no tiene la base creada, la app intenta crear `docflow` automaticamente y luego crea las tablas. Si el usuario de TiDB no tiene permiso para crear bases, crea la base manualmente y deja `TIDB_DATABASE=docflow`.

## Estructura

```text
server.js
src/
  db/          base de datos y esquema
  middleware/  sesion y proteccion de rutas
  routes/      auth, archivos y herramientas
  services/    PDF, storage, auth, operaciones
public/
  index.html
  assets/css/
  assets/js/
data/
  uploads/
  outputs/
```

## Pendiente recomendado

- Para archivos grandes y mucho trafico, migrar binarios a Vercel Blob/S3 y dejar TiDB solo para metadatos.
- Motores externos para conversiones de alta fidelidad y firma digital criptografica.
