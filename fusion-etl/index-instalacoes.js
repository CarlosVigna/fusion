require('dotenv').config();

const axios = require('axios');
const { log } = require('./src/file-utils');

const BACKEND_URL = process.env.BACKEND_URL;
const ETL_API_KEY = process.env.ETL_API_KEY;
const PORTAL_URL = process.env.PORTAL_PARCEIRO_URL || 'https://onmeseguros.com.br';
const CLIENT_ID = process.env.PORTAL_PARCEIRO_CLIENT_ID || '';
const CLIENT_SECRET = process.env.PORTAL_PARCEIRO_CLIENT_SECRET || '';

async function getToken() {

    const params = new URLSearchParams();
    params.append('grant_type', 'password');
    params.append('client_id', CLIENT_ID);
    params.append('client_secret', CLIENT_SECRET);
    params.append('username', CLIENT_ID);
    params.append('password', CLIENT_SECRET);

    console.log('[INSTALACOES] Tentando login:', {
        grant_type: 'password',
        client_id: CLIENT_ID ? CLIENT_ID.substring(0, 4) + '***' : 'VAZIO',
        username: CLIENT_ID ? CLIENT_ID.substring(0, 4) + '***' : 'VAZIO',
        client_secret: CLIENT_SECRET ? '***definido***' : 'VAZIO',
        password: CLIENT_SECRET ? '***definido***' : 'VAZIO',
    });

    try {

        const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

        const { data } = await axios.post(
            `${PORTAL_URL}/oauth/token`,
            params.toString(),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Basic ${credentials}`,
                    'Origin': 'https://parceiro.usebens.com.br',
                },
                timeout: 30000,
            }
        );

        return data.access_token;

    } catch (error) {

        console.log('[INSTALACOES] Erro login:', error.response?.status, error.response?.data);
        throw error;

    }

}

async function fetchAllOrdens(token) {

    const items = [];
    let page = 0;
    const size = 100;

    while (true) {

        const { data } = await axios.get(
            `${PORTAL_URL}/ordens-instalacao`,
            {
                params: { status: 'AGUARDANDO_AGENDAMENTO', page, size },
                headers: { Authorization: `Bearer ${token}` },
                timeout: 30000,
            }
        );

        // Suporta resposta paginada ({ content, last }) ou array plano
        const content = Array.isArray(data)
            ? data
            : (data.content || data.items || data.data || []);

        items.push(...content);

        const isLast = Array.isArray(data)
            ? content.length < size
            : (data.last === true || content.length < size);

        if (isLast) break;

        page++;

    }

    return items;

}

function mapOrdem(ordem) {

    return {
        externalId: ordem.id != null ? String(ordem.id) : null,
        customerName: ordem.nomeCliente || ordem.nome || '',
        address: ordem.endereco || '',
        neighborhood: ordem.bairro || '',
        city: ordem.cidade || '',
        state: ordem.estado || ordem.uf || '',
        zipCode: ordem.cep || '',
        phone: ordem.telefone || ordem.celular || '',
        plate: ordem.placa || '',
        model: ordem.modelo || '',
        numeroProposta: ordem.numeroProposta || null,
        portalCreatedAt: ordem.dataCriacao || ordem.createdAt || null,
        serviceType: ordem.tipoServico || 'INSTALAÇÃO NOVA',
    };

}

async function run() {

    log('[INSTALACOES] Iniciando ETL de instalações');

    if (!BACKEND_URL || !ETL_API_KEY) {
        throw new Error('BACKEND_URL ou ETL_API_KEY não configurados');
    }

    if (!CLIENT_ID || !CLIENT_SECRET) {
        throw new Error('PORTAL_PARCEIRO_CLIENT_ID ou PORTAL_PARCEIRO_CLIENT_SECRET não configurados');
    }

    const token = await getToken();

    log('[INSTALACOES] Token obtido do portal parceiro');

    const ordens = await fetchAllOrdens(token);

    log(`[INSTALACOES] ${ordens.length} ordens encontradas`);

    if (ordens.length === 0) {
        log('[INSTALACOES] Nenhuma ordem para sincronizar');
        return;
    }

    const payload = ordens.map(mapOrdem);

    const { data } = await axios.post(
        `${BACKEND_URL}/installations/sync`,
        payload,
        {
            headers: { 'X-ETL-Key': ETL_API_KEY },
            timeout: 60000,
        }
    );

    log(`[INSTALACOES] Sync concluído: ${data.inserted} inseridas, ${data.skipped} ignoradas`);

}

module.exports = { run };

if (require.main === module) {
    run().catch(err => {
        log(`[INSTALACOES] Erro: ${err.message}`);
        process.exit(1);
    });
}
