// Geocodificacao e calculo de deslocamento rodando no ETL (Node), nao no
// backend Java. geocode.maps.co responde quando chamado do browser ou
// daqui, mas falha quando chamado do backend no Railway (provavelmente o
// IP de saida do Railway esta' rate-limited/bloqueado pelo provedor) —
// ver OrsService.geocode() no backend, que tem a mesma logica mas nao
// funciona de la'.

const axios = require('axios');

const GEOCODE_API_KEY = process.env.GEOCODE_MAPS_API_KEY; // mesma key que o backend usa (geocode.maps.api.key)

async function geocode(address, city, state) {
    const query = `${address}, ${city}, ${state}, Brasil`;
    const url = `https://geocode.maps.co/search?q=${encodeURIComponent(query)}&api_key=${GEOCODE_API_KEY}`;
    const resp = await axios.get(url);
    if (!resp.data || resp.data.length === 0) {
        throw new Error(`Geocode não encontrou: ${query}`);
    }
    return { lat: parseFloat(resp.data[0].lat), lon: parseFloat(resp.data[0].lon) };
}

// Distancia total (ida + volta) em km via OSRM (gratuito, sem chave).
async function calculateRoundTripKm(techLat, techLon, clientLat, clientLon) {
    const url = `https://router.project-osrm.org/route/v1/driving/${techLon},${techLat};${clientLon},${clientLat}?overview=false`;
    const resp = await axios.get(url);
    const distanceM = resp.data.routes[0].distance;
    const km = Math.round((distanceM / 1000) * 2 * 10) / 10; // ida e volta, 1 decimal
    return km;
}

// Primeiros 40km sao gratis; R$1,20/km no excedente — mesma regra do
// OrsService.calculateDisplacement() no backend.
function calculateDisplacement(km) {
    const FREE_KM = 40;
    const RATE = 1.20;
    if (km <= FREE_KM) return 0;
    return Math.round((km - FREE_KM) * RATE * 100) / 100;
}

module.exports = { geocode, calculateRoundTripKm, calculateDisplacement };
