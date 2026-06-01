const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Servir archivos estáticos de la carpeta public (oep.png, gracias.html, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// ========== CONFIGURACIÓN ==========
const SECRET_KEY = process.env.SECRET_KEY || 'mi-clave-secreta-123';
const DATA_FILE = path.join(__dirname, 'submissions.txt');

// Crear archivo si no existe
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, '=== REGISTROS DEL FORMULARIO ===\nGenerado: ' + new Date().toLocaleString('es-ES') + '\n================================\n\n');
}

// ========== API: GUARDAR REGISTRO ==========
app.post('/api/submit', (req, res) => {
    const { nombre, email } = req.body;
    const timestamp = new Date().toLocaleString('es-ES');
    const line = `[${timestamp}] | Nombre: ${nombre || '(vacío)'} | Email: ${email || '(vacío)'}\n`;
    
    fs.appendFileSync(DATA_FILE, line);
    res.json({ success: true, message: 'Registro guardado correctamente' });
});

// ========== ARCHIVO TXT PROTEGIDO ==========
app.get('/submissions.txt', (req, res) => {
    const key = req.query.key;
    if (key !== SECRET_KEY) {
        return res.status(403).send('⛔ ACCESO DENEGADO\n\nSe requiere una clave válida para ver este archivo.\n\nEjemplo: /submissions.txt?key=TU_CLAVE');
    }
    if (!fs.existsSync(DATA_FILE)) {
        return res.status(404).send('No hay registros aún.');
    }
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.sendFile(DATA_FILE);
});

// ========== DESCARGAR ARCHIVO ==========
app.get('/api/download', (req, res) => {
    const key = req.query.key;
    if (key !== SECRET_KEY) {
        return res.status(403).json({ error: 'Clave incorrecta' });
    }
    res.setHeader('Content-Disposition', 'attachment; filename="todos_los_registros.txt"');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.sendFile(DATA_FILE);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Servidor corriendo en puerto ${PORT}`);
});