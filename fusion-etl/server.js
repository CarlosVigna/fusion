require('dotenv').config();

const express = require('express');
const { buscarApolice } = require('./index-apolices');

const PORT = process.env.ETL_SERVER_PORT || 3001;
const ETL_API_KEY = process.env.ETL_API_KEY || '';

const app = express();
app.use(express.json());

function authMiddleware(req, res, next) {
    const key = req.headers['x-etl-key'];
    if (!ETL_API_KEY || key !== ETL_API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
});

app.post('/apolice/buscar', authMiddleware, async (req, res) => {
    const { plate } = req.body;

    if (!plate || typeof plate !== 'string' || plate.trim().length === 0) {
        return res.status(400).json({ error: 'plate é obrigatório' });
    }

    try {
        const result = await buscarApolice(plate.trim().toUpperCase());
        return res.json(result);
    } catch (error) {
        console.error('[SERVER] Erro ao buscar apólice:', error.message);
        return res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`[SERVER] ETL server rodando na porta ${PORT}`);
});
