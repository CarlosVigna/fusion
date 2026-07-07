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

        console.log('[INSTALACOES] Resposta login:', JSON.stringify(data));

        const token = data.accessToken || data.access_token || data.token;

        if (!token) {
            throw new Error(`Token não encontrado na resposta. Campos: ${Object.keys(data).join(', ')}`);
        }

        return token;

    } catch (error) {

        console.log('[INSTALACOES] Erro login:', error.response?.status, error.response?.data);
        throw error;

    }

}

async function fetchByStatus(token, portalStatus) {

    const items = [];
    let page = 0;
    const size = 100;

    while (true) {

        let data;

        try {

            const response = await axios.get(
                `${PORTAL_URL}/ordens-instalacao`,
                {
                    params: { status: portalStatus, page, size },
                    headers: { Authorization: `Bearer ${token}` },
                    timeout: 30000,
                }
            );

            data = response.data;

        } catch (error) {

            console.log(`[INSTALACOES] Erro busca (${portalStatus}):`, error.response?.status, error.response?.data);
            throw error;

        }

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

async function fetchAllOrdens(token) {

    const [aguardando, agendado] = await Promise.all([
        fetchByStatus(token, 'AGUARDANDO_AGENDAMENTO'),
        fetchByStatus(token, 'AGENDADO'),
    ]);

    return [...aguardando, ...agendado];

}

function mapOrdem(item) {

    const end = item.segurado?.endereco || {};
    const tel = item.segurado?.telefonePrincipal || {};

    return {
        externalId: item.externalId,
        numeroProposta: item.proposta?.numeroProposta,
        customerName: item.segurado?.nome,
        phone: tel.ddd && tel.numero ? `(${tel.ddd}) ${tel.numero}` : '',
        address: [end.logradouro, end.numero].filter(Boolean).join(', '),
        neighborhood: end.bairro,
        city: end.cidade,
        state: end.uf,
        zipCode: end.cep,
        plate: item.veiculo?.placa,
        model: item.veiculo?.modelo,
        portalCreatedAt: item.dataCriacao,
        serviceType: 'INSTALAÇÃO NOVA',
        portalStatus: item.status || null,
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

    if (ordens.length > 0) {
        console.log('[INSTALACOES] Estrutura da primeira ordem (raw):', JSON.stringify(ordens[0], null, 2));
    }

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

    log(`[INSTALACOES] Sync concluído: ${data.inserted} inseridas, ${data.updated} atualizadas`);

}

module.exports = { run };

if (require.main === module) {
    run().catch(err => {
        log(`[INSTALACOES] Erro: ${err.message}`);
        process.exit(1);
    });
}
