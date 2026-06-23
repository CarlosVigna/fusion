const { log } = require('./file-utils');

// Relança o erro apos esgotar as tentativas — quem chama (ex.: server.js
// respondendo a um trigger HTTP) precisa saber que falhou de verdade,
// mesmo que essa funcao ja tenha logado o erro definitivo aqui.
async function withRetry(fn, name, retries = 1, delayMs = 60000) {

    try {

        await fn();

        log(`${name} concluido com sucesso`);

    } catch (err) {

        if (retries > 0) {

            log(`[RETRY] ${name} falhou, tentando novamente em ${delayMs / 1000}s... Erro: ${err.message}`);

            await new Promise((resolve) => setTimeout(resolve, delayMs));

            return withRetry(fn, name, retries - 1, delayMs);

        }

        log(`[ERRO DEFINITIVO] ${name}: ${err.message}`);

        throw err;

    }

}

module.exports = { withRetry };
