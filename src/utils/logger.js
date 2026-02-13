const fs = require('fs');
const path = require('path');

const logDir = './logs';
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive:  true });
}

const logger = {
    info: (message) => {
        const log = `[${new Date().toISOString()}] INFO: ${message}\n`;
        console.log(log);
        fs.appendFileSync(path.join(logDir, 'info.log'), log);
    },
    
    error: (message, error = null) => {
        const log = `[${new Date().toISOString()}] ERROR: ${message}${error ? '\n' + error. stack : ''}\n`;
        console.error(log);
        fs.appendFileSync(path. join(logDir, 'error.log'), log);
    },
    
    warn: (message) => {
        const log = `[${new Date().toISOString()}] WARN: ${message}\n`;
        console.warn(log);
        fs.appendFileSync(path.join(logDir, 'warn.log'), log);
    }
};

module.exports = logger;