require('dotenv').config();

const axios = require('axios');

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

    const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

    try {

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

        const token = data.accessToken || data.access_token || data.token;

        if (!token) {
            throw new Error(`Token não encontrado na resposta. Campos: ${Object.keys(data).join(', ')}`);
        }

        return token;

    } catch (error) {

        console.error('[APOLICES] Erro login:', error.response?.status, error.response?.data);
        throw error;

    }

}

async function fetchApolices(token, plate) {

    try {

        const { data } = await axios.get(
            `${PORTAL_URL}/seguro/auto/v1/protocolos/apolices`,
            {
                params: {
                    inicio: '01/01/2017',
                    fim: '31/12/2030',
                    pesquisa: plate,
                    page: 0,
                    size: 50,
                },
                headers: { Authorization: `Bearer ${token}` },
                timeout: 30000,
            }
        );

        return Array.isArray(data)
            ? data
            : (data.content || data.items || data.data || []);

    } catch (error) {

        console.error('[APOLICES] Erro busca:', error.response?.status, error.response?.data);
        throw error;

    }

}

// Converts dd/MM/yyyy to yyyy-MM-dd
function parsePortalDate(str) {
    if (!str) return null;
    const parts = str.split('/');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return str;
}

function mapApolice(item) {
    return {
        policyNumber: item.numero_apolice || null,
        startDate: parsePortalDate(item.inicio_vigencia),
        endDate: parsePortalDate(item.fim_vigencia),
        insuredName: item.nome_razao_social || null,
        cpfCnpj: item.cpf_cnpj || null,
        plate: item.placa || null,
        vehicleModel: item.veiculo_modelo || null,
        vehicleBrand: item.veiculo_marca || null,
        bonus: item.bonus != null ? Number(item.bonus) : null,
    };
}

async function buscarApolice(plate) {

    if (!CLIENT_ID || !CLIENT_SECRET) {
        throw new Error('PORTAL_PARCEIRO_CLIENT_ID ou PORTAL_PARCEIRO_CLIENT_SECRET não configurados');
    }

    const token = await getToken();

    console.log(`[APOLICES] Buscando apólice para placa: ${plate}`);

    const items = await fetchApolices(token, plate.toUpperCase());

    console.log(`[APOLICES] ${items.length} apólices encontradas para ${plate}`);

    const vigentes = items.filter(i => i.status === 'Apólice vigente');

    if (vigentes.length === 0) {
        return { found: false };
    }

    // Pick most recent by fim_vigencia (format dd/MM/yyyy — lexicographic on
    // reversed parts works correctly within same century)
    vigentes.sort((a, b) => {
        const da = parsePortalDate(a.fim_vigencia) || '';
        const db = parsePortalDate(b.fim_vigencia) || '';
        return db.localeCompare(da);
    });

    return { found: true, data: mapApolice(vigentes[0]) };

}

module.exports = { buscarApolice };

if (require.main === module) {
    const plate = process.argv[2];
    if (!plate) {
        console.error('Uso: node index-apolices.js <PLACA>');
        process.exit(1);
    }
    buscarApolice(plate)
        .then(result => console.log(JSON.stringify(result, null, 2)))
        .catch(err => {
            console.error('[APOLICES] Erro:', err.message);
            process.exit(1);
        });
}
