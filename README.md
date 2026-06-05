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
TIDB_CA_PATH=C:\ruta\isrgrootx1.pem
DB_SSL_REJECT_UNAUTHORIZED=true
```

La base remota guarda usuarios, sesiones, historial, documentos y operaciones. Los archivos binarios se escriben en `data/uploads` y `data/outputs`, por lo que en produccion conviene montar almacenamiento persistente para esa carpeta.

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

- Almacenamiento externo para binarios grandes si se despliega en infraestructura sin disco persistente.
- Motores externos para conversiones de alta fidelidad y firma digital criptografica.
