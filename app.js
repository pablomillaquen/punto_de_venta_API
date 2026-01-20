const dotenv = require('dotenv');
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const errorHandler = require('./middleware/error');
const connectDatabase = require('./config/db');

// Inicializaciones
dotenv.config({path: './config/config.env'});
connectDatabase();

// Rutas
const auth = require('./routes/auth');
const users = require('./routes/users');
const products = require('./routes/products');
const categories = require('./routes/categories');
const branches = require('./routes/branches');
const inventory = require('./routes/inventory');
const sales = require('./routes/sales');

// Inicializaciones
const app = express();
app.use(express.json());
app.use(cors());

if(process.env.NODE_ENV === 'development'){
    app.use(morgan('dev'));
}

// Mount routers
app.use('/api/v1/auth', auth);
app.use('/api/v1/users', users);
app.use('/api/v1/products', products);
app.use('/api/v1/categories', categories);
app.use('/api/v1/branches', branches);
app.use('/api/v1/inventory', inventory);
app.use('/api/v1/sales', sales);
app.use('/api/v1/cash-shifts', require('./routes/cash-shifts'));
app.use('/api/v1/reports', require('./routes/reports'));

// Middleware
app.use(errorHandler);

// Variables de entorno
const PORT = process.env.PORT || 5001;

// Inicializaciones
const server = app.listen(PORT, console.log('Servidor se ejecuta en ambiente', process.env.NODE_ENV));

// Socket.io setup
const io = require('socket.io')(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    console.log('New client connected');
    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

app.set('io', io);

// Manejo de errores
process.on('unhandledRejection', (err, promise) => {
    console.log('Errores', err.message);
    server.close(() => process.exit(1));
});