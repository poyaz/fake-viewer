/**
 * @property format.combine
 * @property format.printf
 */
const Winston = require('winston');

const myFormat = Winston.format.printf((info) => {
  return `< ${info.timestamp} > ${info.level.toUpperCase()}: ${info.message}`;
});

// noinspection JSUnresolvedFunction
const Logger = Winston.createLogger({
  level: 'info',
  format: Winston.format.combine(Winston.format.timestamp(), myFormat),
  transports: [new Winston.transports.Console()],
});

module.exports = Logger;
