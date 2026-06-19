const fs = require('fs');
const path = require('path');

const logDir = process.env.ETL_LOG_DIR || 'C:/FusionData/log';

function log(message) {

    const line = `[${new Date().toISOString()}] ${message}\n`;

    console.log(line.trim());

    fs.mkdirSync(logDir, { recursive: true });

    fs.appendFileSync(
        path.join(logDir, 'etl.log'),
        line
    );

}

/**
 * Move arquivo para pasta de backup mantendo apenas os N mais recentes.
 */
async function moveToBackupWithRotation(filePath, backupDir, maxFiles = 5) {

    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    const fileName = path.basename(filePath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `${timestamp}_${fileName}`;
    const backupPath = path.join(backupDir, backupName);

    fs.copyFileSync(filePath, backupPath);

    // Rotação: apagar os mais antigos se passar de maxFiles
    const files = fs.readdirSync(backupDir)
        .filter(f => f.endsWith(path.extname(fileName)))
        .map(f => ({ name: f, time: fs.statSync(path.join(backupDir, f)).mtime }))
        .sort((a, b) => b.time - a.time);

    if (files.length > maxFiles) {
        files.slice(maxFiles).forEach(f => {
            fs.unlinkSync(path.join(backupDir, f.name));
            log(`[BACKUP] Removido arquivo antigo: ${f.name}`);
        });
    }

    log(`[BACKUP] Arquivo salvo: ${backupName}`);

    return backupPath;

}

module.exports = { moveToBackupWithRotation, log };
